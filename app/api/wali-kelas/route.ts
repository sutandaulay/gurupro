/**
 * API Route: Wali Kelas Assignments
 * Purpose: Admin UI for managing wali kelas assignments
 */

import { NextResponse } from 'next/server';
import {
  getWaliKelasAssignmentsWithDetails,
  getWaliKelasAssignments,
  assignWaliKelas,
  reassignWaliKelas,
} from '@/lib/wali-kelas';
import { query } from '@/lib/db';
import { requireSchoolAccess } from '@/lib/school-access';
import { getSession } from '@/lib/session';
import { captureError, errorResponse } from '@/lib/api-error';

// GET /api/wali-kelas
// Query params: kelas_id, tahun_ajaran, semester, status, school_id, guru_options
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Check if requesting guru options for dropdown
    const guruOptions = searchParams.get('guru_options');
    const schoolId = searchParams.get('school_id');

    if (guruOptions === 'true' && schoolId) {
      await requireSchoolAccess(schoolId);
      const options = await getGuruOptionsForSchool(schoolId);
      return NextResponse.json(options);
    }

    // Regular assignment listing
    const filters: any = {};

    if (searchParams.get('kelas_id')) {
      filters.kelasId = searchParams.get('kelas_id');
    }
    if (searchParams.get('wali_kelas_member_id')) {
      filters.waliKelasMemberId = searchParams.get('wali_kelas_member_id');
    }
    if (searchParams.get('tahun_ajaran')) {
      filters.tahunAjaran = searchParams.get('tahun_ajaran');
    }
    if (searchParams.get('semester')) {
      filters.semester = searchParams.get('semester') as 'ganjil' | 'genap';
    }
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status') as 'aktif' | 'nonaktif';
    }
    if (searchParams.get('school_id')) {
      filters.schoolId = searchParams.get('school_id');
    }

    const includeDetails = searchParams.get('include_details') !== 'false';
    const assignments = includeDetails
      ? await getWaliKelasAssignmentsWithDetails(filters)
      : await getWaliKelasAssignments(filters);

    return NextResponse.json(assignments);
  } catch (error: any) {
    captureError(error, { route: '/api/wali-kelas', method: 'GET' });
    return NextResponse.json(errorResponse(error, 'Gagal mengambil data wali kelas'));
  }
}

// POST /api/wali-kelas
// Body: { kelas_id, wali_kelas_member_id, tahun_ajaran, semester, reassign? }
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    const body = await req.json();

    const {
      kelas_id,
      wali_kelas_member_id,
      tahun_ajaran,
      semester,
      reassign,
    } = body;

    if (!kelas_id || !wali_kelas_member_id || !tahun_ajaran || !semester) {
      return NextResponse.json(
        { error: 'kelas_id, wali_kelas_member_id, tahun_ajaran, dan semester wajib diisi' },
        { status: 400 }
      );
    }

    // Verify school access
    const kelasCheck = await query(
      'SELECT school_id FROM classes WHERE id = $1',
      [kelas_id]
    );
    if (!kelasCheck.rows.length) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
    }
    await requireSchoolAccess(kelasCheck.rows[0].school_id);

    let result;
    if (reassign) {
      result = await reassignWaliKelas(
        kelas_id,
        wali_kelas_member_id,
        tahun_ajaran,
        semester,
        session.id
      );
    } else {
      result = await assignWaliKelas({
        kelasId: kelas_id,
        waliKelasMemberId: wali_kelas_member_id,
        tahunAjaran: tahun_ajaran,
        semester,
        ditugaskanOleh: session.id,
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    captureError(error, { route: '/api/wali-kelas', method: 'POST' });
    return NextResponse.json(errorResponse(error, 'Gagal menyimpan wali kelas'));
  }
}
