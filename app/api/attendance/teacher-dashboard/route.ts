import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { db } from '@/lib/db';
import {
  teacherInstitutionAssignments,
  institutions,
  attendanceLogs,
  attendanceSummary,
} from '@/lib/schemas/attendance';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { query } from '@/lib/db';

// ==========================================
// TEACHER ATTENDANCE DASHBOARD API
// Returns comprehensive data for teacher's daily attendance
// ==========================================

export async function GET(req: NextRequest) {
  try {
    // Validasi sesi pengguna
    const session = await requireSession();
    const teacherId = session.id;

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get day name in Indonesian
    const dayNames: { [key: number]: string } = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    const todayKey = dayNames[today.getDay()];

    // ==========================================
    // 1. Get all institution assignments for this teacher from payload schema
    // ==========================================
    // First, find the teacher email from public.users
    const userResult = await query("SELECT email FROM users WHERE id = $1", [teacherId]);
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }
    const email = userResult.rows[0].email;

    // Next, get the cms_users ID
    const cmsUserResult = await query("SELECT id FROM payload.cms_users WHERE email = $1", [email]);
    let assignments: any[] = [];
    
    if (cmsUserResult.rows.length > 0) {
      const cmsUserId = cmsUserResult.rows[0].id;

      // Query assignments from payload schema
      const assignmentsResult = await query(`
        SELECT 
          tia.id,
          tia.institution_id_id as "institutionId",
          i.name as "institutionName",
          i.location_latitude as "locationLatitude",
          i.location_longitude as "locationLongitude",
          i.attendance_settings_attendance_radius_meters as "attendanceRadiusMeters",
          i.attendance_settings_qr_code_enabled as "qrCodeEnabled",
          tia.subject_ids as "subjectIds",
          tia.weekly_schedule as "weeklySchedule",
          tia.status,
          tia.start_date as "startDate",
          tia.end_date as "endDate"
        FROM payload.teacher_institution_assignments tia
        LEFT JOIN payload.institutions i ON tia.institution_id_id = i.id
        WHERE tia.teacher_id_id = $1 AND tia.status = 'aktif'
      `, [cmsUserId]);
      
      assignments = assignmentsResult.rows || [];
    }

    // ==========================================
    // 2. Get subjects for each institution
    // ==========================================
    const assignmentsWithSubjects = await Promise.all(
      assignments.map(async (assignment) => {
        let subjects: any[] = [];

        // Get subjects from database
        if (assignment.institutionId) {
          try {
            const subjectResult = await query(`
              SELECT DISTINCT ON (sub.id)
                sub.id,
                sub.nama_mapel,
                sub.kode_mapel
              FROM subjects sub
              INNER JOIN teacher_subject_assignments tsa ON tsa."subjectId" = sub.id
              WHERE tsa."userId" = $1
                AND sub.school_id = $2
              ORDER BY sub.id
            `, [teacherId, assignment.institutionId]);

            subjects = subjectResult.rows || [];
          } catch (err) {
            console.error('Error fetching subjects:', err);
          }
        }

        // Parse weekly schedule for today
        let todaySchedule: any[] = [];
        let workingHours = { start: '08:00', end: '17:00' };

        if (assignment.weeklySchedule) {
          try {
            const schedule = typeof assignment.weeklySchedule === 'string'
              ? JSON.parse(assignment.weeklySchedule)
              : assignment.weeklySchedule;

            todaySchedule = schedule[todayKey] || [];

            // Also get working hours if available
            if (schedule.workingHours) {
              workingHours = schedule.workingHours;
            }
          } catch (err) {
            console.error('Error parsing weekly schedule:', err);
          }
        }

        const institutionLocation = {
          latitude: assignment.locationLatitude ? parseFloat(assignment.locationLatitude) : -6.2088,
          longitude: assignment.locationLongitude ? parseFloat(assignment.locationLongitude) : 106.8456,
        };
        const institutionSettings = {
          attendanceRadiusMeters: assignment.attendanceRadiusMeters ? parseFloat(assignment.attendanceRadiusMeters) : 100,
          qrCodeEnabled: !!assignment.qrCodeEnabled,
        };

        return {
          id: assignment.id,
          institutionId: assignment.institutionId,
          institutionName: assignment.institutionName,
          institutionLocation,
          institutionSettings,
          subjectIds: assignment.subjectIds,
          weeklySchedule: assignment.weeklySchedule,
          status: assignment.status,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          subjects,
          todaySchedule,
          workingHours,
        };
      })
    );

    // ==========================================
    // 3. Get today's attendance records
    // ==========================================
    const todayAttendance = await db
      .select()
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.teacherId, teacherId),
          gte(attendanceLogs.timestamp, startOfDay),
          lte(attendanceLogs.timestamp, endOfDay)
        )
      )
      .orderBy(desc(attendanceLogs.timestamp));

    // Group attendance by institution
    const attendanceByInstitution: { [key: string]: any[] } = {};
    todayAttendance.forEach((log) => {
      if (!attendanceByInstitution[log.institutionId]) {
        attendanceByInstitution[log.institutionId] = [];
      }
      attendanceByInstitution[log.institutionId].push(log);
    });

    // ==========================================
    // 4. Check for active teaching sessions
    // ==========================================
    const activeTeachingSessions = await db
      .select()
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.teacherId, teacherId),
          eq(attendanceLogs.type, 'mengajar_mulai'),
          gte(attendanceLogs.timestamp, startOfDay),
          lte(attendanceLogs.timestamp, endOfDay)
        )
      );

    // Check if each session has a matching end
    const teachingSessionsWithStatus = activeTeachingSessions.map((session) => {
      const hasEnded = todayAttendance.some(
        (log) =>
          log.type === 'mengajar_selesai' &&
          log.classSessionId === session.classSessionId
      );
      return {
        ...session,
        isActive: !hasEnded,
      };
    });

    // ==========================================
    // 5. Get attendance summary for today
    // ==========================================
    const todaySummary = await db
      .select()
      .from(attendanceSummary)
      .where(
        and(
          eq(attendanceSummary.teacherId, teacherId),
          eq(attendanceSummary.date, startOfDay)
        )
      );

    // ==========================================
    // 6. Build response
    // ==========================================
    const enrichedAssignments = assignmentsWithSubjects.map((assignment) => {
      const institutionAttendance = attendanceByInstitution[assignment.institutionId] || [];
      const checkIn = institutionAttendance.find((log) => log.type === 'masuk');
      const checkOut = institutionAttendance.find((log) => log.type === 'pulang');
      const institutionSessions = teachingSessionsWithStatus.filter(
        (s) => s.institutionId === assignment.institutionId
      );

      // Determine attendance status
      let attendanceStatus: 'belum_absen' | 'hadir' | 'check_in_only' | 'completed' = 'belum_absen';
      if (checkIn && checkOut) {
        attendanceStatus = 'completed';
      } else if (checkIn) {
        attendanceStatus = 'check_in_only';
      } else if (todaySummary.find((s) => s.institutionId === assignment.institutionId)) {
        attendanceStatus = 'hadir';
      }

      return {
        ...assignment,
        todayAttendance: {
          status: attendanceStatus,
          checkIn: checkIn
            ? {
                timestamp: checkIn.timestamp,
                distance: checkIn.distanceFromInstitution,
                status: checkIn.status,
              }
            : null,
          checkOut: checkOut
            ? {
                timestamp: checkOut.timestamp,
                distance: checkOut.distanceFromInstitution,
                status: checkOut.status,
              }
            : null,
          teachingSessions: institutionSessions,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        teacherId,
        date: today.toISOString(),
        dayName: todayKey,
        assignments: enrichedAssignments,
        attendanceByInstitution,
        todaySummary,
        workingHours: {
          start: '08:00',
          end: '17:00',
          currentTime: today.toISOString(),
        },
      },
    });
  } catch (error: any) {
    console.error('Teacher Attendance Dashboard Error:', error);

    if (error.message?.includes('Unauthorized') || error.message?.includes('session')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
