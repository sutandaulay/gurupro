import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { 
  attendanceSummary,
  institutions as institutionsTable,
  schools,
  schoolTeachingSessions,
  teacherAttendance,
} from '@/lib/schemas/attendance';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { parseISO, startOfWeek, endOfWeek, format, eachDayOfInterval, differenceInMinutes } from 'date-fns';
import { query } from '@/lib/db';

// Schema untuk validasi query parameter
const TPGReportQuerySchema = z.object({
  periodType: z.enum(['weekly', 'monthly']).optional().default('weekly'),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  teacherId: z.string().uuid().optional(), // Hanya untuk admin/kepala sekolah untuk lihat laporan guru lain
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validatedParams = TPGReportQuerySchema.parse(queryParams);

    // Jika teacherId tidak disediakan, gunakan ID pengguna saat ini
    const targetTeacherId = validatedParams.teacherId || session.user.id || '';

    // Validasi akses: hanya admin, kepala sekolah, wakasek, atau operator yang bisa melihat laporan guru lain
    if (targetTeacherId !== session.user.id && !['admin', 'kepala_sekolah', 'wakasek', 'operator'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Forbidden: Anda tidak memiliki akses untuk melihat laporan guru ini' }, { status: 403 });
    }

    // Jika bukan admin dan ingin melihat laporan guru lain, pastikan guru tersebut berada di institusi yang sama
    if (targetTeacherId !== session.user.id && (session.user.role || '') !== 'admin') {
      const membersResult = await query(`
        SELECT institution_id as "institutionId"
        FROM public.institution_members
        WHERE app_user_id = $1 AND status = 'active'
      `, [session.user.id]);
      const userInstitutionMembers = membersResult.rows;

      const assignmentsResult = await query(`
        SELECT institution_id as "institutionId"
        FROM public.institution_members
        WHERE app_user_id = $1 AND status = 'active'
      `, [targetTeacherId]);
      const teacherAssignments = assignmentsResult.rows;

      // Pastikan guru yang dituju berada di salah satu institusi tempat pengguna saat ini bertugas
      const hasAccess = teacherAssignments.some(assignment => 
        userInstitutionMembers.some(member => Number(member.institutionId) === assignment.institutionId)
      );

      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden: Anda tidak memiliki akses ke data guru ini' }, { status: 403 });
      }
    }

    // Parse atau tentukan rentang tanggal
    let startDate, endDate;
    if (validatedParams.periodStart && validatedParams.periodEnd) {
      startDate = parseISO(validatedParams.periodStart);
      endDate = parseISO(validatedParams.periodEnd);
    } else {
      // Jika tidak ada tanggal spesifik, gunakan periode default
      const now = new Date();
      if (validatedParams.periodType === 'weekly') {
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
      } else {
        // monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
    }

    // Ambil institusi aktif tempat guru mengajar
    const assignmentsResult2 = await query(`
      SELECT institution_id as "institutionId", id as "assignmentId"
      FROM public.institution_members
      WHERE app_user_id = $1 AND status = 'active'
    `, [targetTeacherId]);
    const teacherAssignments = assignmentsResult2.rows;

    // Cek apakah guru memiliki sekolah mandiri
    const ownedSchools = await db.select({ id: schools.id, namaSekolah: schools.namaSekolah })
      .from(schools)
      .where(and(
        eq(schools.userId, targetTeacherId)
      ));

    const schoolIds = ownedSchools.map(s => s.id);

    const hasAnyAssignment = teacherAssignments.length > 0 || schoolIds.length > 0;
    
    if (!hasAnyAssignment) {
      return NextResponse.json({
        success: true,
        message: 'Guru tidak memiliki penugasan aktif ke institusi atau sekolah manapun',
        reports: [],
      });
    }

    // Ambil data kehadiran untuk institusi
    let attendanceData: any[] = [];
    if (teacherAssignments.length > 0) {
      attendanceData = await db.select({
        id: attendanceSummary.id,
        teacherId: attendanceSummary.teacherId,
        institutionId: attendanceSummary.institutionId,
        date: attendanceSummary.date,
        attendanceStatus: attendanceSummary.attendanceStatus,
        teachingMinutesTotal: attendanceSummary.teachingMinutesTotal,
        teachingSessionsCompleted: attendanceSummary.teachingSessionsCompleted,
        lateMinutes: attendanceSummary.lateMinutes,
      })
      .from(attendanceSummary)
      .where(and(
        eq(attendanceSummary.teacherId, targetTeacherId),
        inArray(attendanceSummary.institutionId, teacherAssignments.map(a => a.institutionId)),
        gte(attendanceSummary.date, startDate),
        lte(attendanceSummary.date, endDate)
      ));
    }

    // Ambil data kehadiran untuk sekolah mandiri dari teacher_attendance
    let schoolAttendanceData: any[] = [];
    if (schoolIds.length > 0) {
      schoolAttendanceData = await db.select({
        id: teacherAttendance.id,
        userId: teacherAttendance.userId,
        schoolId: teacherAttendance.schoolId,
        tanggal: teacherAttendance.tanggal,
        status: teacherAttendance.status,
        createdAt: teacherAttendance.createdAt,
      }).from(teacherAttendance)
      .where(and(
        eq(teacherAttendance.userId, targetTeacherId),
        inArray(teacherAttendance.schoolId, schoolIds),
        gte(teacherAttendance.tanggal, startDate),
        lte(teacherAttendance.tanggal, endDate),
        eq(teacherAttendance.status, 'hadir')
      ));
    }

    // Ambil nama institusi
    const institutionIds = [...new Set(attendanceData.map(d => d.institutionId))];
    let institutions: any[] = [];
    if (institutionIds.length > 0) {
      institutions = await db.select({
        id: institutionsTable.id,
        name: institutionsTable.name,
      })
      .from(institutionsTable)
      .where(inArray(institutionsTable.id, institutionIds));
    }

    // Buat map nama sekolah
    const schoolMap = new Map(ownedSchools.map(s => [s.id, s.namaSekolah]));

    // Hitung statistik per institusi dan total
    const statsByInstitution: Record<string, {
      minutes: number;
      sessions: number;
      attendanceDays: number;
      lateDays: number;
      type: 'institution' | 'school';
    }> = {};

    // Inisialisasi institusi
    teacherAssignments.forEach(assignment => {
      statsByInstitution[`inst-${assignment.institutionId}`] = {
        minutes: 0,
        sessions: 0,
        attendanceDays: 0,
        lateDays: 0,
        type: 'institution',
      };
    });

    // Inisialisasi sekolah mandiri
    ownedSchools.forEach(school => {
      statsByInstitution[`school-${school.id}`] = {
        minutes: 0,
        sessions: 0,
        attendanceDays: 0,
        lateDays: 0,
        type: 'school',
      };
    });

    // Hitung statistik dari data kehadiran institusi
    attendanceData.forEach(record => {
      const key = `inst-${record.institutionId}`;
      if (!statsByInstitution[key]) {
        statsByInstitution[key] = {
          minutes: 0,
          sessions: 0,
          attendanceDays: 0,
          lateDays: 0,
          type: 'institution',
        };
      }

      statsByInstitution[key].minutes += Number(record.teachingMinutesTotal);
      statsByInstitution[key].sessions += Number(record.teachingSessionsCompleted);

      if (record.attendanceStatus === 'hadir' || record.attendanceStatus === 'telat') {
        statsByInstitution[key].attendanceDays++;
        if (record.attendanceStatus === 'telat') {
          statsByInstitution[key].lateDays++;
        }
      }
    });

    // Hitung statistik dari data kehadiran sekolah mandiri menggunakan teaching_sessions
    const SCHOOL_DAILY_MINUTES = 0; // Will be calculated from actual sessions
    if (schoolIds.length > 0) {
      const teachingSessions = await db.select({
        schoolId: schoolTeachingSessions.schoolId,
        durationMinutes: schoolTeachingSessions.durationMinutes,
        startedAt: schoolTeachingSessions.startedAt,
        endedAt: schoolTeachingSessions.endedAt,
        status: schoolTeachingSessions.status,
      })
      .from(schoolTeachingSessions)
      .where(and(
        eq(schoolTeachingSessions.userId, targetTeacherId),
        inArray(schoolTeachingSessions.schoolId, schoolIds),
        gte(schoolTeachingSessions.startedAt, startDate),
        lte(schoolTeachingSessions.startedAt, endDate),
        eq(schoolTeachingSessions.status, 'completed')
      ));

      teachingSessions.forEach((session: any) => {
        const key = `school-${session.schoolId}`;
        if (!statsByInstitution[key]) {
          statsByInstitution[key] = {
            minutes: 0,
            sessions: 0,
            attendanceDays: 0,
            lateDays: 0,
            type: 'school',
          };
        }

        // Use actual duration if available, otherwise calculate from timestamps
        const duration = session.durationMinutes || 
          (session.endedAt && session.startedAt 
            ? differenceInMinutes(new Date(session.endedAt), new Date(session.startedAt))
            : SCHOOL_DAILY_MINUTES);
        
        statsByInstitution[key].minutes += duration;
        statsByInstitution[key].sessions += 1;
      });
    }

    // Hitung total keseluruhan
    let totalMinutes = 0;
    let totalSessions = 0;
    let totalAttendanceDays = 0;
    let totalLateDays = 0;

    Object.values(statsByInstitution).forEach(stat => {
      totalMinutes += stat.minutes;
      totalSessions += stat.sessions;
      totalAttendanceDays += stat.attendanceDays;
      totalLateDays += stat.lateDays;
    });

    // Syarat TPG mingguan (24 jam = 1440 menit)
    const requiredMinutes = 1440;
    const isRequirementMet = totalMinutes >= requiredMinutes;
    const weeklyDeficit = isRequirementMet ? 0 : requiredMinutes - totalMinutes;

    // Format nama institusi dan sekolah
    const institutionMap = institutions.reduce((acc, inst) => {
      acc[inst.id] = inst.name;
      return acc;
    }, {} as Record<string, string>);

    ownedSchools.forEach(school => {
      institutionMap[`school-${school.id}`] = school.namaSekolah;
    });

    // Format data untuk response
    const teachingMinutesByInstitution = Object.entries(statsByInstitution).map(([institutionId, stats]) => ({
      institutionId,
      institutionName: institutionMap[institutionId] || `Institusi ${institutionId.substring(0, 8)}`,
      minutes: stats.minutes,
    }));

    // Ambil nama guru
    // Dalam implementasi nyata, ini akan dari tabel users
    const teacherName = `Guru ${targetTeacherId.substring(0, 8)}`;

    return NextResponse.json({
      success: true,
      reports: [{
        teacherId: targetTeacherId,
        teacherName,
        weekStart: startDate.toISOString(),
        weekEnd: endDate.toISOString(),
        totalMinutes,
        requiredMinutes,
        teachingMinutesByInstitution,
        sessionsCompleted: totalSessions,
        attendanceDays: totalAttendanceDays,
        lateDays: totalLateDays,
        isRequirementMet,
        weeklyDeficit,
      }],
    });
  } catch (error) {
    console.error('TPG reports error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validasi parameter gagal', 
          details: error.issues 
        }, 
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}