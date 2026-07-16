import { NextResponse } from 'next/server';
import { getPayload } from '@/lib/payload';
import { COLLECTIONS } from '@/collections/config';
import { db } from '@/lib/db';
import { 
  attendanceSummary,
  institutions as institutionsTable,
  institutionMembers,
  teacherInstitutionAssignments
} from '@/lib/schemas/attendance';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { parseISO, startOfWeek, endOfWeek, format, eachDayOfInterval } from 'date-fns';
import { attendanceInsights } from '@/lib/schemas/attendance-insight';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validasi token dan dapatkan informasi kontak pimpinan
    const payload = await getPayload();

    const shareLink = await payload.find({
      collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
      where: {
        shareToken: { equals: token },
      },
      limit: 1,
    });

    if (shareLink.docs.length === 0) {
      return NextResponse.json({ error: 'Link tidak ditemukan' }, { status: 404 });
    }

    const linkData = shareLink.docs[0];
    const leaderContactId = linkData.leaderContactId as string;

    // Dapatkan informasi kontak pimpinan
    const leaderContact = await payload.findByID({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id: leaderContactId,
    });

    if (!leaderContact) {
      return NextResponse.json({ error: 'Kontak pimpinan tidak ditemukan' }, { status: 404 });
    }

    // Dapatkan ID guru dari link
    const teacherId = linkData.teacherId as string;

    // Kita hanya mengembalikan data presensi untuk institusi tempat kontak pimpinan ini terdaftar
    // Dalam konteks GuruPRO, kontak pimpinan biasanya terkait dengan institusi tertentu
    // Untuk keamanan, kita hanya kembalikan data dari institusi tempat kontak pimpinan ini berasal

    // Untuk implementasi ini, kita asumsikan bahwa leaderContact memiliki informasi institusi
    // Dalam praktiknya, mungkin perlu relasi tambahan antara leaderContact dan institusi
    // atau kita harus menentukan institusi berdasarkan konteks sharing

    // Untuk sementara, kita ambil semua institusi aktif tempat guru mengajar
    const teacherAssignments = await db.select({
      institutionId: teacherInstitutionAssignments.institutionId,
      assignmentId: teacherInstitutionAssignments.id,
    })
    .from(teacherInstitutionAssignments)
    .where(and(
      eq(teacherInstitutionAssignments.teacherId, teacherId),
      eq(teacherInstitutionAssignments.status, 'aktif')
    ));

    // Ambil rentang minggu ini
    const now = new Date();
    const startDate = startOfWeek(now, { weekStartsOn: 1 }); // Mulai Senin
    const endDate = endOfWeek(now, { weekStartsOn: 1 });     // Akhiri Minggu

    // Ambil data kehadiran untuk minggu ini dari semua institusi tempat guru aktif
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
      eq(attendanceSummary.teacherId, teacherId),
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

    // Inisialisasi semua institusi yang aktif
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

    // Ambil data insight terbaru untuk minggu ini
    const [latestInsight] = await db.select()
      .from(attendanceInsights)
      .where(and(
        eq(attendanceInsights.teacherId, teacherId),
        eq(attendanceInsights.periodType, 'weekly'),
        eq(attendanceInsights.periodStart, startDate),
        eq(attendanceInsights.periodEnd, endDate)
      ))
      .orderBy(attendanceInsights.createdAt.desc())
      .limit(1);

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

    // Format data harian
    const daysInWeek = eachDayOfInterval({ start: startDate, end: endDate });
    const dailyData = daysInWeek.map(day => {
      const dayRecords = attendanceData.filter(record => 
        record.date.toDateString() === day.toDateString()
      );

      if (dayRecords.length === 0) {
        return {
          date: day.toISOString(),
          dayName: format(day, 'EEEE', { locale: { code: 'id' } }),
          attendanceStatus: 'libur',
          teachingMinutes: 0,
          sessions: 0,
          lateMinutes: 0,
        };
      }

      const dayRecord = dayRecords[0]; // Ambil record pertama untuk hari itu
      return {
        date: day.toISOString(),
        dayName: format(day, 'EEEE', { locale: { code: 'id' } }),
        attendanceStatus: dayRecord.attendanceStatus,
        teachingMinutes: Number(dayRecord.teachingMinutesTotal),
        sessions: Number(dayRecord.teachingSessionsCompleted),
        lateMinutes: Number(dayRecord.lateMinutes),
      };
    });

    // Ambil nama guru
    // Dalam implementasi nyata, ini akan dari tabel users
    const teacherName = `Guru ${teacherId.substring(0, 8)}`;

    // Syarat TPG mingguan (24 jam = 1440 menit)
    const requiredMinutes = 1440;
    const isRequirementMet = totalMinutes >= requiredMinutes;
    const weeklyDeficit = isRequirementMet ? 0 : requiredMinutes - totalMinutes;

    return NextResponse.json({
      success: true,
      data: {
        teacherName,
        weekStart: startDate.toISOString(),
        weekEnd: endDate.toISOString(),
        summary: {
          totalMinutes,
          requiredMinutes,
          teachingMinutesByInstitution,
          sessionsCompleted: totalSessions,
          attendanceDays: totalAttendanceDays,
          lateDays: totalLateDays,
          isRequirementMet,
          weeklyDeficit,
        },
        dailyData,
        insight: latestInsight ? latestInsight.insightData : null,
      },
    });
  } catch (error) {
    console.error('Attendance data for share error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}