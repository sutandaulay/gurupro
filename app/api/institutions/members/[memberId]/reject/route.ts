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

    // Verify the membership belongs to this user and is in 'invited' status
    const member = await query(
      `SELECT im.id, im.status, i.name as institution_name
       FROM public.institution_members im
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
        { error: `Undangan sudah dalam status ${member.rows[0].status}` },
        { status: 409 }
      );
    }

    // Reject: set status to 'rejected' (soft-delete pattern)
    await query(
      `UPDATE institution_members
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1`,
      [memberIdNum]
    );

    return NextResponse.json({
      message: 'Undangan berhasil ditolak',
    });
  } catch (error: any) {
    console.error('Reject error:', error);
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status }
    );
  }
}
