import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { db, query } from '@/lib/db';
import {
  attendanceSummary,
  schools,
  teacherAttendance,
  institutions,
} from '@/lib/schemas/attendance';
import { users } from '@/lib/schemas/main-schema';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';
import { parseISO, startOfDay, endOfDay, eachDayOfInterval, format } from 'date-fns';
import { id } from 'date-fns/locale';

const ExportQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).optional().default('monthly'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  teacherId: z.string().uuid().optional(),
  institutionId: z.string().optional(),
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
  const userRoleRow = await query('SELECT role FROM users WHERE id = $1', [session.user.id]);
  const userRole = userRoleRow.rows[0]?.role || session.user.role || 'guru';

  const membersResult = await query(
    `SELECT institution_id as "institutionId"
     FROM payload.institution_members
     WHERE app_user_id = $1 AND status = 'active'`,
    [session.user.id]
  );
  const institutionIds = membersResult.rows.map((m: any) => Number(m.institutionId));

  const ownedSchools = await db.select({ id: schools.id })
    .from(schools)
    .where(eq(schools.userId, session.user.id));
  const schoolIds = ownedSchools.map(s => s.id);

  return { userRole, institutionIds, schoolIds };
}

const STATUS_LABELS: Record<string, string> = {
  hadir: 'Hadir',
  telat: 'Telat',
  sakit: 'Sakit',
  izin: 'Izin',
  cuti: 'Cuti',
  alpa: 'Alpa',
};

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validatedParams = ExportQuerySchema.parse(queryParams);

    const { startDate, endDate } =
      validatedParams.startDate && validatedParams.endDate
        ? { startDate: parseISO(validatedParams.startDate), endDate: parseISO(validatedParams.endDate) }
        : getPeriodDates(validatedParams.period);

    const { userRole, institutionIds, schoolIds } = await getDataScope(session);

    let targetTeacherId = validatedParams.teacherId;
    if (!['admin', 'kepala_sekolah', 'wakasek', 'operator'].includes(userRole)) {
      targetTeacherId = session.user.id;
    }

    if (userRole === 'admin' && !targetTeacherId && institutionIds.length === 0 && schoolIds.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang dapat diekspor' }, { status: 404 });
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Institution-based reports
    const institutionConditions: any[] = [];
    if (targetTeacherId) institutionConditions.push(eq(attendanceSummary.teacherId, targetTeacherId));
    if (institutionIds.length > 0) institutionConditions.push(inArray(attendanceSummary.institutionId, institutionIds));
    if (validatedParams.institutionId && userRole === 'admin') {
      institutionConditions.push(eq(attendanceSummary.institutionId, Number(validatedParams.institutionId)));
    }
    institutionConditions.push(
      and(gte(attendanceSummary.date, startDate), lte(attendanceSummary.date, endDate))
    );

    const institutionReports = await db.select({
      teacherName: users.nama_lengkap,
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

    // School-based reports
    let schoolReports: any[] = [];
    const schoolConditions: any[] = [];
    if (targetTeacherId) schoolConditions.push(eq(teacherAttendance.userId, targetTeacherId));
    else if (schoolIds.length > 0) schoolConditions.push(inArray(teacherAttendance.schoolId, schoolIds));
    schoolConditions.push(
      and(gte(teacherAttendance.tanggal, startDateStr), lte(teacherAttendance.tanggal, endDateStr))
    );

    if (schoolConditions.length > 1) {
      const schoolData = await db.select({
        teacherName: users.nama_lengkap,
        schoolName: schools.namaSekolah,
        tanggal: teacherAttendance.tanggal,
        status: teacherAttendance.status,
        catatan: teacherAttendance.catatan,
        faceMatchScore: teacherAttendance.faceMatchScore,
        livenessPassed: teacherAttendance.livenessPassed,
      })
      .from(teacherAttendance)
      .leftJoin(users, eq(users.id, teacherAttendance.userId))
      .leftJoin(schools, eq(schools.id, teacherAttendance.schoolId))
      .where(and(...schoolConditions))
      .orderBy(desc(teacherAttendance.tanggal));

      schoolReports = schoolData.map((record) => ({
        teacherName: record.teacherName || 'Guru',
        institutionName: record.schoolName || 'Sekolah',
        date: record.tanggal,
        checkInTime: null,
        checkOutTime: null,
        attendanceStatus: record.status,
        teachingMinutesTotal: 0,
        teachingSessionsCompleted: 0,
        scheduledSessions: 0,
        lateMinutes: 0,
        faceMatchScore: record.faceMatchScore ? Number(record.faceMatchScore) : null,
        livenessPassed: Boolean(record.livenessPassed),
        catatan: record.catatan || null,
      }));
    }

    let allReports = [...institutionReports, ...schoolReports];

    // Search filter
    if (validatedParams.search) {
      const term = validatedParams.search.toLowerCase();
      allReports = allReports.filter((r: any) =>
        (r.teacherName || '').toLowerCase().includes(term) ||
        (r.institutionName || '').toLowerCase().includes(term)
      );
    }

    // Summary
    const totalDaysInRange = eachDayOfInterval({ start: startDate, end: endDate }).length;
    const totalTeachingMinutes = allReports.reduce((sum, r: any) => sum + (Number(r.teachingMinutesTotal) || 0), 0);
    const totalTeachingSessions = allReports.reduce((sum, r: any) => sum + (Number(r.teachingSessionsCompleted) || 0), 0);
    const lateCount = allReports.filter((r: any) => r.attendanceStatus === 'telat').length;
    const totalLateMinutes = allReports.reduce((sum, r: any) => sum + (Number(r.lateMinutes) || 0), 0);
    const presentDays = allReports.filter((r: any) =>
      ['hadir', 'telat', 'izin', 'sakit', 'cuti'].includes(r.attendanceStatus)
    ).length;
    const attendanceRate = totalDaysInRange > 0 ? Math.round((presentDays / totalDaysInRange) * 100) : 0;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'GuruPRO AI';
    wb.created = new Date();

    // --- Summary Sheet ---
    const wsSummary = wb.addWorksheet('Ringkasan');
    wsSummary.columns = [{ width: 28 }, { width: 22 }];

    wsSummary.mergeCells('A1:B1');
    const titleCell = wsSummary.getCell('A1');
    titleCell.value = 'Laporan Presensi & Jam Mengajar';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getRow(1).height = 30;

    const periodLabel = `${format(startDate, 'd MMM yyyy', { locale: id })} — ${format(endDate, 'd MMM yyyy', { locale: id })}`;
    wsSummary.mergeCells('A2:B2');
    const metaCell = wsSummary.getCell('A2');
    metaCell.value = `Periode: ${periodLabel}`;
    metaCell.font = { size: 11, italic: true };
    metaCell.alignment = { horizontal: 'left', vertical: 'middle' };
    wsSummary.getRow(2).height = 18;

    wsSummary.getCell('A4').value = 'Ringkasan Kehadiran';
    wsSummary.getCell('A4').font = { size: 12, bold: true };

    const summaryRows = [
      ['Tingkat Kehadiran', `${attendanceRate}%`],
      ['Total Hari Kerja', `${totalDaysInRange} hari`],
      ['Total Jam Mengajar', `${Math.floor(totalTeachingMinutes / 60)}j ${totalTeachingMinutes % 60}m`],
      ['Total Sesi Selesai', `${totalTeachingSessions} sesi`],
      ['Total Keterlambatan', `${lateCount}× (${totalLateMinutes} menit)`],
      ['Total Data', `${allReports.length} rekaman`],
    ];
    summaryRows.forEach(([label, value], i) => {
      wsSummary.getCell(`A${5 + i}`).value = label;
      wsSummary.getCell(`B${5 + i}`).value = value;
    });

    // Summary borders
    wsSummary.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });

    // --- Detail Sheet ---
    const ws = wb.addWorksheet('Detail Presensi');
    const headers = [
      'No', 'Nama Guru', 'Sekolah/Institusi', 'Tanggal',
      'Jam Masuk', 'Jam Pulang', 'Status', 'Menit Mengajar',
      'Sesi Selesai', 'Telat (menit)', 'Verifikasi', 'Catatan'
    ];
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 22;

    allReports.forEach((record, index) => {
      const dateObj = record.date ? new Date(record.date) : null;
      const checkIn = record.checkInTime ? new Date(record.checkInTime) : null;
      const checkOut = record.checkOutTime ? new Date(record.checkOutTime) : null;

      const row = ws.addRow([
        index + 1,
        record.teacherName || '',
        record.institutionName || '',
        dateObj ? format(dateObj, 'EEE, d MMM yyyy', { locale: id }) : '',
        checkIn ? format(checkIn, 'HH:mm') : '',
        checkOut ? format(checkOut, 'HH:mm') : '',
        STATUS_LABELS[record.attendanceStatus] || record.attendanceStatus || '',
        record.teachingMinutesTotal || 0,
        record.teachingSessionsCompleted || 0,
        record.lateMinutes || 0,
        record.faceMatchScore != null
          ? `Face: ${record.faceMatchScore}% | Liveness: ${record.livenessPassed ? '✓' : '✗'}`
          : '',
        record.catatan || '',
      ]);
      row.height = 16;
    });

    ws.columns.forEach((col, i) => {
      if (col) {
        let maxLength = headers[i] ? headers[i].length : 0;
        ws.eachRow({ includeEmpty: false }, (row) => {
          const cell = row.getCell(i + 1);
          if (cell.value != null) {
            const len = String(cell.value).length;
            if (len > maxLength) maxLength = len;
          }
        });
        col.width = Math.min(maxLength + 2, 40);
      }
    });

    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
        if (row.number > 1) {
          cell.font = { size: 11 };
        }
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `laporan-presensi-${format(startDate, 'yyyy-MM-dd')}-${format(endDate, 'yyyy-MM-dd')}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('Error exporting attendance reports:', err);
    return NextResponse.json({ error: err.message || 'Gagal mengexport laporan' }, { status: 500 });
  }
}
