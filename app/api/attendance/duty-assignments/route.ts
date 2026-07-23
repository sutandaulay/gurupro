import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = session.id;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    let sql = `
      SELECT 
        id,
        teacher_id,
        school_id,
        institution_id,
        date,
        purpose,
        location_latitude as "locationLatitude",
        location_longitude as "locationLongitude",
        radius_meters,
        status,
        approved_by,
        created_at
      FROM duty_assignments
      WHERE teacher_id = $1
    `;
    const params: any[] = [teacherId];

    if (date) {
      sql += ` AND date = $${params.length + 1}`;
      params.push(date);
    }

    sql += ` ORDER BY date DESC, created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows || [] });
  } catch (error: any) {
    console.error('Get duty assignments error:', error);
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = session.id;
    const body = await req.json();
    const { date, purpose, location_latitude, location_longitude, radius_meters } = body;

    if (!date) {
      return NextResponse.json({ error: 'Tanggal wajib diisi' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO duty_assignments 
        (teacher_id, date, purpose, location_latitude, location_longitude, radius_meters, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW()) 
       RETURNING *`,
      [
        teacherId,
        date,
        purpose || null,
        location_latitude || null,
        location_longitude || null,
        radius_meters || 50,
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Create duty assignment error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
