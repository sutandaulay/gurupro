import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const npsn = searchParams.get('npsn');

    if (!npsn || npsn.trim().length < 4) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const result = await query(
      `SELECT id, name, jenjang, status FROM institutions WHERE npsn = $1 AND status = 'active' LIMIT 1`,
      [npsn.trim()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json({ found: true, institution: result.rows[0] }, { status: 200 });
  } catch {
    return NextResponse.json({ found: false, error: 'Terjadi kesalahan' }, { status: 500 });
  }
}
