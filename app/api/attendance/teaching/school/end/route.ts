import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';
import { differenceInMinutes } from 'date-fns';

const EndSchoolTeachingSchema = z.object({
  sessionId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().min(0),
  faceMatchScore: z.number().min(0).max(1).optional(),
  livenessPassed: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = EndSchoolTeachingSchema.parse(body);

    // Get the active session
    const sessionResult = await query(
      `SELECT id, user_id, school_id, started_at FROM school_teaching_sessions 
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       LIMIT 1`,
      [data.sessionId, session.id]
    );

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Sesi mengajar tidak ditemukan atau sudah selesai' }, { status: 404 });
    }

    const teachingSession = sessionResult.rows[0];
    const endedAt = new Date();
    const startedAt = new Date(teachingSession.started_at);
    const durationMinutes = differenceInMinutes(endedAt, startedAt);

    // Update session to completed
    const result = await query(
      `UPDATE school_teaching_sessions 
       SET ended_at = $1, duration_minutes = $2, latitude = $3, longitude = $4, 
           accuracy = $5, face_match_score = $6, liveness_passed = $7, status = 'completed'
       WHERE id = $8
       RETURNING *`,
      [
        endedAt.toISOString(),
        durationMinutes,
        data.latitude,
        data.longitude,
        data.accuracy,
        data.faceMatchScore || null,
        data.livenessPassed || false,
        data.sessionId,
      ]
    );

    return NextResponse.json({
      success: true,
      session: result.rows[0],
      durationMinutes,
    });
  } catch (error: any) {
    console.error('End school teaching error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
