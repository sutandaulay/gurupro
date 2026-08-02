import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireSchoolAccess } from '@/lib/school-access';
import { getPayload } from '@/lib/payload';
import {
  insertPenilaianEkstrakurikuler,
  updatePenilaianEkstrakurikuler,
  getPenilaianEkstrakurikuler,
} from '@/lib/sikap-ekskul';
import {
  PenilaianEkstrakurikulerCreateSchema,
  PenilaianEkstrakurikulerUpdateSchema,
  PenilaianEkstrakurikulerQuerySchema,
} from '@/lib/schemas/sikap-ekskul';
import { parsePagination, wrapResponse } from '@/lib/pagination';

/**
 * GET /api/penilaian-ekskul
 * Query params: siswaId, ekstrakurikulerId, periode, dinilaiOleh
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filters = {
      siswaId: searchParams.get('siswaId') || undefined,
      ekstrakurikulerId: searchParams.get('ekstrakurikulerId') || undefined,
      periode: searchParams.get('periode') || undefined,
      dinilaiOleh: searchParams.get('dinilaiOleh') || undefined,
    };

    const validated = PenilaianEkstrakurikulerQuerySchema.parse(filters);
    const pagination = parsePagination(searchParams);
    const { data, total } = await getPenilaianEkstrakurikuler(validated, pagination);

    return NextResponse.json(wrapResponse(data, total, pagination));
  } catch (error: any) {
    console.error('GET /api/penilaian-ekskul error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * POST /api/penilaian-ekskul
 * Body: { siswaId, ekstrakurikulerId, periode, predikat, deskripsi }
 */
export async function POST(req: Request) {
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
    const actorMemberId = String(memberResult.docs[0].id);

    const body = await req.json();
    const input = PenilaianEkstrakurikulerCreateSchema.parse(body);

    const result = await insertPenilaianEkstrakurikuler(input, actorMemberId);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/penilaian-ekskul error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * PUT /api/penilaian-ekskul
 * Body: { id, predikat?, deskripsi? }
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
    const actorMemberId = String(memberResult.docs[0].id);

    const body = await req.json();
    const input = PenilaianEkstrakurikulerUpdateSchema.parse(body);

    const result = await updatePenilaianEkstrakurikuler(input, actorMemberId);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('PUT /api/penilaian-ekskul error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
