import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { parseSessionCookie } from '@/lib/session-sign';

/**
 * GET /api/wali-kelas/my-classes
 * Returns classes where current user is the homeroom teacher (wali kelas),
 * covering BOTH:
 *  - classes.wali_kelas_user_id (set from Master Data checkbox)
 *  - wali_kelas_assignments.wali_kelas_member_id (assignment module, active only)
 * This avoids the "assignment list empty vs institution_members" mismatch.
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    // Union of Master Data path + assignment path
    const result = await query(
      `SELECT DISTINCT c.id, c.nama_kelas
       FROM classes c
       WHERE c.wali_kelas_user_id = $1
          OR c.id IN (
             SELECT DISTINCT kelas_id
             FROM wali_kelas_assignments
             WHERE wali_kelas_member_id = $1 AND status = 'aktif'
          )
       ORDER BY c.nama_kelas ASC`,
      [session.id]
    );

    return NextResponse.json({
      data: result.rows.map((k) => ({
        id: k.id,
        nama_kelas: k.nama_kelas,
      })),
    });
  } catch (error: any) {
    console.error('GET /api/wali-kelas/my-classes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
