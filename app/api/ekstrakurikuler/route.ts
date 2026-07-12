import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPayload } from '@/lib/payload';
import {
  createEkstrakurikuler,
  updateEkstrakurikuler,
  getEkstrakurikuler,
} from '@/lib/sikap-ekskul';
import {
  EkstrakurikulerCreateSchema,
  EkstrakurikulerUpdateSchema,
  EkstrakurikulerQuerySchema,
} from '@/lib/schemas/sikap-ekskul';

/**
 * GET /api/ekstrakurikuler
 * Query params: kelasId, pembinaMemberId, schoolId
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filters = {
      kelasId: searchParams.get('kelasId') || undefined,
      pembinaMemberId: searchParams.get('pembinaMemberId') || undefined,
      schoolId: searchParams.get('schoolId') || undefined,
    };

    const validated = EkstrakurikulerQuerySchema.parse(filters);
    const result = await getEkstrakurikuler(validated);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('GET /api/ekstrakurikuler error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * POST /api/ekstrakurikuler
 * Body: { namaEkskul, kelasId, pembinaMemberId }
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    const body = await req.json();
    const input = EkstrakurikulerCreateSchema.parse(body);

    const result = await createEkstrakurikuler(input);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/ekstrakurikuler error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * PUT /api/ekstrakurikuler
 * Body: { id, namaEkskul?, pembinaMemberId? }
 */
export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    const body = await req.json();
    const input = EkstrakurikulerUpdateSchema.parse(body);

    const result = await updateEkstrakurikuler(input);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('PUT /api/ekstrakurikuler error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
