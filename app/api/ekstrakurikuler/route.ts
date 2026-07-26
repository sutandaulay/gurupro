import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { requireSchoolAccess } from '@/lib/school-access';
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

    if (filters.schoolId) await requireSchoolAccess(filters.schoolId)

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
 * Body: { namaEkskul, kelasId, pembinaMemberId?, pembinaUserId? }
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

    // Verify school access via kelas
    const kelasCheck = await query("SELECT c.school_id FROM classes c WHERE c.id = $1", [input.kelasId]);
    if (!kelasCheck.rows[0]) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
    }
    await requireSchoolAccess(kelasCheck.rows[0].school_id);

    const result = await createEkstrakurikuler({
      namaEkskul: input.namaEkskul,
      kelasId: input.kelasId,
      pembinaMemberId: input.pembinaMemberId,
      pembinaUserId: input.pembinaUserId,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/ekstrakurikuler error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * PUT /api/ekstrakurikuler
 * Body: { id, namaEkskul?, pembinaMemberId?, pembinaUserId? }
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

    // Verify school access via ekskul → kelas
    const ekskulCheck = await query(
      "SELECT c.school_id FROM ekstrakurikuler e JOIN classes c ON c.id = e.kelas_id WHERE e.id = $1",
      [input.id]
    );
    if (!ekskulCheck.rows[0]) {
      return NextResponse.json({ error: 'Ekstrakurikuler tidak ditemukan' }, { status: 404 });
    }
    await requireSchoolAccess(ekskulCheck.rows[0].school_id);

    const result = await updateEkstrakurikuler({
      id: input.id,
      namaEkskul: input.namaEkskul,
      pembinaMemberId: input.pembinaMemberId,
      pembinaUserId: input.pembinaUserId,
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('PUT /api/ekstrakurikuler error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * DELETE /api/ekstrakurikuler
 * Query params: id, school_id
 */
export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const schoolId = searchParams.get('school_id');

    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
    }
    if (!schoolId) {
      return NextResponse.json({ error: 'school_id wajib diisi' }, { status: 400 });
    }

    const check = await query(
      `SELECT e.id, c.school_id
       FROM ekstrakurikuler e
       LEFT JOIN classes c ON c.id = e.kelas_id
       WHERE e.id = $1`,
      [id]
    );
    if (!check.rows[0]) {
      return NextResponse.json({ error: 'Ekstrakurikuler tidak ditemukan' }, { status: 404 });
    }
    if (!check.rows[0].school_id || check.rows[0].school_id !== schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await requireSchoolAccess(schoolId);
    await query('DELETE FROM ekstrakurikuler WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error.message === "Forbidden" ? 403 : error.message === "Unauthorized" ? 401 : 400;
    console.error('DELETE /api/ekstrakurikuler error:', error);
    return NextResponse.json({ error: error.message }, { status });
  }
}
