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
    console.error('GET /api/penilaian-sikap error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * POST /api/penilaian-sikap
 * Body: { siswaId, kelasId, periode, varian, penilaianPerDimensi, deskripsiUmum }
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);

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

    if (!memberResult.docs.length) {
      return NextResponse.json({ error: 'Member tidak ditemukan atau tidak aktif' }, { status: 403 });
    }
    const actorMemberId = String(memberResult.docs[0].appUserId || memberResult.docs[0].id);

    const body = await req.json();
    const input = PenilaianSikapCreateSchema.parse(body);

    const result = await insertPenilaianSikap(input, actorMemberId);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/penilaian-sikap error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * PUT /api/penilaian-sikap
 * Body: { id, penilaianPerDimensi?, deskripsiUmum? }
 */
export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);

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
      return NextResponse.json({ error: 'Member tidak ditemukan atau tidak aktif' }, { status: 403 });
    }
    const actorMemberId = String(memberResult.docs[0].appUserId || memberResult.docs[0].id);

    const body = await req.json();
    const input = PenilaianSikapUpdateSchema.parse(body);

    const result = await updatePenilaianSikap(input, actorMemberId);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('PUT /api/penilaian-sikap error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
