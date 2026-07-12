import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPayload } from '@/lib/payload';
import { getEkstrakurikuler } from '@/lib/sikap-ekskul';

/**
 * GET /api/ekstrakurikuler/my-ekskul
 * Returns ekstrakurikuler where current user is the pembina
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);

    // Get current user's member ID
    const payload = await getPayload();
    const memberResult = await payload.find({
      collection: 'institution-members',
      where: {
        appUserId: { equals: session.id },
        status: { equals: 'active' },
      },
      limit: 1,
    });

    if (!memberResult.docs.length) {
      return NextResponse.json({ error: 'Member tidak ditemukan' }, { status: 403 });
    }
    const memberId = String(memberResult.docs[0].id);

    // Get ekskul for this pembina
    const ekskulList = await getEkstrakurikuler({ pembinaMemberId: memberId });

    return NextResponse.json({ data: ekskulList });
  } catch (error: any) {
    console.error('GET /api/ekstrakurikuler/my-ekskul error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
