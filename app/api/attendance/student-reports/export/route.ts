import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';
import ExcelJS from 'exceljs';
import { getOwnedWaliKelasClassIds } from '@/lib/wali-kelas/dashboard';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { generateStudentAttendancePdfBuffer, generateStudentAttendanceDocBuffer } from '@/lib/export/student-attendance-pdf';

const ExportQuerySchema = z.object({
  kelasId: z.string().uuid(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  scheduleId: z.string().uuid().optional(),
  format: z.enum(['pdf', 'docx', 'xlsx']).default('pdf'),
});

const STATUS_LABELS: Record<string, string> = {
  hadir: 'Hadir',
  sakit: 'Sakit',
  izin: 'Izin',
  alpa: 'Alpa',
};

/**
 * GET /api/attendance/student-reports/export
 *
 * Export student attendance as PDF/DOCX/Excel.
 * PDF/DOCX include kop sekolah + signature block.
 * RBAC: only wali kelas of the requested class.
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();

    const url = new URL(req.url);
    const params = ExportQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

    // RBAC
    const ownedClassIds = await getOwnedWaliKelasClassIds(session.id);
    if (!ownedClassIds.includes(params.kelasId)) {
      return NextResponse.json(
        { error: 'Anda bukan wali kelas untuk kelas ini' },
        { status: 403 }
      );
    }

    // Dates
    const startDate = params.startDate
      ? format(parseISO(params.startDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd');
    const endDate = params.endDate
      ? format(parseISO(params.endDate), 'yyyy-MM-dd')
      : startDate;

    // Build SQL
    let sqlWhere = `WHERE s.class_id = $1
                    AND sa.tanggal >= $2::date
                    AND sa.tanggal <= $3::date`;
    const sqlParams: any[] = [params.kelasId, startDate, endDate];
    let paramIdx = 4;

    if (params.scheduleId) {
      sqlWhere += ` AND sa.schedule_id = $${paramIdx}`;
      sqlParams.push(params.scheduleId);
      paramIdx++;
    }

    // Get records
    const dataRes = await query(
      `SELECT
         sa.id,
         s.nama_siswa,
         s.nisn,
         s.nomor_absen,
         sa.status,
         sa.catatan,
         sa.tanggal,
         sub.nama_mapel,
         sch.hari,
         sch.jam_mulai,
         sch.jam_selesai
       FROM student_attendance sa
       JOIN students s ON s.id = sa.student_id
       JOIN schedules sch ON sch.id = sa.schedule_id
       JOIN subjects sub ON sub.id = sch.subject_id
       ${sqlWhere}
       ORDER BY sa.tanggal DESC, s.nomor_absen ASC NULLS LAST`,
      sqlParams
    );

    // Get class + school info
    const kelasRes = await query(
      `SELECT c.id, c.nama_kelas, c.wali_kelas, s.id as school_id, s.nama_sekolah,
              s.alamat, s.npsn, s.logo,
              u.nama_lengkap as guru_nama, u.nip, u.signature_url as guru_signature_url
       FROM classes c
       JOIN schools s ON s.id = c.school_id
       LEFT JOIN users u ON u.id = c.wali_kelas_user_id
       WHERE c.id = $1`,
      [params.kelasId]
    );
    const kelasInfo = kelasRes.rows[0] || {};

    // Get kepala sekolah
    const kepalaRes = await query(
      `SELECT u.nama_lengkap, u.nip, u.signature_url
       FROM users u
       WHERE u.nama_sekolah = $1 AND u.role = 'kepala_sekolah'
       LIMIT 1`,
      [kelasInfo.nama_sekolah]
    );
    const kepalaInfo = kepalaRes.rows[0] || {};

    // Summary
    const summaryRes = await query(
      `SELECT
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE sa.status = 'hadir')::int as hadir,
         COUNT(*) FILTER (WHERE sa.status = 'sakit')::int as sakit,
         COUNT(*) FILTER (WHERE sa.status = 'izin')::int as izin,
         COUNT(*) FILTER (WHERE sa.status = 'alpa')::int as alpa
       FROM student_attendance sa
       JOIN students s ON s.id = sa.student_id
       ${sqlWhere}`,
      sqlParams
    );
    const sum = summaryRes.rows[0];
    const tingkatKehadiran = sum.total > 0
      ? Math.round(((sum.hadir || 0) / (sum.total - (sum.alpa || 0) - (sum.izin || 0) - (sum.sakit || 0) + (sum.hadir || 0))) * 100) || 0
      : 0;

    // For single-date export, use that date as tanggal; otherwise range
    const tanggalLabel = startDate === endDate
      ? format(parseISO(startDate), 'EEEE, d MMMM yyyy', { locale: id })
      : `${format(parseISO(startDate), 'd MMM yyyy', { locale: id })} — ${format(parseISO(endDate), 'd MMM yyyy', { locale: id })}`;

    const records = dataRes.rows.map((row: any) => ({
      id: row.id,
      namaSiswa: row.nama_siswa,
      nisn: row.nisn,
      nomorAbsen: row.nomor_absen,
      status: row.status,
      catatan: row.catatan,
      tanggal: format(new Date(row.tanggal), 'yyyy-MM-dd'),
    }));

    const reportData = {
      schoolName: kelasInfo.nama_sekolah,
      schoolAddress: kelasInfo.alamat,
      schoolNpsn: kelasInfo.npsn,
      schoolLogo: kelasInfo.logo,
      kelas: kelasInfo.nama_kelas,
      mapel: params.scheduleId ? (dataRes.rows[0]?.nama_mapel || '-') : null,
      guruPengampu: kelasInfo.guru_nama || kelasInfo.wali_kelas || '-',
      guruNip: kelasInfo.nip,
      tanggal: tanggalLabel,
      periodeLabel: `${format(parseISO(startDate), 'd MMM', { locale: id })} - ${format(parseISO(endDate), 'd MMM yyyy', { locale: id })}`,
      records,
      summary: {
        total: sum.total || 0,
        hadir: sum.hadir || 0,
        sakit: sum.sakit || 0,
        izin: sum.izin || 0,
        alpa: sum.alpa || 0,
        tingkatKehadiran,
      },
      kepalaNama: kepalaInfo.nama_lengkap,
      kepalaNip: kepalaInfo.nip,
      kepalaSignatureUrl: kepalaInfo.signature_url,
      guruSignatureUrl: kelasInfo.guru_signature_url,
    };

    if (params.format === 'docx') {
      const buf = generateStudentAttendanceDocBuffer(reportData);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/msword',
          'Content-Disposition': `attachment; filename="laporan-presensi-siswa-${kelasInfo.nama_kelas.replace(/\s+/g, '_')}-${startDate}.doc"`,
        },
      });
    }

    if (params.format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'GuruPRO AI';
      wb.created = new Date();

      const ws = wb.addWorksheet('Presensi Harian Siswa');
      ws.columns = [
        { width: 6 }, { width: 10 }, { width: 28 }, { width: 14 },
        { width: 10 }, { width: 30 },
      ];

      // Title
      ws.mergeCells('A1:F1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `Laporan Presensi Harian Siswa — ${kelasInfo.nama_kelas}`;
      titleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 28;

      ws.mergeCells('A2:F2');
      const metaCell = ws.getCell('A2');
      metaCell.value = `${kelasInfo.nama_sekolah}  |  ${tanggalLabel}`;
      metaCell.font = { size: 10, italic: true };
      metaCell.alignment = { horizontal: 'center' };
      ws.getRow(2).height = 16;

      // Summary
      ws.mergeCells('A3:F3');
      const sumCell = ws.getCell('A3');
      sumCell.value = `Ringkasan: Total=${sum.total} | Hadir=${sum.hadir} | Sakit=${sum.sakit} | Izin=${sum.izin} | Alpa=${sum.alpa} | Tingkat Kehadiran=${tingkatKehadiran}%`;
      sumCell.font = { size: 9 };
      sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
      ws.getRow(3).height = 14;

      // Headers
      const headers = ['No', 'No.\nAbsen', 'Nama Siswa', 'NISN', 'Status', 'Catatan'];
      const headerRow = ws.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 24;

      dataRes.rows.forEach((row: any, idx: number) => {
        const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
        const r = ws.addRow([
          idx + 1,
          row.nomor_absen ?? '-',
          row.nama_siswa,
          row.nisn || '-',
          STATUS_LABELS[row.status] || row.status,
          row.catatan || '-',
        ]);
        r.height = 14;
        r.eachCell({ includeEmpty: false }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.font = { size: 10 };
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
          };
        });
      });

      ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
        if (rowNum > 3) {
          row.eachCell({ includeEmpty: false }, (cell) => {
            cell.border = {
              top: { style: 'thin' }, left: { style: 'thin' },
              bottom: { style: 'thin' }, right: { style: 'thin' },
            };
          });
        }
      });

      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

      const buf = await wb.xlsx.writeBuffer();
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="laporan-presensi-siswa-${kelasInfo.nama_kelas.replace(/\s+/g, '_')}-${startDate}.xlsx"`,
        },
      });
    }

    // Default: PDF
    const buf = await generateStudentAttendancePdfBuffer(reportData);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="laporan-presensi-siswa-${kelasInfo.nama_kelas.replace(/\s+/g, '_')}-${startDate}.pdf"`,
      },
    });
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/attendance/student-reports/export error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
