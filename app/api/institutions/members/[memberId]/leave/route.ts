import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { parseSessionCookie } from '@/lib/session-sign';

async function getUserId() {
  const session = parseSessionCookie((await cookies()).get('gurupro_session')?.value);
  if (!session) throw new Error('Unauthorized');
  return session.id;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const userId = await getUserId();
    const { memberId } = await params;
    const memberIdNum = parseInt(memberId, 10);

    if (isNaN(memberIdNum)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    // Fetch the membership record
    const member = await query(
      `SELECT im.*, i.name as institution_name
       FROM public.institution_members im
       JOIN institutions i ON i.id = im.institution_id
       WHERE im.id = $1
       LIMIT 1`,
      [memberIdNum]
    );

    if (member.rows.length === 0) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan' },
        { status: 404 }
      );
    }

    const membership = member.rows[0];

    // Check authorization: user can leave own membership, operator can remove anyone
    const isOwn = membership.app_user_id === userId;
    const isOperator = await query(
      `SELECT im.id FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2
         AND im.status = 'active'
         AND imr.value IN ('operator', 'admin_sekolah')
       LIMIT 1`,
      [userId, membership.institution_id]
    );

    if (!isOwn && isOperator.rows.length === 0) {
      return NextResponse.json(
        { error: 'Forbidden: Anda tidak memiliki izin' },
        { status: 403 }
      );
    }

    if (membership.status !== 'active') {
      return NextResponse.json(
        { error: `Membership dalam status ${membership.status}, tidak bisa di-leave` },
        { status: 409 }
      );
    }

    // Set status to 'left' — documents stay, teacher has read-only access
    await query(
      `UPDATE institution_members
       SET status = 'left', updated_at = NOW()
       WHERE id = $1`,
      [memberIdNum]
    );

    // Send in-app notification about leaving
    try {
      await query(
        `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          membership.app_user_id,
          'Keanggotaan Institusi Diakhiri',
          `Anda telah keluar atau dinonaktifkan dari institusi "${membership.institution_name}". Dokumen Anda tetap tersimpan dan dapat diakses read-only.`,
          'info',
          'institution_leave',
          String(memberIdNum),
        ]
      );
    } catch { /* notification is non-critical */ }

    // Notify institution admins
    try {
      const adminsResult = await query(
        `SELECT im.app_user_id FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         WHERE im.institution_id = $1
           AND im.status = 'active'
           AND imr.value IN ('operator', 'admin_sekolah', 'kepala_sekolah')
           AND im.app_user_id IS NOT NULL`,
        [membership.institution_id]
      );

      for (const admin of adminsResult.rows) {
        const appUserId = admin.app_user_id;
        const appUserResult = await query(
          `SELECT nama_lengkap FROM users WHERE id = $1 LIMIT 1`,
          [appUserId]
        );
        const appUserName = appUserResult.rows[0]?.nama_lengkap || 'Admin';

        await query(
          `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            appUserId,
            'Anggota Keluar dari Institusi',
            `${appUserName}, "${membership.institution_name}" telah keluar atau dinonaktifkan dari institusi.`,
            'info',
            'institution_member_leave',
            String(memberIdNum),
          ]
        );
      }
    } catch { /* notification is non-critical */ }

    return NextResponse.json({
      message: 'Keanggotaan berhasil diakhiri. Dokumen tetap tersimpan dengan akses read-only.',
    });
  } catch (error: any) {
    console.error('Leave error:', error);
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status }
    );
  }
}
