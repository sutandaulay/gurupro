import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { db, query } from '@/lib/db';
import {
  attendanceLogs,
  attendanceSummary,
} from '@/lib/schemas/attendance';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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
    // 1. Get all institution memberships for this teacher
    //    Primary source: payload.institution_members (has actual data)
    //    Falls back to payload.teacher_institution_assignments for scheduling data
    // ==========================================
    let assignments: any[] = [];

    const membersResult = await query(`
      SELECT 
        im.id,
        im.institution_id as "institutionId",
        i.name as "institutionName",
        i.location_latitude as "locationLatitude",
        i.location_longitude as "locationLongitude",
        i.attendance_settings_attendance_radius_meters as "attendanceRadiusMeters",
        i.attendance_settings_qr_code_enabled as "qrCodeEnabled",
        tia.subject_ids as "subjectIds",
        tia.weekly_schedule as "weeklySchedule",
        im.status,
        imr.value as "role",
        tia.start_date as "startDate",
        tia.end_date as "endDate",
        tia.id as "tiaId"
      FROM payload.institution_members im
      JOIN payload.institutions i ON im.institution_id = i.id
      LEFT JOIN payload.institution_members_role imr ON imr.parent_id = im.id
      LEFT JOIN payload.teacher_institution_assignments tia 
        ON tia.institution_id_id = im.institution_id 
        AND tia.teacher_id_id = im.user_id
        AND tia.status = 'aktif'
      WHERE im.app_user_id = $1 
        AND im.status = 'active'
      ORDER BY i.name
    `, [teacherId]);

    assignments = (membersResult.rows || []).map((row: any) => ({
      ...row,
      id: uuidv4(),
    }));

    // Fallback: try via cms_users email if no results via app_user_id
    if (assignments.length === 0) {
      const userResult = await query("SELECT email FROM users WHERE id = $1", [teacherId]);
      if (userResult.rows.length > 0) {
        const email = userResult.rows[0].email;
        const cmsUserResult = await query("SELECT id FROM payload.cms_users WHERE email = $1", [email]);
        if (cmsUserResult.rows.length > 0) {
          const cmsUserId = cmsUserResult.rows[0].id;
          const fallbackResult = await query(`
            SELECT 
              im.id,
              im.institution_id as "institutionId",
              i.name as "institutionName",
              i.location_latitude as "locationLatitude",
              i.location_longitude as "locationLongitude",
              i.attendance_settings_attendance_radius_meters as "attendanceRadiusMeters",
              i.attendance_settings_qr_code_enabled as "qrCodeEnabled",
              tia.subject_ids as "subjectIds",
              tia.weekly_schedule as "weeklySchedule",
              im.status,
              imr.value as "role",
              tia.start_date as "startDate",
              tia.end_date as "endDate",
              tia.id as "tiaId"
            FROM payload.institution_members im
            JOIN payload.institutions i ON im.institution_id = i.id
            LEFT JOIN payload.institution_members_role imr ON imr.parent_id = im.id
            LEFT JOIN payload.teacher_institution_assignments tia 
              ON tia.institution_id_id = im.institution_id 
              AND tia.teacher_id_id = im.user_id
              AND tia.status = 'aktif'
            WHERE im.user_id = $1 
              AND im.status = 'active'
            ORDER BY i.name
          `, [cmsUserId]);
          assignments = (fallbackResult.rows || []).map((row: any) => ({
            ...row,
            id: uuidv4(),
          }));
        }
      }
    }

    // ==========================================
    // 1b. Get independent teacher's own schools (if no institution assignments)
    // ==========================================
    let schoolAssignments: any[] = [];
    if (assignments.length === 0) {
      const schoolsResult = await query(`
        SELECT 
          id,
          nama_sekolah as "schoolName",
          location_latitude as "locationLatitude",
          location_longitude as "locationLongitude",
          attendance_radius_meters as "attendanceRadiusMeters"
        FROM schools
        WHERE user_id = $1
      `, [teacherId]);

      schoolAssignments = (schoolsResult.rows || []).map((row: any) => ({
        id: row.id,
        institutionId: row.id,
        institutionName: row.schoolName,
        locationLatitude: row.locationLatitude,
        locationLongitude: row.locationLongitude,
        attendanceRadiusMeters: row.attendanceRadiusMeters || 100,
        qrCodeEnabled: false,
        isSchool: true,
      }));
    }

    // Merge assignments
    const allAssignments = [...assignments, ...schoolAssignments];

    // ==========================================
    // 2. Get subjects for each institution
    // ==========================================
    const assignmentsWithSubjects = await Promise.all(
      allAssignments.map(async (assignment) => {
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
    // 5. Get duty assignments for today
    // ==========================================
    const dutyAssignmentsToday = await query(`
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
        AND date = $2 
        AND status = 'approved'
    `, [teacherId, startOfDay.toISOString().split('T')[0]]);

    // ==========================================
    // 5b. Get today's attendance summary
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
    const enrichedAssignments = assignmentsWithSubjects.map((assignment: any) => {
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
        schoolAssignments: allAssignments.filter((a: any) => a.isSchool),
        dutyAssignmentsToday: dutyAssignmentsToday.rows || [],
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
