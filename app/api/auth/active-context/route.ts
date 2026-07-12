import { NextResponse } from 'next/server';
import { getSession, setActiveContext, requireSession } from '@/lib/session';
import { getUserAccountMode, getUserActiveMemberships } from '@/lib/institution-members';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.id;
    const mode = await getUserAccountMode(userId);

    const memberships = await getUserActiveMemberships(userId);

    const institutionIds = memberships.map((m) => m.institution_id);
    let institutions: { id: number; name: string }[] = [];
    if (institutionIds.length > 0) {
      const result = await query(
        'SELECT id, name FROM institutions WHERE id = ANY($1::int[])',
        [institutionIds]
      );
      institutions = result.rows;
    }

    return NextResponse.json({
      activeContext: session.activeContext ?? 'individual',
      mode,
      institutions,
    });
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.id;

    const body = await request.json();
    const { activeContext } = body;

    if (!activeContext) {
      return NextResponse.json(
        { error: 'activeContext wajib diisi' },
        { status: 400 }
      );
    }

    if (activeContext !== 'individual') {
      const { institutionId } = activeContext;
      if (!institutionId || typeof institutionId !== 'number') {
        return NextResponse.json(
          { error: 'activeContext.institutionId harus berupa number' },
          { status: 400 }
        );
      }

      const memberships = await getUserActiveMemberships(userId);
      const isMember = memberships.some((m) => m.institution_id === institutionId);
      if (!isMember) {
        return NextResponse.json(
          { error: 'Anda bukan anggota aktif institusi ini' },
          { status: 403 }
        );
      }
    }

    await setActiveContext(activeContext);

    return NextResponse.json({ success: true, activeContext });
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status }
    );
  }
}
