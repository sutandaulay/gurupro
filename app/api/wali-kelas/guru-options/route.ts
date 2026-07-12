/**
 * API Route: Guru Options for Wali Kelas Dropdown
 * Purpose: Get list of guru members for a school to populate dropdown
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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

// GET /api/wali-kelas/guru-options?school_id=xxx
export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('school_id');

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id wajib diisi' }, { status: 400 });
    }

    await verifySchoolOwner(schoolId, userId);

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
