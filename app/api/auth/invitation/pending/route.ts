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
 * GET /api/auth/invitation/pending
 * Check if user has a pending invitation (from localStorage token or DB record)
 * Query param: token (optional, from localStorage)
 */
export async function GET(request: Request) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // If token provided (from localStorage), verify it and return details
    if (token) {
      const invitation = await query(
        `SELECT pi.id as invitation_id, pi.institution_id, pi.invited_email, pi.invited_phone,
                pi.status as invitation_status, pi.expires_at,
                i.name as institution_name, i.logo_url as institution_logo
         FROM payload.invitations pi
         JOIN institutions i ON i.id = pi.institution_id
         WHERE pi.token = $1
         LIMIT 1`,
        [token]
      );

      if (invitation.rows.length === 0) {
        return NextResponse.json({ hasPending: false, invitation: null });
      }

      const inv = invitation.rows[0];

      // Check if expired
      if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
        return NextResponse.json({ hasPending: false, invitation: null, expired: true });
      }

      // Check if already accepted
      if (inv.invitation_status === 'accepted') {
        return NextResponse.json({ hasPending: false, invitation: null, alreadyAccepted: true });
      }

      return NextResponse.json({
        hasPending: true,
        invitation: {
          invitationId: inv.invitation_id,
          institutionId: inv.institution_id,
          institutionName: inv.institution_name,
          institutionLogo: inv.institution_logo,
          invitedEmail: inv.invited_email,
          invitedPhone: inv.invited_phone,
          expiresAt: inv.expires_at,
        }
      });
    }

    // Check user's pending_invitation_token in DB
    const user = await query(
      'SELECT pending_invitation_token FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0 || !user.rows[0].pending_invitation_token) {
      return NextResponse.json({ hasPending: false, invitation: null });
    }

    // Recursively check with the token from DB
    const pendingToken = user.rows[0].pending_invitation_token;
    const invitation = await query(
      `SELECT pi.id as invitation_id, pi.institution_id, pi.invited_email, pi.invited_phone,
              pi.status as invitation_status, pi.expires_at,
              i.name as institution_name, i.logo_url as institution_logo
       FROM payload.invitations pi
       JOIN institutions i ON i.id = pi.institution_id
       WHERE pi.token = $1
       LIMIT 1`,
      [pendingToken]
    );

    if (invitation.rows.length === 0) {
      return NextResponse.json({ hasPending: false, invitation: null });
    }

    const inv = invitation.rows[0];

    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ hasPending: false, invitation: null, expired: true });
    }

    if (inv.invitation_status === 'accepted') {
      return NextResponse.json({ hasPending: false, invitation: null, alreadyAccepted: true });
    }

    return NextResponse.json({
      hasPending: true,
      invitation: {
        invitationId: inv.invitation_id,
        institutionId: inv.institution_id,
        institutionName: inv.institution_name,
        institutionLogo: inv.institution_logo,
        invitedEmail: inv.invited_email,
        invitedPhone: inv.invited_phone,
        expiresAt: inv.expires_at,
      }
    });

  } catch (error: any) {
    console.error('Pending invitation check error:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
