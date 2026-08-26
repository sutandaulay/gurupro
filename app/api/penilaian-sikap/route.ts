import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { requireSchoolAccess } from '@/lib/school-access';
import { getPayload } from '@/lib/payload';
import {
  insertPenilaianSikap,
  updatePenilaianSikap,
  getPenilaianSikap,
} from '@/lib/sikap-ekskul';
import {
  PenilaianSikapCreateSchema,
  PenilaianSikapUpdateSchema,
  PenilaianSikapQuerySchema,
} from '@/lib/schemas/sikap-ekskul';
import { parsePagination, wrapResponse } from '@/lib/pagination';
import { parseSessionCookie } from '@/lib/session-sign';
import { captureError, errorResponse } from '@/lib/api-error';

/**
 * GET /api/penilaian-sikap
 * Query params: siswaId, kelasId, periode, varian, dinilaiOleh
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filters = {
      siswaId: searchParams.get('siswaId') || undefined,
      kelasId: searchParams.get('kelasId') || undefined,
      periode: searchParams.get('periode') || undefined,
      varian: searchParams.get('varian') || undefined,
      dinilaiOleh: searchParams.get('dinilaiOleh') || undefined,
    };

    const validated = PenilaianSikapQuerySchema.parse(filters);
    const pagination = parsePagination(searchParams);
    const { data, total } = await getPenilaianSikap(validated, pagination);

    return NextResponse.json(wrapResponse(data, total, pagination));
  } catch (error: any) {
    captureError(error, { route: '/api/penilaian-sikap', method: 'GET' });
    return NextResponse.json(errorResponse(error, 'Gagal mengambil data penilaian sikap'));
  }
}

/**
 * POST /api/penilaian-sikap
 * Body: { siswaId, kelasId, periode, varian, penilaianPerDimensi, deskripsiUmum }
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    // Get actor's member ID from institution-members
    const payload = await getPayload();
    const memberResult = await payload.find({
      collection: 'institution-members',
      where: {
        appUserId: { equals: session.id },
        status: { equals: 'active' },
      },
      limit: 1,
    });

    const actorMemberId = memberResult.docs.length > 0
      ? String(memberResult.docs[0].appUserId || memberResult.docs[0].id)
      : session.id;

    const body = await req.json();
    const input = PenilaianSikapCreateSchema.parse(body);

    const result = await insertPenilaianSikap(input, actorMemberId);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    captureError(error, { route: '/api/penilaian-sikap', method: 'POST' });
    return NextResponse.json(errorResponse(error, 'Gagal menyimpan penilaian sikap'));
  }
}

/**
 * PUT /api/penilaian-sikap
 * Body: { id, penilaianPerDimensi?, deskripsiUmum? }
 */
export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    const payload = await getPayload();
    const memberResult = await payload.find({
      collection: 'institution-members',
      where: {
        appUserId: { equals: session.id },
        status: { equals: 'active' },
      },
      limit: 1,
    });

    const actorMemberId = memberResult.docs.length > 0
      ? String(memberResult.docs[0].appUserId || memberResult.docs[0].id)
      : session.id;

    const body = await req.json();
    const input = PenilaianSikapUpdateSchema.parse(body);

    const result = await updatePenilaianSikap(input, actorMemberId);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    captureError(error, { route: '/api/penilaian-sikap', method: 'PUT' });
    return NextResponse.json(errorResponse(error, 'Gagal mengupdate penilaian sikap'));
  }
}
