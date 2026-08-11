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

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const todayDay = days[new Date().getDay()];

    // 1. Fetch schedules via user_school_assignments (institutional teachers)
    const institutionSchedules = await pgQuery(
      `SELECT sc.id, sc.school_id, sc.class_id, sc.subject_id, sc.hari, 
              sc.jam_mulai, sc.jam_selesai, c.nama_kelas, sb.nama_mapel,
              i.id as institution_id, s.nama_sekolah as school_name
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

    // 2. Fetch schedules for independent teachers who own their own schools
    const schoolBasedSchedules = await pgQuery(
      `SELECT sc.id, sc.school_id, sc.class_id, sc.subject_id, sc.hari, 
              sc.jam_mulai, sc.jam_selesai, c.nama_kelas, sb.nama_mapel,
              NULL as institution_id, s.nama_sekolah as school_name
       FROM schedules sc
       JOIN classes c ON sc.class_id = c.id
       JOIN subjects sb ON sc.subject_id = sb.id
       JOIN schools s ON sc.school_id = s.id
       WHERE s.user_id = $1 AND sc.hari = $2
       ORDER BY sc.jam_mulai ASC`,
      [userId, todayDay]
    );

    // Merge and deduplicate by schedule id
    const scheduleMap = new Map();
    for (const row of [...institutionSchedules.rows, ...schoolBasedSchedules.rows]) {
      scheduleMap.set(row.id, row);
    }
    const schedules = Array.from(scheduleMap.values());

    // 3. Fetch teaching session logs for today from both attendance_logs and teacher_attendance
    const logsResult = await pgQuery(
      `SELECT id, type, class_session_id, timestamp, institution_id, NULL as school_id
       FROM attendance_logs
       WHERE teacher_id = $1 AND timestamp >= CURRENT_DATE AND timestamp < CURRENT_DATE + 1
       UNION ALL
       SELECT id, 'mengajar_mulai' as type, NULL as class_session_id, created_at as timestamp, NULL as institution_id, school_id
       FROM teacher_attendance
       WHERE user_id = $1 AND tanggal = CURRENT_DATE AND catatan LIKE 'Presensi%mengajar%'
       ORDER BY timestamp ASC`,
      [userId]
    );

    const logs = logsResult.rows;

    // 3b. Fetch school_teaching_sessions for today (mulai via Selesai Mengajar / school attendance)
    const schoolSessionsResult = await pgQuery(
      `SELECT id, school_id, subject_id, class_id, started_at, ended_at, status
       FROM school_teaching_sessions
       WHERE user_id = $1 AND started_at >= CURRENT_DATE AND started_at < CURRENT_DATE + 1`,
      [userId]
    );

    const schoolSessions = schoolSessionsResult.rows;

    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMin = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMin}`;

    const formattedSchedules = schedules.map((row: any) => {
      const startLog = logs.find((l: any) => l.class_session_id === row.id && l.type === 'mengajar_mulai');
      const endLog = logs.find((l: any) => l.class_session_id === row.id && l.type === 'mengajar_selesai');

      // Match school teaching session by school_id + subject_id + class_id
      const schoolSession = schoolSessions.find(
        (s: any) =>
          String(s.school_id) === String(row.school_id) &&
          s.subject_id &&
          String(s.subject_id) === String(row.subject_id) &&
          s.class_id &&
          String(s.class_id) === String(row.class_id)
      );
      const schoolStarted = schoolSession && schoolSession.status === 'active';
      const schoolEnded = schoolSession && schoolSession.status === 'completed';

      let status: 'upcoming' | 'ongoing' | 'completed' | 'missed' = 'upcoming';
      let teachingSession: any = null;

      if (startLog || schoolStarted) {
        const startTime = schoolSession?.started_at || startLog?.timestamp;
        if (endLog || schoolEnded) {
          status = 'completed';
          teachingSession = {
            id: schoolSession?.id || startLog.id,
            startTime,
            endTime: schoolSession?.ended_at || endLog?.timestamp,
          };
        } else {
          status = 'ongoing';
          teachingSession = {
            id: schoolSession?.id || startLog.id,
            startTime,
          };
        }
      } else {
        if (currentTimeStr > row.jam_selesai) {
          status = 'missed';
        } else if (currentTimeStr >= row.jam_mulai && currentTimeStr <= row.jam_selesai) {
          status = 'upcoming';
        }
      }

      return {
        id: row.id,
        institutionId: row.institution_id ? row.institution_id.toString() : (row.school_id || '1'),
        subjectId: row.subject_id,
        subjectName: row.nama_mapel,
        className: row.nama_kelas,
        startTime: row.jam_mulai.slice(0, 5),
        endTime: row.jam_selesai.slice(0, 5),
        status,
        teachingSession,
        schoolId: row.school_id,
        schoolName: row.school_name,
      };
    });

    return NextResponse.json(formattedSchedules);
  } catch (error: any) {
    console.error('Error fetching today schedule:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
