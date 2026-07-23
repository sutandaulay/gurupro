import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { 
  attendanceSummary,
  attendanceLogs,
  institutions as institutionsTable,
  institutionMembers,
  teacherInstitutionAssignments
} from '@/lib/schemas/attendance';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { query } from '@/lib/db';

// Schema untuk validasi query parameter
const ReportQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).optional().default('monthly'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  teacherId: z.string().uuid().optional(),
  institutionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
});

// Schema untuk validasi query parameter
const ReportQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).optional().default('monthly'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  teacherId: z.string().uuid().optional(),
  institutionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  classId: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    // Validasi sesi pengguna
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameter
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validatedParams = ReportQuerySchema.parse(queryParams);

    // Validasi rentang tanggal
    let startDate = new Date();
    let endDate = new Date();
    
    if (validatedParams.startDate && validatedParams.endDate) {
      startDate = parseISO(validatedParams.startDate);
      endDate = parseISO(validatedParams.endDate);
    } else {
      // Jika tidak ada tanggal spesifik, gunakan periode default
      const now = new Date();
      switch (validatedParams.period) {
        case 'daily':
          startDate = startOfDay(now);
          endDate = endOfDay(now);
          break;
        case 'weekly':
          startDate = startOfDay(new Date(now.setDate(now.getDate() - now.getDay()))); // Mulai minggu ini
          now.setDate(now.getDate() - now.getDay() + 6); // Akhir minggu ini
          endDate = endOfDay(now);
          break;
        case 'monthly':
          startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)); // Awal bulan
          endDate = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)); // Akhir bulan
          break;
      }
    }

    // Scope data berdasarkan peran pengguna
    let institutionIds: number[] = [];
    let schoolIds: string[] = [];
    
    if ((session.user.role || '') === 'admin') {
      // Admin bisa melihat semua institusi
    } else if (['kepala_sekolah', 'wakasek', 'operator'].includes(session.user.role || '')) {
      const userInstitutionMembers = await db.select({ institutionId: institutionMembers.institutionId })
        .from(institutionMembers)
        .where(eq(institutionMembers.userId, session.user.id));
      
      institutionIds = userInstitutionMembers.map(member => Number(member.institutionId));
      
      if (institutionIds.length === 0 && session.user.role === 'kepala_sekolah') {
        // Kepala sekolah mungkin mengelola sekolah mandiri
        const ownedSchools = await db.select({ id: schools.id })
          .from(schools)
          .where(eq(schools.userId, session.user.id));
        schoolIds = ownedSchools.map(s => s.id);
      }
      
      if (institutionIds.length === 0 && schoolIds.length === 0) {
        return NextResponse.json({ 
          error: 'Anda tidak memiliki akses ke institusi atau sekolah apapun', 
          reports: [] 
        });
      }
    } else if (session.user.role === 'teacher') {
      const teacherAssignments = await db.select({ institutionId: teacherInstitutionAssignments.institutionId })
        .from(teacherInstitutionAssignments)
        .where(and(
          eq(teacherInstitutionAssignments.teacherId, session.user.id),
          eq(teacherInstitutionAssignments.status, 'aktif')
        ));
      
      institutionIds = teacherAssignments.map(assignment => Number(assignment.institutionId));
      
      // Cek apakah guru memiliki sekolah mandiri
      const ownedSchools = await db.select({ id: schools.id })
        .from(schools)
        .where(eq(schools.userId, session.user.id));
      schoolIds = ownedSchools.map(s => s.id);
      
      if (institutionIds.length === 0 && schoolIds.length === 0) {
        return NextResponse.json({ 
          error: 'Anda tidak memiliki penugasan aktif ke institusi atau sekolah manapun', 
          reports: [] 
        });
      }
    }

    // Bangun query dengan filter
    let institutionQuery = db.select().from(attendanceSummary) as any;
    
    if (validatedParams.teacherId) {
      institutionQuery = institutionQuery.where(eq(attendanceSummary.teacherId, validatedParams.teacherId));
    } else if (session.user.role === 'teacher') {
      institutionQuery = institutionQuery.where(eq(attendanceSummary.teacherId, session.user.id));
    }
    
    if (institutionIds.length > 0) {
      institutionQuery = institutionQuery.where(inArray(attendanceSummary.institutionId, institutionIds));
    } else if (validatedParams.institutionId) {
      institutionQuery = institutionQuery.where(eq(attendanceSummary.institutionId, Number(validatedParams.institutionId)));
    }
    
    institutionQuery = institutionQuery.where(
      and(
        gte(attendanceSummary.date, startDate),
        lte(attendanceSummary.date, endDate)
      )
    );

    // Query untuk sekolah mandiri (teacher_attendance)
    let schoolQuery = db.select({
      id: schools.id,
      userId: schools.userId,
      namaSekolah: schools.namaSekolah,
      locationLatitude: schools.locationLatitude,
      locationLongitude: schools.locationLongitude,
      attendanceRadiusMeters: schools.attendanceRadiusMeters,
    }).from(schools).where(eq(schools.userId, session.user.id)) as any;

    // Eksekusi query institusi
    const institutionReports = await institutionQuery as any[];
    
    // Eksekusi query sekolah dan join dengan teacher_attendance
    const ownedSchools = await schoolQuery as any[];
    const schoolIdsFromQuery = ownedSchools.map((s: any) => s.id);
    
    let schoolReports: any[] = [];
    if (schoolIdsFromQuery.length > 0) {
      const schoolAttendance = await db.select({
        id: teacherAttendance.id,
        userId: teacherAttendance.userId,
        schoolId: teacherAttendance.schoolId,
        tanggal: teacherAttendance.tanggal,
        status: teacherAttendance.status,
        catatan: teacherAttendance.catatan,
        faceMatchScore: teacherAttendance.faceMatchScore,
        latitude: teacherAttendance.latitude,
        longitude: teacherAttendance.longitude,
        accuracy: teacherAttendance.accuracy,
        livenessPassed: teacherAttendance.livenessPassed,
        createdAt: teacherAttendance.createdAt,
      }).from(teacherAttendance)
      .where(and(
        eq(teacherAttendance.userId, session.user.id),
        gte(teacherAttendance.tanggal, startDate),
        lte(teacherAttendance.tanggal, endDate)
      ));

      // Join dengan data sekolah untuk mendapatkan nama
      const schoolMap = new Map(ownedSchools.map((s: any) => [s.id, s]));
      
      schoolReports = schoolAttendance.map((record: any) => {
        const school = schoolMap.get(record.schoolId);
        return {
          id: record.id,
          teacherId: record.userId,
          teacherName: session.user?.namaLengkap || session.user?.name || 'Guru',
          institutionId: null,
          institutionName: school?.namaSekolah || 'Sekolah Mandiri',
          date: record.tanggal,
          checkInTime: record.createdAt,
          checkOutTime: null,
          attendanceStatus: record.status,
          teachingMinutesTotal: 0,
          teachingSessionsCompleted: 0,
          scheduledSessions: 0,
          lateMinutes: 0,
          teachingMinutesBySubject: {},
          isSchoolBased: true,
          verification: {
            faceMatchScore: record.faceMatchScore ? Number(record.faceMatchScore) : null,
            latitude: record.latitude ? Number(record.latitude) : null,
            longitude: record.longitude ? Number(record.longitude) : null,
            livenessPassed: record.livenessPassed,
          }
        };
      });
    }

    // Gabungkan data institusi dan sekolah
    const allReports = [
      ...institutionReports.map((summary: any) => ({
        id: summary.id,
        teacherId: summary.teacherId,
        teacherName: session.user?.namaLengkap || session.user?.name || 'Guru',
        institutionId: summary.institutionId,
        institutionName: `Institusi ${String(summary.institutionId).substring(0, 8)}`,
        date: summary.date.toISOString(),
        checkInTime: summary.checkInTime?.toISOString(),
        checkOutTime: summary.checkOutTime?.toISOString(),
        attendanceStatus: summary.attendanceStatus,
        teachingMinutesTotal: Number(summary.teachingMinutesTotal),
        teachingSessionsCompleted: Number(summary.teachingSessionsCompleted),
        scheduledSessions: 0,
        lateMinutes: Number(summary.lateMinutes),
        teachingMinutesBySubject: summary.teachingMinutesBySubject 
          ? JSON.parse(summary.teachingMinutesBySubject as string) 
          : {},
        isSchoolBased: false,
      })),
      ...schoolReports,
    ];

    // Sort by date descending
    allReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      reports: allReports,
      filters: validatedParams,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Attendance reports error:', error);
    
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