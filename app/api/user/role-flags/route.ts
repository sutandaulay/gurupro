import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { parseSessionCookie } from '@/lib/session-sign';

async function getUserId() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session.id;
}

export async function GET(req: Request) {
  try {
    const userId = await getUserId();

    const [waliResult, pembinaResult] = await Promise.all([
      query('SELECT 1 FROM classes WHERE wali_kelas_user_id = $1 LIMIT 1', [userId]),
      query('SELECT 1 FROM ekstrakurikuler WHERE pembina_user_id = $1 LIMIT 1', [userId]),
    ]);

    return NextResponse.json({
      isWaliKelas: waliResult.rows.length > 0,
      isPembinaEkskul: pembinaResult.rows.length > 0,
    });
  } catch (error: any) {
    console.error('GET /api/user/role-flags error:', error);
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
