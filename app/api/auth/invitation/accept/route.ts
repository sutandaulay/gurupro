import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

async function getUserId() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session')?.value;
  if (!sessionCookie) throw new Error('Unauthorized');
  const session = JSON.parse(sessionCookie);
  return session.id;
}

/**
 * POST /api/auth/invitation/accept
 * Accept an invitation by token (for Google OAuth users who had invitation token in URL)
 * Body: { token: string }
 */
export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token undangan diperlukan' }, { status: 400 });
    }

    // 1. Verify the invitation exists and is valid
    const invitation = await query(
      `SELECT pi.id, pi.institution_id, pi.invited_email, pi.invited_phone,
              pi.status as invitation_status, pi.expires_at,
              i.name as institution_name, i.npsn
       FROM payload.invitations pi
       JOIN institutions i ON i.id = pi.institution_id
       WHERE pi.token = $1
       LIMIT 1`,
      [token]
    );

    if (invitation.rows.length === 0) {
      return NextResponse.json({ error: 'Undangan tidak ditemukan' }, { status: 404 });
    }

    const inv = invitation.rows[0];

    // Check if expired
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Undangan sudah kedaluwarsa' }, { status: 410 });
    }

    // Check if already accepted
    if (inv.invitation_status === 'accepted') {
      return NextResponse.json({ error: 'Undangan sudah diterima sebelumnya' }, { status: 409 });
    }

    // 2. Get user's email to verify it matches
    const user = await query(
      'SELECT email, whatsapp FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const userEmail = user.rows[0].email?.toLowerCase();
    const userPhone = user.rows[0].whatsapp;
    const invitedEmail = inv.invited_email?.toLowerCase();
    const invitedPhone = inv.invited_phone;

    // 3. Verify user's email/phone matches invitation (if specified)
    const emailMatch = !invitedEmail || userEmail === invitedEmail;
    const phoneMatch = !invitedPhone || userPhone === invitedPhone;

    if (!emailMatch && !phoneMatch) {
      return NextResponse.json({
        error: 'Email atau nomor WhatsApp Anda tidak cocok dengan undangan ini. Pastikan Anda menggunakan akun yang sama dengan yang diundang.'
      }, { status: 403 });
    }

    // 4. Create institution_members record if it doesn't exist
    const existingMember = await query(
      `SELECT id FROM institution_members
       WHERE institution_id = $1 AND app_user_id = $2
       LIMIT 1`,
      [inv.institution_id, userId]
    );

    if (existingMember.rows.length === 0) {
      await query(
        `INSERT INTO institution_members
         (institution_id, app_user_id, status, joined_at, created_at, updated_at)
         VALUES ($1, $2, 'active', NOW(), NOW(), NOW())`,
        [inv.institution_id, userId]
      );
    } else {
      // Update existing record to active
      await query(
        `UPDATE institution_members
         SET status = 'active', joined_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [existingMember.rows[0].id]
      );
    }

    // 5. Mark invitation as accepted
    await query(
      `UPDATE payload.invitations
       SET status = 'accepted', updated_at = NOW()
       WHERE id = $1`,
      [inv.id]
    );

    // 6. Sync to user_school_assignments
    if (inv.npsn) {
      const school = await query(
        'SELECT id FROM schools WHERE npsn = $1 LIMIT 1',
        [inv.npsn]
      );

      if (school.rows.length > 0) {
        const existing = await query(
          'SELECT id FROM user_school_assignments WHERE userid = $1 AND schoolid = $2 LIMIT 1',
          [userId, school.rows[0].id]
        );

        if (existing.rows.length === 0) {
          await query(
            'INSERT INTO user_school_assignments (userid, schoolid) VALUES ($1, $2)',
            [userId, school.rows[0].id]
          );
        }
      }
    }

    // 7. Update user's school name
    await query(
      `UPDATE users SET nama_sekolah = $1, pending_invitation_token = NULL
       WHERE id = $2 AND (nama_sekolah IS NULL OR nama_sekolah = '')`,
      [inv.institution_name, userId]
    );

    // 8. Clear pending_invitation_token if set
    await query(
      'UPDATE users SET pending_invitation_token = NULL WHERE id = $1',
      [userId]
    );

    // 9. Send notification
    try {
      await query(
        `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          'Berhasil Bergabung',
          `Anda telah bergabung dengan institusi "${inv.institution_name}".`,
          'success',
          'institution_accept',
          String(inv.id),
        ]
      );
    } catch { /* notification is non-critical */ }

    return NextResponse.json({
      success: true,
      message: `Berhasil bergabung dengan ${inv.institution_name}`,
      institutionName: inv.institution_name,
    });

  } catch (error: any) {
    console.error('Accept invitation error:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
