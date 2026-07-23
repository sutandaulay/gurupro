import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';

const StartSchoolTeachingSchema = z.object({
  schoolId: z.string().uuid(),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
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
    const data = StartSchoolTeachingSchema.parse(body);

    // Check if there's an active session for this user/school
    const activeSession = await query(
      `SELECT id FROM school_teaching_sessions 
       WHERE user_id = $1 AND school_id = $2 AND status = 'active'
       LIMIT 1`,
      [session.id, data.schoolId]
    );

    if (activeSession.rows.length > 0) {
      return NextResponse.json({ 
        error: 'Anda masih memiliki sesi mengajar yang aktif',
        activeSessionId: activeSession.rows[0].id 
      }, { status: 400 });
    }

    // Create new teaching session
    const result = await query(
      `INSERT INTO school_teaching_sessions 
        (user_id, school_id, subject_id, class_id, started_at, latitude, longitude, accuracy, face_match_score, liveness_passed, status) 
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, 'active') 
       RETURNING *`,
      [
        session.id,
        data.schoolId,
        data.subjectId || null,
        data.classId || null,
        data.latitude,
        data.longitude,
        data.accuracy,
        data.faceMatchScore || null,
        data.livenessPassed || false,
      ]
    );

    return NextResponse.json({
      success: true,
      session: result.rows[0],
    });
  } catch (error: any) {
    console.error('Start school teaching error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
