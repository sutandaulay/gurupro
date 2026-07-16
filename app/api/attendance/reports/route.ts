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
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { parseISO, startOfDay, endOfDay } from 'date-fns';

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
    let institutionIds: string[] = [];
    
    if (session.user.role === 'admin') {
      // Admin bisa melihat semua institusi
      // Dalam implementasi nyata, mungkin perlu pembatasan tambahan
    } else if (['kepala_sekolah', 'wakasek', 'operator'].includes(session.user.role)) {
      // Kepala Sekolah/Wakasek/Operator hanya bisa melihat institusi tempat mereka bertugas
      const userInstitutionMembers = await db.select({ institutionId: institutionMembers.institutionId })
        .from(institutionMembers)
        .where(eq(institutionMembers.userId, session.user.id));
      
      institutionIds = userInstitutionMembers.map(member => member.institutionId);
      
      if (institutionIds.length === 0) {
        return NextResponse.json({ 
          error: 'Anda tidak memiliki akses ke institusi apapun', 
          reports: [] 
        });
      }
    } else if (session.user.role === 'teacher') {
      // Guru hanya bisa melihat laporan untuk institusi tempat mereka mengajar
      const teacherAssignments = await db.select({ institutionId: teacherInstitutionAssignments.institutionId })
        .from(teacherInstitutionAssignments)
        .where(and(
          eq(teacherInstitutionAssignments.teacherId, session.user.id),
          eq(teacherInstitutionAssignments.status, 'aktif')
        ));
      
      institutionIds = teacherAssignments.map(assignment => assignment.institutionId);
      
      if (institutionIds.length === 0) {
        return NextResponse.json({ 
          error: 'Anda tidak memiliki penugasan aktif ke institusi apapun', 
          reports: [] 
        });
      }
    }

    // Bangun query dengan filter
    let query = db.select().from(attendanceSummary);
    
    // Tambahkan filter berdasarkan parameter
    if (validatedParams.teacherId) {
      query = query.where(eq(attendanceSummary.teacherId, validatedParams.teacherId));
    } else if (session.user.role === 'teacher') {
      // Jika pengguna adalah guru, hanya tampilkan laporan miliknya sendiri
      query = query.where(eq(attendanceSummary.teacherId, session.user.id));
    }
    
    if (institutionIds.length > 0) {
      // Jika ada pembatasan institusi, filter berdasarkan institusi yang diizinkan
      query = query.where(inArray(attendanceSummary.institutionId, institutionIds));
    } else if (validatedParams.institutionId) {
      // Jika pengguna adalah admin dan menentukan institusi spesifik
      query = query.where(eq(attendanceSummary.institutionId, validatedParams.institutionId));
    }
    
    // Filter rentang tanggal
    query = query.where(
      and(
        gte(attendanceSummary.date, startDate),
        lte(attendanceSummary.date, endDate)
      )
    );

    // Eksekusi query
    const rawReports = await query;

    // Proses data untuk ditampilkan
    const reports = rawReports.map(summary => ({
      id: summary.id,
      teacherId: summary.teacherId,
      institutionId: summary.institutionId,
      date: summary.date.toISOString(),
      checkInTime: summary.checkInTime?.toISOString(),
      checkOutTime: summary.checkOutTime?.toISOString(),
      attendanceStatus: summary.attendanceStatus,
      teachingMinutesTotal: Number(summary.teachingMinutesTotal),
      teachingSessionsCompleted: Number(summary.teachingSessionsCompleted),
      scheduledSessions: 0, // Akan diisi dari jadwal sebenarnya
      lateMinutes: Number(summary.lateMinutes),
      teachingMinutesBySubject: summary.teachingMinutesBySubject 
        ? JSON.parse(summary.teachingMinutesBySubject as string) 
        : {},
    }));

    // Dapatkan nama guru dan institusi untuk setiap laporan
    // Dalam implementasi nyata, ini akan memerlukan join ke tabel users dan institutions
    // Untuk simulasi, kita tambahkan data dummy
    const enhancedReports = reports.map(report => ({
      ...report,
      teacherName: `Guru ${report.teacherId.substring(0, 8)}`,
      institutionName: `Institusi ${report.institutionId.substring(0, 8)}`,
    }));

    return NextResponse.json({
      success: true,
      reports: enhancedReports,
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