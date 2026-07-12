/**
 * API Route: Wali Kelas Assignment by ID
 * Purpose: Update or delete specific assignment
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  updateWaliKelasStatus,
} from '@/lib/wali-kelas';
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

// PUT /api/wali-kelas/[id]
// Body: { status }
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    const body = await req.json();

    const { status } = body;

    if (!status || !['aktif', 'nonaktif'].includes(status)) {
      return NextResponse.json(
        { error: 'Status harus aktif atau nonaktif' },
        { status: 400 }
      );
    }

    // Verify ownership by checking if the kelas belongs to user's school
    const assignmentCheck = await query(
      `SELECT w.kelas_id, c.school_id
       FROM wali_kelas_assignments w
       JOIN classes c ON w.kelas_id = c.id
       WHERE w.id = $1`,
      [id]
    );

    if (!assignmentCheck.rows.length) {
      return NextResponse.json({ error: 'Assignment tidak ditemukan' }, { status: 404 });
    }

    const { school_id } = assignmentCheck.rows[0];
    await verifySchoolOwner(school_id, userId);

    const result = await updateWaliKelasStatus(id, status);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Wali Kelas PUT error:', error);
    const status =
      error.message === 'Unauthorized'
        ? 401
        : error.message === 'Forbidden'
          ? 403
          : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}

// DELETE /api/wali-kelas/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;

    // Verify ownership
    const assignmentCheck = await query(
      `SELECT w.kelas_id, c.school_id
       FROM wali_kelas_assignments w
       JOIN classes c ON w.kelas_id = c.id
       WHERE w.id = $1`,
      [id]
    );

    if (!assignmentCheck.rows.length) {
      return NextResponse.json({ error: 'Assignment tidak ditemukan' }, { status: 404 });
    }

    const { school_id } = assignmentCheck.rows[0];
    await verifySchoolOwner(school_id, userId);

    // Only allow deleting non-aktif assignments
    const statusCheck = await query(
      'SELECT status FROM wali_kelas_assignments WHERE id = $1',
      [id]
    );

    if (statusCheck.rows[0]?.status === 'aktif') {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus assignment aktif. Nonaktifkan dulu.' },
        { status: 400 }
      );
    }

    await query('DELETE FROM wali_kelas_assignments WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'Assignment berhasil dihapus' });
  } catch (error: any) {
    console.error('Wali Kelas DELETE error:', error);
    const status =
      error.message === 'Unauthorized'
        ? 401
        : error.message === 'Forbidden'
          ? 403
          : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
