import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { db, query } from '@/lib/db';
import {
  attendanceSummary,
  schools,
  teacherAttendance,
  institutions,
} from '@/lib/schemas/attendance';
import { users } from '@/lib/schemas/main-schema';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';
import { parseISO, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { parsePagination, paginationMeta, offset } from '@/lib/pagination';

const ReportQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).optional().default('monthly'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  teacherId: z.string().uuid().optional(),
  institutionId: z.string().optional(),
  schoolId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  classId: z.string().optional(),
  search: z.string().optional(),
});

function getPeriodDates(period: string) {
  const now = new Date();
  switch (period) {
    case 'daily':
      return { startDate: startOfDay(now), endDate: endOfDay(now) };
    case 'weekly': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { startDate: startOfDay(start), endDate: endOfDay(end) };
    }
    case 'monthly':
    default:
      return {
        startDate: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
  }
}

async function getDataScope(session: any) {
  const userRoleRow = await query('SELECT role FROM users WHERE id = $1', [session.id]);
  const userRole = userRoleRow.rows[0]?.role || session.role || 'guru';

  const membersResult = await query(
    `SELECT institution_id as "institutionId"
     FROM public.institution_members
     WHERE app_user_id = $1 AND status = 'active'`,
    [session.id]
  );
  const institutionIds = membersResult.rows.map((m: any) => Number(m.institutionId));

  const ownedSchools = await db.select({ id: schools.id })
    .from(schools)
    .where(eq(schools.userId, session.id));
  const schoolIds = ownedSchools.map(s => s.id);

  return { userRole, institutionIds, schoolIds };
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();

    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validatedParams = ReportQuerySchema.parse(queryParams);
    const pag = parsePagination(url.searchParams);

    const { startDate, endDate } =
      validatedParams.startDate && validatedParams.endDate
        ? { startDate: parseISO(validatedParams.startDate), endDate: parseISO(validatedParams.endDate) }
        : getPeriodDates(validatedParams.period);

    const { userRole, institutionIds, schoolIds } = await getDataScope(session);

    let targetTeacherId = validatedParams.teacherId;

    // Role-based access
    if (!['admin', 'kepala_sekolah', 'wakasek', 'operator'].includes(userRole)) {
      targetTeacherId = session.id;
    }

    // Admin: if no institution filter set, show nothing until user picks one
    // This prevents accidentally showing all data
    if (userRole === 'admin' && !targetTeacherId && institutionIds.length === 0 && schoolIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          totalDays: 0,
          attendanceRate: 0,
          totalTeachingMinutes: 0,
          totalTeachingSessions: 0,
          scheduledSessions: 0,
          lateCount: 0,
          totalLateMinutes: 0,
        },
        pagination: paginationMeta(0, pag),
        filters: validatedParams,
        dateRange: { startDate, endDate },
      });
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // --- Institution-based reports ---
    const institutionConditions: any[] = [];
    if (targetTeacherId) institutionConditions.push(eq(attendanceSummary.teacherId, targetTeacherId));
    if (institutionIds.length > 0) institutionConditions.push(inArray(attendanceSummary.institutionId, institutionIds));
    if (validatedParams.institutionId && userRole === 'admin') {
      institutionConditions.push(eq(attendanceSummary.institutionId, Number(validatedParams.institutionId)));
    }
    institutionConditions.push(
      and(gte(attendanceSummary.date, startDate), lte(attendanceSummary.date, endDate))
    );

    const institutionReportsRaw = await db.select({
      id: attendanceSummary.id,
      teacherId: attendanceSummary.teacherId,
      teacherName: users.nama_lengkap,
      institutionId: attendanceSummary.institutionId,
      institutionName: institutions.name,
      date: attendanceSummary.date,
      checkInTime: attendanceSummary.checkInTime,
      checkOutTime: attendanceSummary.checkOutTime,
      attendanceStatus: attendanceSummary.attendanceStatus,
      teachingMinutesTotal: attendanceSummary.teachingMinutesTotal,
      teachingSessionsCompleted: attendanceSummary.teachingSessionsCompleted,
      lateMinutes: attendanceSummary.lateMinutes,
    })
    .from(attendanceSummary)
    .leftJoin(users, eq(users.id, attendanceSummary.teacherId))
    .leftJoin(institutions, eq(institutions.id, attendanceSummary.institutionId))
    .where(and(...institutionConditions))
    .orderBy(desc(attendanceSummary.date));

    const institutionReports = institutionReportsRaw.map((r) => ({
      ...r,
      isSchoolBased: false,
      verification: null,
    }));

    // --- School-based reports ---
    let schoolReports: any[] = [];
    const schoolConditions: any[] = [];
    if (targetTeacherId) schoolConditions.push(eq(teacherAttendance.userId, targetTeacherId));
    else if (schoolIds.length > 0) schoolConditions.push(inArray(teacherAttendance.schoolId, schoolIds));
    if (validatedParams.schoolId) schoolConditions.push(eq(teacherAttendance.schoolId, validatedParams.schoolId));
    schoolConditions.push(
      and(gte(teacherAttendance.tanggal, startDateStr), lte(teacherAttendance.tanggal, endDateStr))
    );

    if (schoolConditions.length > 1) {
      const schoolData = await db.select({
        id: teacherAttendance.id,
        userId: teacherAttendance.userId,
        teacherName: users.nama_lengkap,
        schoolId: teacherAttendance.schoolId,
        schoolName: schools.namaSekolah,
        tanggal: teacherAttendance.tanggal,
        status: teacherAttendance.status,
        catatan: teacherAttendance.catatan,
        checkInTime: teacherAttendance.checkInTime,
        checkOutTime: teacherAttendance.checkOutTime,
        faceMatchScore: teacherAttendance.faceMatchScore,
        latitude: teacherAttendance.latitude,
        longitude: teacherAttendance.longitude,
        accuracy: teacherAttendance.accuracy,
        livenessPassed: teacherAttendance.livenessPassed,
      })
      .from(teacherAttendance)
      .leftJoin(users, eq(users.id, teacherAttendance.userId))
      .leftJoin(schools, eq(schools.id, teacherAttendance.schoolId))
      .where(and(...schoolConditions))
      .orderBy(desc(teacherAttendance.tanggal));

      schoolReports = schoolData.map((record) => ({
        id: String(record.id),
        teacherId: record.userId,
        teacherName: record.teacherName || 'Guru',
        institutionId: null,
        institutionName: record.schoolName || 'Sekolah',
        date: record.tanggal,
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
        attendanceStatus: record.status,
        teachingMinutesTotal: 0,
        teachingSessionsCompleted: 0,
        scheduledSessions: 0,
        lateMinutes: 0,
        isSchoolBased: true,
        verification: {
          faceMatchScore: record.faceMatchScore ? Number(record.faceMatchScore) : null,
          latitude: record.latitude ? Number(record.latitude) : null,
          longitude: record.longitude ? Number(record.longitude) : null,
          accuracy: record.accuracy ? Number(record.accuracy) : null,
          livenessPassed: Boolean(record.livenessPassed),
          catatan: record.catatan || null,
        },
      }));
    }

    let combinedReports = [...institutionReports, ...schoolReports];

    // Search filter
    if (validatedParams.search) {
      const term = validatedParams.search.toLowerCase();
      combinedReports = combinedReports.filter((r: any) =>
        (r.teacherName || '').toLowerCase().includes(term) ||
        (r.institutionName || '').toLowerCase().includes(term)
      );
    }

    // Unique dates in range for attendance rate calculation
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    const totalDaysInRange = allDays.length;

    // Unique teacher-date combos for attendance rate
    const uniqueTeacherDates = new Set(
      combinedReports.map((r: any) => `${r.teacherId}__${r.date}`)
    );
    const totalTeacherDays = uniqueTeacherDates.size;

    // Summary stats
    const totalTeachingMinutes = combinedReports.reduce(
      (sum, r: any) => sum + (Number(r.teachingMinutesTotal) || 0), 0
    );
    const totalTeachingSessions = combinedReports.reduce(
      (sum, r: any) => sum + (Number(r.teachingSessionsCompleted) || 0), 0
    );
    const totalScheduledSessions = combinedReports.reduce(
      (sum, r: any) => sum + (Number(r.scheduledSessions) || 0), 0
    );
    const lateCount = combinedReports.filter((r: any) => r.attendanceStatus === 'telat').length;
    const totalLateMinutes = combinedReports.reduce(
      (sum, r: any) => sum + (Number(r.lateMinutes) || 0), 0
    );
    const presentDays = combinedReports.filter((r: any) =>
      ['hadir', 'telat', 'izin', 'sakit', 'cuti'].includes(r.attendanceStatus)
    ).length;

    // Attendance rate = present days / total days in range (per teacher if filtered, else all)
    const attendanceRate = totalDaysInRange > 0
      ? Math.round((presentDays / totalDaysInRange) * 100)
      : 0;

    const total = combinedReports.length;
    const paginatedData = combinedReports.slice(offset(pag), offset(pag) + pag.limit);

    return NextResponse.json({
      success: true,
      data: paginatedData,
      summary: {
        totalDays: totalDaysInRange,
        attendanceRate,
        totalTeachingMinutes,
        totalTeachingSessions,
        scheduledSessions: totalScheduledSessions,
        lateCount,
        totalLateMinutes,
      },
      pagination: paginationMeta(total, pag),
      filters: validatedParams,
      dateRange: { startDate, endDate },
    });
  } catch (err: any) {
    console.error('Error in GET /api/attendance/reports:', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasi parameter gagal', details: err.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}