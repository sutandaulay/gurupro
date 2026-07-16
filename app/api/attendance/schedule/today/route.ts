import { NextResponse } from 'next/server';
import { query as pgQuery } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    // 1. Get today's day of week in Indonesian
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const todayDay = days[new Date().getDay()];

    // 2. Query today's schedules for the logged-in teacher
    // We join payload.institutions to get the TAMS integer ID of the school
    const schedulesResult = await pgQuery(
      `SELECT sc.id, sc.school_id, sc.class_id, sc.subject_id, sc.hari, 
              sc.jam_mulai, sc.jam_selesai, c.nama_kelas, sb.nama_mapel,
              i.id as institution_id
       FROM schedules sc
       JOIN classes c ON sc.class_id = c.id
       JOIN subjects sb ON sc.subject_id = sb.id
       JOIN schools s ON sc.school_id = s.id
       JOIN user_school_assignments usa ON usa."schoolId" = s.id
       LEFT JOIN payload.institutions i ON i.npsn = s.npsn OR i.name = s.nama_sekolah
       WHERE usa."userId" = $1 AND sc.hari = $2
       ORDER BY sc.jam_mulai ASC`,
      [userId, todayDay]
    );

    // 3. Query all attendance logs for the teacher today to calculate session status
    const logsResult = await pgQuery(
      `SELECT id, type, class_session_id, timestamp
       FROM attendance_logs
       WHERE teacher_id = $1 AND timestamp >= CURRENT_DATE AND timestamp < CURRENT_DATE + 1
       ORDER BY timestamp ASC`,
      [userId]
    );

    const logs = logsResult.rows;

    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMin = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMin}`;

    const formattedSchedules = schedulesResult.rows.map((row: any) => {
      // Find start and end teaching logs for this schedule session
      const startLog = logs.find((l: any) => l.class_session_id === row.id && l.type === 'mengajar_mulai');
      const endLog = logs.find((l: any) => l.class_session_id === row.id && l.type === 'mengajar_selesai');

      let status = 'upcoming';
      let teachingSession = null;

      if (startLog) {
        if (endLog) {
          status = 'completed';
          teachingSession = {
            id: startLog.id,
            startTime: startLog.timestamp,
            endTime: endLog.timestamp
          };
        } else {
          status = 'ongoing';
          teachingSession = {
            id: startLog.id,
            startTime: startLog.timestamp
          };
        }
      } else {
        // If no start log and the current time is past the end time, it is missed
        if (currentTimeStr > row.jam_selesai) {
          status = 'missed';
        } else if (currentTimeStr >= row.jam_mulai && currentTimeStr <= row.jam_selesai) {
          // If current time is within schedule hours but not started, show as upcoming or ongoing
          status = 'upcoming';
        }
      }

      return {
        id: row.id,
        institutionId: row.institution_id ? row.institution_id.toString() : '1',
        subjectId: row.subject_id,
        className: row.nama_kelas,
        startTime: row.jam_mulai.slice(0, 5),
        endTime: row.jam_selesai.slice(0, 5),
        status,
        teachingSession
      };
    });

    return NextResponse.json(formattedSchedules);
  } catch (error: any) {
    console.error('Error fetching today schedule:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
