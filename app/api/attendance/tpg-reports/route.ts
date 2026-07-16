import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { 
  attendanceSummary,
  institutions as institutionsTable,
  institutionMembers,
  teacherInstitutionAssignments
} from '@/lib/schemas/attendance';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { parseISO, startOfWeek, endOfWeek, format, eachDayOfInterval } from 'date-fns';

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
    const targetTeacherId = validatedParams.teacherId || session.user.id;

    // Validasi akses: hanya admin, kepala sekolah, wakasek, atau operator yang bisa melihat laporan guru lain
    if (targetTeacherId !== session.user.id && !['admin', 'kepala_sekolah', 'wakasek', 'operator'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden: Anda tidak memiliki akses untuk melihat laporan guru ini' }, { status: 403 });
    }

    // Jika bukan admin dan ingin melihat laporan guru lain, pastikan guru tersebut berada di institusi yang sama
    if (targetTeacherId !== session.user.id && session.user.role !== 'admin') {
      const userInstitutionMembers = await db.select({ institutionId: institutionMembers.institutionId })
        .from(institutionMembers)
        .where(eq(institutionMembers.userId, session.user.id));

      const teacherAssignments = await db.select({ institutionId: teacherInstitutionAssignments.institutionId })
        .from(teacherInstitutionAssignments)
        .where(and(
          eq(teacherInstitutionAssignments.teacherId, targetTeacherId),
          eq(teacherInstitutionAssignments.status, 'aktif')
        ));

      // Pastikan guru yang dituju berada di salah satu institusi tempat pengguna saat ini bertugas
      const hasAccess = teacherAssignments.some(assignment => 
        userInstitutionMembers.some(member => member.institutionId === assignment.institutionId)
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
    const teacherAssignments = await db.select({
      institutionId: teacherInstitutionAssignments.institutionId,
      assignmentId: teacherInstitutionAssignments.id,
    })
    .from(teacherInstitutionAssignments)
    .where(and(
      eq(teacherInstitutionAssignments.teacherId, targetTeacherId),
      eq(teacherInstitutionAssignments.status, 'aktif')
    ));

    if (teacherAssignments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Guru tidak memiliki penugasan aktif ke institusi manapun',
        reports: [],
      });
    }

    // Ambil data kehadiran untuk periode yang diminta dari semua institusi
    const attendanceData = await db.select({
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

    // Ambil nama institusi
    const institutionIds = [...new Set(attendanceData.map(d => d.institutionId))];
    const institutions = await db.select({
      id: institutionsTable.id,
      name: institutionsTable.name,
    })
    .from(institutionsTable)
    .where(inArray(institutionsTable.id, institutionIds));

    // Hitung statistik per institusi dan total
    const statsByInstitution: Record<string, {
      minutes: number;
      sessions: number;
      attendanceDays: number;
      lateDays: number;
    }> = {};

    // Inisialisasi semua institusi yang aktif meskipun tidak ada data
    teacherAssignments.forEach(assignment => {
      statsByInstitution[assignment.institutionId] = {
        minutes: 0,
        sessions: 0,
        attendanceDays: 0,
        lateDays: 0,
      };
    });

    // Hitung statistik dari data kehadiran
    attendanceData.forEach(record => {
      if (!statsByInstitution[record.institutionId]) {
        statsByInstitution[record.institutionId] = {
          minutes: 0,
          sessions: 0,
          attendanceDays: 0,
          lateDays: 0,
        };
      }

      statsByInstitution[record.institutionId].minutes += Number(record.teachingMinutesTotal);
      statsByInstitution[record.institutionId].sessions += Number(record.teachingSessionsCompleted);

      if (record.attendanceStatus === 'hadir' || record.attendanceStatus === 'telat') {
        statsByInstitution[record.institutionId].attendanceDays++;
        if (record.attendanceStatus === 'telat') {
          statsByInstitution[record.institutionId].lateDays++;
        }
      }
    });

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

    // Format nama institusi
    const institutionMap = institutions.reduce((acc, inst) => {
      acc[inst.id] = inst.name;
      return acc;
    }, {} as Record<string, string>);

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
          details: error.errors 
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