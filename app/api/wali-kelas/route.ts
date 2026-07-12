/**
 * API Route: Wali Kelas Assignments
 * Purpose: Admin UI for managing wali kelas assignments
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getWaliKelasAssignmentsWithDetails,
  getWaliKelasAssignments,
  assignWaliKelas,
  updateWaliKelasStatus,
  reassignWaliKelas,
  getKelasForWaliKelas,
} from '@/lib/wali-kelas';
import { getGuruOptionsForSchool } from '@/lib/wali-kelas';
import { query } from '@/lib/db';

async function getUserId() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session')?.value;
  if (!sessionCookie) {
    throw new Error('Unauthorized');
  }
  const session = JSON.parse(sessionCookie);
  return session.id;
}

async function verifySchoolOwner(schoolId: string, userId: string) {
  const check = await query(
    'SELECT id FROM schools WHERE id = $1 AND user_id = $2',
    [schoolId, userId]
  );
  if (check.rows.length === 0) {
    throw new Error('Forbidden');
  }
}

// GET /api/wali-kelas
// Query params: kelas_id, tahun_ajaran, semester, status, school_id, guru_options
export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);

    // Check if requesting guru options for dropdown
    const guruOptions = searchParams.get('guru_options');
    const schoolId = searchParams.get('school_id');

    if (guruOptions === 'true' && schoolId) {
      await verifySchoolOwner(schoolId, userId);
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
    console.error('Wali Kelas GET error:', error);
    const status =
      error.message === 'Unauthorized'
        ? 401
        : error.message === 'Forbidden'
          ? 403
          : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}

// POST /api/wali-kelas
// Body: { kelas_id, wali_kelas_member_id, tahun_ajaran, semester, reassign? }
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
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

    // Verify school ownership
    const kelasCheck = await query(
      'SELECT school_id FROM classes WHERE id = $1',
      [kelas_id]
    );
    if (!kelasCheck.rows.length) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
    }
    await verifySchoolOwner(kelasCheck.rows[0].school_id, userId);

    let result;
    if (reassign) {
      // Deactivate existing and create new
      result = await reassignWaliKelas(
        kelas_id,
        wali_kelas_member_id,
        tahun_ajaran,
        semester,
        userId
      );
    } else {
      result = await assignWaliKelas({
        kelasId: kelas_id,
        waliKelasMemberId: wali_kelas_member_id,
        tahunAjaran: tahun_ajaran,
        semester,
        ditugaskanOleh: userId,
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Wali Kelas POST error:', error);
    const status =
      error.message === 'Unauthorized'
        ? 401
        : error.message === 'Forbidden'
          ? 403
          : error.message?.includes('tidak ditemukan') || error.message?.includes('sudah punya')
            ? 400
            : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
