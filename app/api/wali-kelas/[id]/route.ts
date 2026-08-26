/**
 * API Route: Wali Kelas Assignment by ID
 * Purpose: Update or delete specific assignment
 */

import { NextResponse } from 'next/server';
import { updateWaliKelasStatus } from '@/lib/wali-kelas';
import { query } from '@/lib/db';
import { requireSchoolAccess } from '@/lib/school-access';
import { captureError, errorResponse } from '@/lib/api-error';

// PUT /api/wali-kelas/[id]
// Body: { status }
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { status } = body;

    if (!status || !['aktif', 'nonaktif'].includes(status)) {
      return NextResponse.json(
        { error: 'Status harus aktif atau nonaktif' },
        { status: 400 }
      );
    }

    // Verify access by checking if the kelas belongs to user's school
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
    await requireSchoolAccess(school_id);

    const result = await updateWaliKelasStatus(id, status);
    return NextResponse.json(result);
  } catch (error: any) {
    captureError(error, { route: '/api/wali-kelas/[id]', method: 'PUT' });
    return NextResponse.json(errorResponse(error, 'Gagal mengupdate wali kelas'));
  }
}

// DELETE /api/wali-kelas/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify access
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
    await requireSchoolAccess(school_id);

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
    captureError(error, { route: '/api/wali-kelas/[id]', method: 'DELETE' });
    return NextResponse.json(errorResponse(error, 'Gagal menghapus wali kelas'));
  }
}
