import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

/**
 * GET /api/wali-kelas/my-classes
 * Returns classes where current user is the homeroom teacher (wali kelas)
 * based on classes.wali_kelas_user_id (set from Master Data checkbox)
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);

    // Get classes where current user is set as wali kelas (from Master Data)
    const result = await query(
      'SELECT id, nama_kelas FROM classes WHERE wali_kelas_user_id = $1 ORDER BY nama_kelas ASC',
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
