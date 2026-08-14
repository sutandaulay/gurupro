import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { parseSessionCookie } from '@/lib/session-sign';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token undangan diperlukan' }, { status: 400 });
    }

    const userResult = await query(
      `SELECT id, email, whatsapp, nama_lengkap FROM users WHERE pending_invitation_token = $1 LIMIT 1`,
      [token]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'Undangan tidak ditemukan atau sudah kadaluwarsa' }, { status: 404 });
    }

    const user = userResult.rows[0];

    const memberResult = await query(
      `SELECT im.id, im.status, im.institution_id, i.name as institution_name
       FROM public.institution_members im
       JOIN institutions i ON i.id = im.institution_id
       WHERE im.app_user_id = $1 AND im.status = 'invited'
       LIMIT 1`,
      [user.id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada undangan aktif yang bisa diterima' }, { status: 404 });
    }

    const member = memberResult.rows[0];

    const session = parseSessionCookie((await cookies()).get('gurupro_session')?.value);
    let isLoggedIn = false;
    if (session?.id === user.id) {
      isLoggedIn = true;
    }

    if (!isLoggedIn) {
      return NextResponse.json({
        success: false,
        requiresLogin: true,
        message: 'Silakan masuk untuk menerima undangan',
        invitation: {
          institutionName: member.institution_name,
          userName: user.nama_lengkap,
          userEmail: user.email,
        }
      });
    }

    await query(
      `UPDATE payload.institution_members SET status = 'active', joined_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [member.id]
    );

    await query(`UPDATE users SET pending_invitation_token = NULL WHERE id = $1`, [user.id]);

    await query(
      `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        user.id,
        'Berhasil Bergabung',
        `Anda telah bergabung dengan institusi "${member.institution_name}".`,
        'success',
        'institution_accept',
        String(member.id),
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil bergabung dengan ${member.institution_name}`,
      institutionName: member.institution_name,
    });
  } catch (error: any) {
    console.error('Accept invitation error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
