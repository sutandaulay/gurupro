import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { parseSessionCookie } from '@/lib/session-sign';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const session = parseSessionCookie(sessionCookie);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.id;

    const { npsn } = await req.json();
    if (!npsn || npsn.trim().length < 4) {
      return NextResponse.json({ error: 'NPSN tidak valid' }, { status: 400 });
    }

    const instResult = await query(
      `SELECT id, name, npsn, status FROM payload.institutions WHERE npsn = $1 AND status = 'active' LIMIT 1`,
      [npsn.trim()]
    );

    if (instResult.rows.length === 0) {
      return NextResponse.json({ error: 'Institusi with NPSN tersebut tidak ditemukan' }, { status: 404 });
    }

    const institution = instResult.rows[0];

    const cmsUser = await query(
      `SELECT id FROM payload.cms_users WHERE email = (SELECT email FROM users WHERE id = $1) LIMIT 1`,
      [userId]
    );

    if (cmsUser.rows.length === 0) {
      return NextResponse.json({ error: 'Akun CMS tidak ditemukan' }, { status: 400 });
    }

    const cmsUserId = cmsUser.rows[0].id;

    const existingMember = await query(
      `SELECT id, status FROM public.institution_members WHERE user_id = $1 AND institution_id = $2 LIMIT 1`,
      [cmsUserId, institution.id]
    );

    if (existingMember.rows.length > 0) {
      const currentStatus = existingMember.rows[0].status;
      if (currentStatus === 'active' || currentStatus === 'pending' || currentStatus === 'invited') {
        return NextResponse.json({ error: `Anda sudah memiliki koneksi dengan status "${currentStatus}"` }, { status: 409 });
      }
    }

    const schoolResult = await query(
      `SELECT id FROM schools WHERE npsn = $1 LIMIT 1`,
      [npsn.trim()]
    );

    if (schoolResult.rows.length === 0) {
      return NextResponse.json({ error: 'Sekolah dengan NPSN tersebut belum terdaftar di sistem' }, { status: 404 });
    }

    const schoolId = schoolResult.rows[0].id;

    const pendingRequest = await query(
      `SELECT id FROM connection_requests WHERE user_id = $1 AND institution_id = $2 AND status = 'pending' LIMIT 1`,
      [userId, institution.id]
    );

    if (pendingRequest.rows.length > 0) {
      return NextResponse.json({ error: 'Anda sudah memiliki pengajuan yang sedang menunggu persetujuan' }, { status: 409 });
    }

    await query(
      `INSERT INTO connection_requests (user_id, institution_id, school_id, status)
       VALUES ($1, $2, $3, 'pending')`,
      [userId, institution.id, schoolId]
    );

    const memberResult = await query(
      `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NULL, NOW(), NOW())
       RETURNING id`,
      [cmsUserId, userId, institution.id]
    );

    const memberId = memberResult.rows[0].id;

    await query(
      `INSERT INTO institution_members_role ("order", parent_id, value)
       VALUES ($1, $2, 'guru')
       ON CONFLICT DO NOTHING`,
      [1, memberId]
    );

    await query(
      `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        userId,
        'Pengajuan Terkirim',
        `Anda telah mengajukan bergabung di "${institution.name}". Tunggu persetujuan admin.`,
        'connect_request',
        'institution',
        String(institution.id)
      ]
    );

    const appUserResult = await query(
      `SELECT nama_lengkap FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const appUserName = appUserResult.rows[0]?.nama_lengkap || 'Seorang guru';

    const adminsResult = await query(
      `SELECT im.app_user_id FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.institution_id = $1
         AND im.status = 'active'
         AND imr.value IN ('operator', 'admin_sekolah', 'kepala_sekolah')
         AND im.app_user_id IS NOT NULL`,
      [institution.id]
    );

    for (const admin of adminsResult.rows) {
      try {
        await query(
          `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            admin.app_user_id,
            'Pengajuan Connect Baru',
            `${appUserName} mengajukan bergabung ke institusi "${institution.name}".`,
            'connect_request',
            'institution',
            String(institution.id)
          ]
        );
      } catch { /* notification is non-critical */ }
    }

    return NextResponse.json({
      success: true,
      message: 'Pengajuan bergabung terkirim. Tunggu persetujuan admin institusi.',
      institutionId: institution.id,
      memberId,
    });
  } catch (error: any) {
    console.error('Connect institution error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
