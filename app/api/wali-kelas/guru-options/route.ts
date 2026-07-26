/**
 * API Route: Guru Options for Wali Kelas Dropdown
 * Purpose: Get list of guru members for a school to populate dropdown
 */

import { NextResponse } from 'next/server';
import { getGuruOptionsForSchool } from '@/lib/wali-kelas';
import { requireSchoolAccess } from '@/lib/school-access';

// GET /api/wali-kelas/guru-options?school_id=xxx
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('school_id');

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id wajib diisi' }, { status: 400 });
    }

    await requireSchoolAccess(schoolId);

    const options = await getGuruOptionsForSchool(schoolId);
    return NextResponse.json(options);
  } catch (error: any) {
    console.error('Guru Options GET error:', error);
    const status =
      error.message === 'Unauthorized'
        ? 401
        : error.message === 'Forbidden'
          ? 403
          : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
