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

    // Verify the membership belongs to this user and is in 'invited' status
    const member = await query(
      `SELECT im.id, im.status, im.institution_id, i.name as institution_name
       FROM institution_members im
       JOIN institutions i ON i.id = im.institution_id
       WHERE im.id = $1 AND im.app_user_id = $2
       LIMIT 1`,
      [memberIdNum, userId]
    );

    if (member.rows.length === 0) {
      return NextResponse.json(
        { error: 'Undangan tidak ditemukan atau bukan milik Anda' },
        { status: 404 }
      );
    }

    if (member.rows[0].status !== 'invited') {
      return NextResponse.json(
        { error: `Undangan sudah dalam status ${member.rows[0].status}, tidak bisa di-accept` },
        { status: 409 }
      );
    }

    // Accept: set status to 'active' and set joinedAt
    const result = await query(
      `UPDATE institution_members
       SET status = 'active', joined_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [memberIdNum]
    );

    // Send in-app notification confirming acceptance
    try {
      await query(
        `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          'Berhasil Bergabung',
          `Anda telah bergabung dengan institusi "${member.rows[0].institution_name}". Subscription individual Anda tidak berubah.`,
          'success',
          'institution_accept',
          String(memberIdNum),
        ]
      );
    } catch { /* notification is non-critical */ }

    // Sync to user_school_assignments so the teacher can access school data
    try {
      const inst = await query(
        `SELECT npsn FROM institutions WHERE id = $1`,
        [member.rows[0].institution_id]
      );

      if (inst.rows.length > 0 && inst.rows[0].npsn) {
        const npsn = inst.rows[0].npsn;

        const school = await query(
          `SELECT id FROM schools WHERE npsn = $1 LIMIT 1`,
          [npsn]
        );

        if (school.rows.length > 0) {
          const existing = await query(
            `SELECT id FROM user_school_assignments WHERE userid = $1 AND schoolid = $2 LIMIT 1`,
            [userId, school.rows[0].id]
          );

          if (existing.rows.length === 0) {
            await query(
              `INSERT INTO user_school_assignments (userid, schoolid) VALUES ($1, $2)`,
              [userId, school.rows[0].id]
            );
          }
        }
      }

      await query(
        `UPDATE users SET nama_sekolah = $1 WHERE id = $2 AND (nama_sekolah IS NULL OR nama_sekolah = '')`,
        [member.rows[0].institution_name, userId]
      );
    } catch { /* sync is non-critical */ }

    return NextResponse.json({
      message: 'Berhasil bergabung dengan institusi',
      member: result.rows[0],
    });
  } catch (error: any) {
    console.error('Accept error:', error);
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status }
    );
  }
}
