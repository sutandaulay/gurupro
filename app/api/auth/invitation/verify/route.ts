import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/auth/invitation/verify
 * Verify an invitation token and return details
 * Query param: token
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token undangan diperlukan' },
        { status: 400 }
      );
    }

    const invitation = await query(
      `SELECT pi.id, pi.institution_id, pi.invited_email, pi.invited_phone,
              pi.status, pi.expires_at, pi.invited_by_id,
              i.name as institution_name, i.logo_url as institution_logo,
              cu.name as invited_by_name
       FROM payload.invitations pi
       JOIN institutions i ON i.id = pi.institution_id
       LEFT JOIN payload.cms_users cu ON cu.id = pi.invited_by_id
       WHERE pi.token = $1
       LIMIT 1`,
      [token]
    );

    if (invitation.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Token undangan tidak ditemukan' },
        { status: 404 }
      );
    }

    const inv = invitation.rows[0];

    // Check if expired
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Undangan sudah kedaluwarsa' },
        { status: 410 }
      );
    }

    // Check if already accepted
    if (inv.status === 'accepted') {
      return NextResponse.json(
        { success: false, error: 'Undangan sudah digunakan' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: inv.id,
        institutionId: inv.institution_id,
        institutionName: inv.institution_name,
        institutionLogo: inv.institution_logo,
        invitedEmail: inv.invited_email,
        invitedPhone: inv.invited_phone,
        invitedByName: inv.invited_by_name,
        expiresAt: inv.expires_at,
      }
    });

  } catch (error) {
    console.error('Invitation verify error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
