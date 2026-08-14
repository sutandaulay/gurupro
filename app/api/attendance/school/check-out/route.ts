import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';
import { requireSchoolAccess } from '@/lib/school-access';

// Check-out untuk guru mandiri (sekolah mandiri via `schools` table).
// Menulis check_out_time pada baris teacher_attendance hari ini.
// Tidak menyentuh alur institusi (attendance_logs / check-out/route.ts).

export async function POST(req: Request) {
  try {
    const session = await requireSession();

    const body = await req.json();
    const { school_id } = body;
    if (!school_id) {
      return NextResponse.json({ error: 'school_id wajib diisi' }, { status: 400 });
    }

    const { userId } = await requireSchoolAccess(school_id);

    const today = new Date().toISOString().split('T')[0];

    const result = await query(
      `UPDATE teacher_attendance
       SET check_out_time = NOW()
       WHERE user_id = $1 AND school_id = $2 AND tanggal = $3
         AND check_out_time IS NULL
       RETURNING *`,
      [userId, school_id, today]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada presensi masuk hari ini untuk di-check-out' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Presensi pulang berhasil dicatat',
      record: result.rows[0],
    });
  } catch (error: any) {
    console.error('School check-out error:', error);
    const status =
      error.message === 'Unauthorized' ? 401 :
      error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status }
    );
  }
}
