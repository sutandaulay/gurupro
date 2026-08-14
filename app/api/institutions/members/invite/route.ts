import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { parseSessionCookie } from '@/lib/session-sign';
import { NextResponse } from 'next/server';
import {
  findAppUserByEmailOrUsername,
  findOrCreateCmsUser,
  createInvitation,
  createMembership,
  sendInviteNotification,
  sendInAppNotification,
} from '@/lib/institution-members';

async function getUserId() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
  if (!session) throw new Error('Unauthorized');
  return session.id;
}

export async function POST(req: Request) {
  try {
    const operatorUserId = await getUserId();
    const { emailOrNik, institutionId } = await req.json();

    if (!emailOrNik || !institutionId) {
      return NextResponse.json(
        { error: 'emailOrNik dan institutionId wajib diisi' },
        { status: 400 }
      );
    }

    // Verify operator has permission to manage members
    const operator = await query(
      `SELECT im.id FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2
         AND im.status = 'active'
         AND imr.value IN ('operator', 'admin_sekolah')
       LIMIT 1`,
      [operatorUserId, institutionId]
    );
    if (operator.rows.length === 0) {
      return NextResponse.json(
        { error: 'Forbidden: Anda tidak memiliki izin untuk mengelola anggota' },
        { status: 403 }
      );
    }

    // Check institution exists and is active
    const institution = await query(
      `SELECT id, name FROM institutions WHERE id = $1 AND status IN ('active', 'trial') LIMIT 1`,
      [institutionId]
    );
    if (institution.rows.length === 0) {
      return NextResponse.json(
        { error: 'Institusi tidak ditemukan atau tidak aktif' },
        { status: 404 }
      );
    }

    // Find or create the user
    let appUser = await findAppUserByEmailOrUsername(emailOrNik);

    const isNewUser = !appUser;

    if (!appUser) {
      // User not registered yet — create stub user
      const isEmail = emailOrNik.includes('@');
      if (!isEmail) {
        return NextResponse.json(
          { error: 'Guru dengan NIK/username tersebut belum terdaftar. Silakan gunakan email yang sudah terdaftar.' },
          { status: 404 }
        );
      }
      const placeholderWa = `placeholder-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const result = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap, role, created_at)
         VALUES ($1, $2, $3, 'guru', NOW())
         RETURNING id, email, nama_lengkap, whatsapp`,
        [emailOrNik, placeholderWa, emailOrNik.split('@')[0]]
      );
      appUser = result.rows[0];
    }

    if (!appUser) {
      return NextResponse.json(
        { error: 'Gagal membuat akun guru' },
        { status: 500 }
      );
    }

    // Find or create CMS user early (needed for constraint check)
    const cmsUserId = await findOrCreateCmsUser(appUser);

    // Check if already a member of this institution (by app_user_id OR cms user_id)
    const existingMember = await query(
      `SELECT id, status FROM public.institution_members
       WHERE institution_id = $1
         AND (app_user_id = $2 OR user_id = $3)
       LIMIT 1`,
      [institutionId, appUser.id, cmsUserId]
    );

    if (existingMember.rows.length > 0) {
      const currentStatus = existingMember.rows[0].status;
      if (currentStatus === 'active' || currentStatus === 'invited') {
        return NextResponse.json(
          { error: `Guru sudah menjadi anggota dengan status: ${currentStatus}` },
          { status: 409 }
        );
      }
      // Re-invite if left or rejected
      await query(
        `UPDATE institution_members SET status = 'invited', updated_at = NOW()
         WHERE id = $1`,
        [existingMember.rows[0].id]
      );
      await sendInviteNotification(appUser.id, appUser.email, appUser.whatsapp, appUser.nama_lengkap, institution.rows[0].name);
      return NextResponse.json({
        message: 'Undangan berhasil dikirim ulang',
        memberId: existingMember.rows[0].id,
        status: 'invited',
      });
    }

    if (isNewUser) {
      // New user → langsung active, tanpa invite-accept (tidak ada akun lama yang berpotensi konflik)
      const member = await createMembership(appUser.id, cmsUserId, institutionId, 'active');
      await sendInAppNotification(
        appUser.id,
        'Ditambahkan ke Institusi',
        `Anda telah ditambahkan sebagai anggota institusi "${institution.rows[0].name}". Silakan selesaikan pendaftaran untuk mulai menggunakan akun Anda.`,
        'success',
        'institution_added',
        String(member.id)
      );
      return NextResponse.json({
        message: 'Guru baru berhasil ditambahkan ke institusi (aktif langsung)',
        memberId: member.id,
        status: 'active',
      });
    }

    // Existing user → kirim undangan (invited)
    const member = await createInvitation(appUser.id, cmsUserId, institutionId);
    await sendInviteNotification(appUser.id, appUser.email, appUser.whatsapp, appUser.nama_lengkap, institution.rows[0].name);

    return NextResponse.json({
      message: 'Undangan berhasil dikirim',
      memberId: member.id,
      status: member.status,
    });
  } catch (error: any) {
    console.error('Invite error:', error);
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status }
    );
  }
}
