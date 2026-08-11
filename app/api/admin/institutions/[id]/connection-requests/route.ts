import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getPendingConnectionRequestsByInstitution } from '@/lib/institution-members';
import { sendInAppNotification } from '@/lib/institution-members';
import { sendWhatsAppNotification, sendEmailNotification } from '@/lib/notifications';

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session')?.value;
  if (!sessionCookie) throw new Error('Unauthorized');

  const session = JSON.parse(sessionCookie);
  const userId = session.id;

  const result = await query('SELECT role FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0 || !['admin', 'super_admin', 'manager'].includes(result.rows[0].role)) {
    throw new Error('Forbidden');
  }

  return userId;
}

async function isOperatorOfInstitution(userId: string, institutionId: number): Promise<boolean> {
  const result = await query(
    `SELECT im.id FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.app_user_id = $1 AND im.institution_id = $2
       AND im.status = 'active'
       AND imr.value IN ('operator', 'admin_sekolah', 'kepala_sekolah')
     LIMIT 1`,
    [userId, institutionId]
  );
  return result.rows.length > 0;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await requireAdmin();
    const { id } = await context.params;
    const instId = parseInt(id, 10);

    if (isNaN(instId)) {
      return NextResponse.json({ error: 'ID lembaga tidak valid' }, { status: 400 });
    }

    const isOp = await isOperatorOfInstitution(adminId, instId);
    if (!isOp) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const requests = await getPendingConnectionRequestsByInstitution(instId);
    return NextResponse.json(requests);
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await requireAdmin();
    const { id } = await context.params;
    const instId = parseInt(id, 10);

    if (isNaN(instId)) {
      return NextResponse.json({ error: 'ID lembaga tidak valid' }, { status: 400 });
    }

    const isOp = await isOperatorOfInstitution(adminId, instId);
    if (!isOp) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { requestId, action } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: 'requestId dan action wajib diisi' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
    }

    const requestResult = await query(
      `SELECT cr.*, u.nama_lengkap, u.email, u.whatsapp, i.name as institution_name
       FROM connection_requests cr
       JOIN users u ON u.id = cr.user_id
       JOIN payload.institutions i ON i.id = cr.institution_id
       WHERE cr.id = $1 AND cr.institution_id = $2 AND cr.status = 'pending'
       LIMIT 1`,
      [requestId, instId]
    );

    if (requestResult.rows.length === 0) {
      return NextResponse.json({ error: 'Permintaan tidak ditemukan atau sudah diproses' }, { status: 404 });
    }

    const request = requestResult.rows[0];

    if (action === 'approve') {
      const cmsUserResult = await query(
        `SELECT id FROM payload.cms_users WHERE email = (SELECT email FROM users WHERE id = $1) LIMIT 1`,
        [adminId]
      );

      const cmsUserId = cmsUserResult.rows.length > 0 ? cmsUserResult.rows[0].id : null;

      if (!cmsUserId) {
        return NextResponse.json({ error: 'Akun CMS admin tidak ditemukan' }, { status: 400 });
      }

      const approved = await approveConnectionRequest(requestId, cmsUserId, adminId);

      if (!approved) {
        return NextResponse.json({ error: 'Gagal menyetujui permintaan' }, { status: 500 });
      }

      await sendInAppNotification(
        request.user_id,
        'Pengajuan Diterima',
        `Pengajuan bergabung di "${request.institution_name}" telah diterima. Anda sekarang adalah anggota aktif.`,
        'success',
        'connection_approve',
        requestId
      );

      const appUser = request.user_email || request.whatsapp;
      if (appUser) {
        const subject = 'Pengajuan Bergabung Diterima - GuruPRO';
        const html = `<div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #4f46e5;">Selamat!</h2>
          <p>Halo <strong>${request.nama_lengkap || 'Bapak/Ibu'}</strong>,</p>
          <p>Pengajuan Anda untuk bergabung dengan institusi <strong>${request.institution_name}</strong> telah disetujui.</p>
          <p>Sekarang Anda dapat mengakses semua fitur institusi di GuruPRO.</p>
          <p>Terima kasih,<br>Tim GuruPRO</p>
        </div>`;

        if (request.email) {
          await sendEmailNotification(request.email, subject, html);
        }
        if (request.whatsapp) {
          await sendWhatsAppNotification(
            request.whatsapp,
            `[GuruPRO] Selamat! Pengajuan bergabung di "${request.institution_name}" telah diterima. Anda sekarang anggota aktif.`
          );
        }
      }

      return NextResponse.json({ success: true, message: 'Pengajuan berhasil disetujui' });
    }

    if (action === 'reject') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const rejected = await rejectConnectionRequest(requestId, thirtyDaysFromNow);

      if (!rejected) {
        return NextResponse.json({ error: 'Gagal menolak permintaan' }, { status: 500 });
      }

      await sendInAppNotification(
        request.user_id,
        'Pengajuan Ditolak',
        `Pengajuan bergabung di "${request.institution_name}" belum dapat disetujui saat ini.`,
        'error',
        'connection_reject',
        requestId
      );

      if (request.whatsapp) {
        await sendWhatsAppNotification(
          request.whatsapp,
          `[GuruPRO] Pengajuan bergabung di "${request.institution_name}" belum dapat disetujui saat ini. Silakan coba kembali nanti.`
        );
      }

      return NextResponse.json({ success: true, message: 'Pengajuan berhasil ditolak' });
    }

    return NextResponse.json({ error: 'Action tidak didukung' }, { status: 400 });
  } catch (error: any) {
    console.error('Process connection request error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
