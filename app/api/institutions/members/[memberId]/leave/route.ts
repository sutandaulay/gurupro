import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function getUserId() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session')?.value;
  if (!sessionCookie) throw new Error('Unauthorized');
  const session = JSON.parse(sessionCookie);
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
       FROM institution_members im
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
      `SELECT im.id FROM institution_members im
       JOIN institution_members_role imr ON imr.parent_id = im.id
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
