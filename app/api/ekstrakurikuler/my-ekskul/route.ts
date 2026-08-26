import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPayload } from '@/lib/payload';
import { getEkstrakurikuler } from '@/lib/sikap-ekskul';
import { parseSessionCookie } from '@/lib/session-sign';
import { captureError, errorResponse } from '@/lib/api-error';

/**
 * GET /api/ekstrakurikuler/my-ekskul
 * Returns ekstrakurikuler where current user is the pembina.
 *
 * Supports BOTH institution mode and individual mode:
 * - Institution mode: look up institution_members.id via appUserId, filter by
 *   pembina_member_id (Payload UUID) OR pembina_user_id (users UUID).
 * - Individual mode: if no institution_members row found, fall through and query
 *   by pembina_user_id = session.id directly.
 *
 * Previously this endpoint REQUIRED an institution_members lookup and would
 * return 403 for individual teachers. The fix allows individual teachers to
 * see their ekskul via the pembina_user_id path.
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = parseSessionCookie(sessionCookie);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    const userId = session.id;

    // Try to resolve institution_members.id for this user (institution mode).
    // This is a Payload UUID used in the pembina_member_id column.
    // If the user has no institution membership, memberId stays null (individual mode).
    let memberId: string | null = null;
    try {
      const payload = await getPayload();
      const memberResult = await payload.find({
        collection: 'institution-members',
        where: {
          appUserId: { equals: userId },
          status: { equals: 'active' },
        },
        limit: 1,
      });

      if (memberResult.docs.length > 0) {
        // memberResult.docs[0].id is the Payload UUID (institution_members.id).
        // This is the correct value for comparing against pembina_member_id column.
        memberId = String(memberResult.docs[0].id);
      }
    } catch {
      // Payload lookup failed — treat as individual mode.
    }

    // Branch: institution mode vs individual mode.
    // getEkstrakurikuler with pembinaMemberId triggers the OR clause
    // (pembina_member_id OR pembina_user_id).
    // getEkstrakurikuler with pembinaUserId (no pembinaMemberId) uses only
    // pembina_user_id direct filter.
    let data: any[];
    if (memberId) {
      // Institution mode: filter by institution member ID (Payload UUID) or users ID.
      const result = await getEkstrakurikuler({ pembinaMemberId: memberId });
      data = result.data;
    } else {
      // Individual mode: filter by pembina_user_id = users.id directly.
      const result = await getEkstrakurikuler({ pembinaUserId: userId });
      data = result.data;
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    captureError(error, { route: '/api/ekstrakurikuler/my-ekskul' });
    return NextResponse.json(errorResponse(error, 'Gagal mengambil data ekstrakurikuler'));
  }
}
