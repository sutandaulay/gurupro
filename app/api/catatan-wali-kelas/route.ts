import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPayload } from '@/lib/payload';
import {
  upsertCatatanWaliKelas,
  getCatatanWaliKelas,
} from '@/lib/sikap-ekskul';
import {
  CatatanWaliKelasCreateSchema,
  CatatanWaliKelasUpdateSchema,
  CatatanWaliKelasQuerySchema,
} from '@/lib/schemas/sikap-ekskul';
import { parsePagination, wrapResponse } from '@/lib/pagination';
import { parseSessionCookie } from '@/lib/session-sign';
import { captureError, errorResponse } from '@/lib/api-error';

/**
 * GET /api/catatan-wali-kelas
 * Query params: siswaId, kelasId, periode, ditulisOleh
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filters = {
      siswaId: searchParams.get('siswaId') || undefined,
      kelasId: searchParams.get('kelasId') || undefined,
      periode: searchParams.get('periode') || undefined,
      ditulisOleh: searchParams.get('ditulisOleh') || undefined,
    };

    const validated = CatatanWaliKelasQuerySchema.parse(filters);
    const pagination = parsePagination(searchParams);
    const { data, total } = await getCatatanWaliKelas(validated, pagination);

    return NextResponse.json(wrapResponse(data, total, pagination));
  } catch (error: any) {
    captureError(error, { route: '/api/catatan-wali-kelas', method: 'GET' });
    return NextResponse.json(errorResponse(error, 'Gagal mengambil data catatan'));
  }
}

/**
 * POST /api/catatan-wali-kelas
 * Body: { siswaId, kelasId, periode, catatan }
 */
export async function POST(req: Request) {
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

    const payload = await getPayload();
    const memberResult = await payload.find({
      collection: 'institution-members',
      where: {
        appUserId: { equals: session.id },
        status: { equals: 'active' },
      },
      limit: 1,
    });

    const body = await req.json();
    const input = CatatanWaliKelasCreateSchema.parse(body);

    // Resolve actorMemberId (users UUID):
    // - Institution mode: memberResult.docs[0].appUserId = users UUID from institution_members
    // - Individual mode: session.id (users UUID) directly
    let actorMemberId: string;
    if (memberResult.docs.length > 0) {
      // appUserId is the users UUID stored in institution_members — matches session.id
      actorMemberId = String(memberResult.docs[0].appUserId || memberResult.docs[0].id);
    } else {
      // Individual mode: session.id is the users UUID
      actorMemberId = session.id;
    }

    const result = await upsertCatatanWaliKelas(input, actorMemberId);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    captureError(error, { route: '/api/catatan-wali-kelas', method: 'POST' });
    return NextResponse.json(errorResponse(error, 'Gagal menyimpan catatan'));
  }
}

/**
 * PUT /api/catatan-wali-kelas
 * Body: { id, catatan }
 */
export async function PUT(req: Request) {
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
    const { id, catatan } = body;

    if (!id || !catatan) {
      return NextResponse.json({ error: 'id dan catatan wajib diisi' }, { status: 400 });
    }

    // Get existing catatan to check RBAC
    const { query } = await import('@/lib/db');
    const existing = await query(
      'SELECT * FROM catatan_wali_kelas WHERE id = $1',
      [id]
    );

    if (!existing.rows.length) {
      return NextResponse.json({ error: 'Catatan tidak ditemukan' }, { status: 404 });
    }

    // RBAC: Only the original writer can update
    if (existing.rows[0].ditulis_oleh !== actorMemberId) {
      return NextResponse.json(
        { error: 'Hanya penulis asli yang bisa mengubah catatan ini' },
        { status: 403 }
      );
    }

    const result = await query(
      `UPDATE catatan_wali_kelas SET catatan = $1, updated_at = now() WHERE id = $2::uuid RETURNING *`,
      [catatan, id]
    );

    return NextResponse.json({
      data: {
        id: result.rows[0].id,
        siswaId: result.rows[0].siswa_id,
        kelasId: result.rows[0].kelas_id,
        periode: result.rows[0].periode,
        catatan: result.rows[0].catatan,
        ditulisOleh: result.rows[0].ditulis_oleh,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      }
    });
  } catch (error: any) {
    captureError(error, { route: '/api/catatan-wali-kelas', method: 'PUT' });
    return NextResponse.json(errorResponse(error, 'Gagal mengupdate catatan'));
  }
}
