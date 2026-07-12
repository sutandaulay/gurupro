import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const memberRes = await query(
      `SELECT im.app_user_id as member_id
       FROM institution_members im
       JOIN institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND imr.value = 'guru' AND im.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (memberRes.rows.length === 0) {
      return NextResponse.json({ guru_mapel_member_id: null, error: 'User bukan guru' }, { status: 403 });
    }

    return NextResponse.json({ guru_mapel_member_id: memberRes.rows[0].member_id });
  } catch (error: any) {
    console.error('GET guru-member-id error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
