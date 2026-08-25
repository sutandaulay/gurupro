import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';
import ExcelJS from 'exceljs';
import { getOwnedWaliKelasClassIds } from '@/lib/wali-kelas/dashboard';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { generateStudentAttendancePdfBuffer } from '@/lib/export/student-attendance-pdf';

const ExportQuerySchema = z.object({
  kelasId: z.string().uuid(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  scheduleId: z.string().uuid().optional(),
  format: z.enum(['pdf', 'xlsx']).default('xlsx'),
});

const STATUS_LABELS: Record<string, string> = {
  hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin', alpa: 'Alpa',
};
const STATUS_COLORS_XLSX: Record<string, { fg: string; font: string }> = {
  hadir: { fg: 'FFDCEFCB', font: 'FF10B981' },
  sakit: { fg: 'FFDBEAFE', font: 'FF0EA5E9' },
  izin:  { fg: 'FFFFF3CD', font: 'FFF59E0B' },
  alpa:  { fg: 'FFFEE2E2', font: 'FFF43F5E' },
};
const STATUS_COLORS_HEX: Record<string, string> = {
  hadir: '#10b981', sakit: '#0ea5e9', izin: '#f59e0b', alpa: '#f43f5e',
};

/**
 * GET /api/attendance/student-reports/export
 *
 * Export: professional XLSX (3 sheets) or PDF.
 * XLSX: Ringkasan + Matrix presensi + Detail harian
 * PDF: landscape/portrait auto, kop sekolah, matrix table, signatures
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const params = ExportQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const ownedClassIds = await getOwnedWaliKelasClassIds(session.id);
    if (!ownedClassIds.includes(params.kelasId)) {
      return NextResponse.json({ error: 'Anda bukan wali kelas untuk kelas ini' }, { status: 403 });
    }

    const startDate = params.startDate
      ? format(parseISO(params.startDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd');
    const endDate = params.endDate
      ? format(parseISO(params.endDate), 'yyyy-MM-dd')
      : startDate;

    const sqlWhere = `WHERE s.class_id = $1 AND sa.tanggal >= $2::date AND sa.tanggal <= $3::date`;
    const sqlParams: any[] = [params.kelasId, startDate, endDate];

    // Class + school info
    const kelasRes = await query(
      `SELECT c.id, c.nama_kelas, c.wali_kelas, c.wali_kelas_nip, s.nama_sekolah,
              s.alamat, s.npsn, s.logo,
              u.nama_lengkap as guru_nama, u.signature_url as guru_signature_url
       FROM classes c
       JOIN schools s ON s.id = c.school_id
       LEFT JOIN users u ON u.id = c.wali_kelas_user_id
       WHERE c.id = $1`,
      [params.kelasId]
    );
    const kelasInfo = kelasRes.rows[0] || {};

    // Kepala sekolah
    const kepalaRes = await query(
      `SELECT u.nama_lengkap, u.signature_url
       FROM users u
       WHERE u.nama_sekolah = $1 AND u.role = 'kepala_sekolah'
       LIMIT 1`,
      [kelasInfo.nama_sekolah]
    );
    const kepalaInfo = kepalaRes.rows[0] || {};

    // All attendance records (case-insensitive, deduplicated per student-day)
    const dataRes = await query(
      `WITH ranked AS (
         SELECT
           sa.student_id, sa.tanggal, LOWER(sa.status) AS status,
           ROW_NUMBER() OVER (
             PARTITION BY sa.student_id, sa.tanggal
             ORDER BY
               CASE LOWER(sa.status) WHEN 'alpa' THEN 1 WHEN 'izin' THEN 2 WHEN 'sakit' THEN 3 WHEN 'hadir' THEN 4 ELSE 5 END,
               sch.jam_mulai ASC NULLS LAST, sa.schedule_id ASC
           ) AS rn
         FROM student_attendance sa
         JOIN students s ON s.id = sa.student_id
         JOIN schedules sch ON sch.id = sa.schedule_id
         ${sqlWhere}
       )
       SELECT r.student_id, s.nama_siswa, s.nisn, s.nomor_absen,
              r.status, sa.catatan, r.tanggal
       FROM ranked r
       JOIN students s ON s.id = r.student_id
       JOIN student_attendance sa ON sa.student_id = r.student_id
         AND sa.tanggal = r.tanggal AND LOWER(sa.status) = r.status
         AND sa.schedule_id = (
           SELECT sa2.schedule_id FROM student_attendance sa2
           JOIN schedules sch2 ON sch2.id = sa2.schedule_id
           WHERE sa2.student_id = r.student_id AND sa2.tanggal = r.tanggal
           ORDER BY
             CASE LOWER(sa2.status) WHEN 'alpa' THEN 1 WHEN 'izin' THEN 2 WHEN 'sakit' THEN 3 WHEN 'hadir' THEN 4 ELSE 5 END,
             sch2.jam_mulai ASC NULLS LAST, sa2.schedule_id ASC
           LIMIT 1
         )
       WHERE r.rn = 1
       ORDER BY s.nomor_absen ASC NULLS LAST, r.tanggal ASC`,
      sqlParams
    );

    // All students
    const studentsRes = await query(
      `SELECT id, nama_siswa, nisn, nomor_absen
       FROM students WHERE class_id = $1
       ORDER BY nomor_absen ASC NULLS LAST, nama_siswa ASC`,
      [params.kelasId]
    );

    // Dates in range
    const dates = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
    const dateStrs = dates.map(d => format(d, 'yyyy-MM-dd'));
    const dateLabels = dates.map(d => format(d, 'EEE, d', { locale: id }));

    // Summary
    const summaryRes = await query(
      `SELECT
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE r.status = 'hadir')::int as hadir,
         COUNT(*) FILTER (WHERE r.status = 'sakit')::int as sakit,
         COUNT(*) FILTER (WHERE r.status = 'izin')::int as izin,
         COUNT(*) FILTER (WHERE r.status = 'alpa')::int as alpa
       FROM (
         SELECT LOWER(FIRST_VALUE(sa.status) OVER (
           PARTITION BY sa.student_id, sa.tanggal
           ORDER BY
             CASE LOWER(sa.status) WHEN 'alpa' THEN 1 WHEN 'izin' THEN 2 WHEN 'sakit' THEN 3 WHEN 'hadir' THEN 4 ELSE 5 END,
             sch.jam_mulai ASC NULLS LAST, sa.schedule_id ASC
         )) AS status
         FROM student_attendance sa
         JOIN students s ON s.id = sa.student_id
         JOIN schedules sch ON sch.id = sa.schedule_id
         ${sqlWhere}
       ) r`,
      sqlParams
    );
    const sum = summaryRes.rows[0];
    const sumStatus = (sum.hadir || 0) + (sum.sakit || 0) + (sum.izin || 0) + (sum.alpa || 0);
    const tingkatKehadiran = sumStatus > 0
      ? Math.round(((sum.hadir || 0) / sumStatus) * 100) : 0;

    // Build record map for matrix
    const recordMap: Record<string, { status: string; catatan: string }> = {};
    for (const row of dataRes.rows) {
      recordMap[`${row.student_id}__${format(new Date(row.tanggal), 'yyyy-MM-dd')}`] = {
        status: row.status, catatan: row.catatan
      };
    }

    // Build matrix
    const matrix = studentsRes.rows.map((s: any) => {
      const perDate: Record<string, { status: string; catatan: string } | null> = {};
      for (const ds of dateStrs) {
        perDate[ds] = recordMap[`${s.id}__${ds}`] || null;
      }
      const totals = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
      let filledDays = 0;
      Object.values(perDate).forEach((v: any) => {
        if (v !== null) {
          filledDays++;
          if (v.status) totals[v.status as keyof typeof totals]++;
        }
      });
      const pct = filledDays > 0 ? Math.round((totals.hadir / filledDays) * 100) : 0;
      return { studentId: s.id, namaSiswa: s.nama_siswa, nisn: s.nisn, nomorAbsen: s.nomor_absen, perDate, totals: { ...totals, pct } };
    });

    const records = dataRes.rows.map((row: any) => ({
      id: row.id, studentId: row.student_id,
      namaSiswa: row.nama_siswa, nisn: row.nisn, nomorAbsen: row.nomor_absen,
      status: row.status, catatan: row.catatan,
      tanggal: format(new Date(row.tanggal), 'yyyy-MM-dd'),
    }));

    const reportData = {
      schoolName: kelasInfo.nama_sekolah,
      schoolAddress: kelasInfo.alamat,
      schoolNpsn: kelasInfo.npsn,
      schoolLogo: kelasInfo.logo,
      kelas: kelasInfo.nama_kelas,
      mapel: null,
      guruPengampu: kelasInfo.guru_nama || kelasInfo.wali_kelas || '-',
      guruNip: kelasInfo.wali_kelas_nip,
      tanggal: startDate === endDate
        ? format(parseISO(startDate), 'EEEE, d MMMM yyyy', { locale: id })
        : `${format(parseISO(startDate), 'd MMM yyyy', { locale: id })} — ${format(parseISO(endDate), 'd MMM yyyy', { locale: id })}`,
      periodeLabel: `${format(parseISO(startDate), 'd MMM', { locale: id })} - ${format(parseISO(endDate), 'd MMM yyyy', { locale: id })}`,
      records, matrix, dateStrs, dateLabels,
      summary: {
        total: sum.total || 0, hadir: sum.hadir || 0,
        sakit: sum.sakit || 0, izin: sum.izin || 0, alpa: sum.alpa || 0,
        tingkatKehadiran,
      },
      kepalaNama: kepalaInfo.nama_lengkap,
      kepalaSignatureUrl: kepalaInfo.signature_url,
      guruSignatureUrl: kelasInfo.guru_signature_url,
    };

    const filename = `presensi_${kelasInfo.nama_kelas.replace(/\s+/g, '_')}_${startDate}_${endDate}`;

    // ---- PDF (landscape matrix) ----
    if (params.format === 'pdf') {
      const buf = await generateStudentAttendancePdfBuffer(reportData as any);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        },
      });
    }

    // ---- XLSX (3 sheets) ----
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GuruPRO AI';
    wb.created = new Date();

    const NAVY = 'FF1E3A8A';
    const DK = 'FF1F2937';
    const GY = 'FF6B7280';

    // ============================================================
    // SHEET 1 — RINGKASAN
    // ============================================================
    const ws1 = wb.addWorksheet('Ringkasan');
    ws1.columns = [{ width: 24 }, { width: 28 }];

    // Title
    ws1.mergeCells('A1:B1');
    const t1 = ws1.getCell('A1');
    t1.value = 'LAPORAN PRESENSI HARIAN SISWA';
    t1.font = { size: 16, bold: true, color: { argb: NAVY } };
    t1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(1).height = 32;

    ws1.mergeCells('A2:B2');
    const t2 = ws1.getCell('A2');
    t2.value = kelasInfo.nama_sekolah || '—';
    t2.font = { size: 11, bold: true, color: { argb: DK } };
    t2.alignment = { horizontal: 'center' };

    // Separator
    ws1.mergeCells('A3:B3');
    ws1.getCell('A3').border = { bottom: { style: 'medium', color: { argb: NAVY } } };

    // Info rows
    const infoRows = [
      ['Kelas', kelasInfo.nama_kelas || '—'],
      ['Wali Kelas', `${kelasInfo.guru_nama || kelasInfo.wali_kelas || '—'}${kelasInfo.wali_kelas_nip ? `, NIP. ${kelasInfo.wali_kelas_nip}` : ''}`],
      ['Periode', `${format(parseISO(startDate), 'd MMM yyyy', { locale: id })} — ${format(parseISO(endDate), 'd MMM yyyy', { locale: id })}`],
      ['Jumlah Siswa', String(studentsRes.rows.length)],
      ['Tanggal Cetak', format(new Date(), 'd MMMM yyyy, HH:mm', { locale: id })],
    ];
    infoRows.forEach(([label, value], i) => {
      const r = ws1.addRow([label, value]);
      r.getCell(1).font = { bold: true, size: 10, color: { argb: DK } };
      r.getCell(2).font = { size: 10, color: { argb: DK } };
      r.height = 18;
    });

    // Summary section header
    const sumRow = ws1.addRow([]);
    ws1.mergeCells(`A${sumRow.number + 1}:B${sumRow.number + 1}`);
    const sh = ws1.getCell(`A${sumRow.number}`);
    sh.value = 'RINGKASAN KEHADIRAN';
    sh.font = { size: 11, bold: true, color: { argb: NAVY } };
    sh.border = { bottom: { style: 'thin', color: { argb: NAVY } } };

    const summaryCards = [
      { label: 'Tingkat Kehadiran', value: `${tingkatKehadiran}%`, color: tingkatKehadiran >= 90 ? 'FF10B981' : tingkatKehadiran >= 75 ? 'FFF59E0B' : 'FFF43F5E', bg: tingkatKehadiran >= 90 ? 'FFDCEFCB' : tingkatKehadiran >= 75 ? 'FFFFF3CD' : 'FFFEE2E2' },
      { label: 'Total Data', value: String(sum.total || 0), color: `FF${DK}`, bg: 'FFF3F4F6' },
      { label: 'Hadir', value: String(sum.hadir || 0), color: 'FF10B981', bg: 'FFDCEFCB' },
      { label: 'Sakit', value: String(sum.sakit || 0), color: 'FF0EA5E9', bg: 'FFDBEAFE' },
      { label: 'Izin', value: String(sum.izin || 0), color: 'FFF59E0B', bg: 'FFFFF3CD' },
      { label: 'Alpa', value: String(sum.alpa || 0), color: 'FFF43F5E', bg: 'FFFEE2E2' },
    ];

    for (const card of summaryCards) {
      const r = ws1.addRow([card.label, card.value]);
      r.getCell(1).font = { size: 10, color: { argb: DK } };
      r.getCell(2).font = { size: 14, bold: true, color: { argb: card.color } };
      r.getCell(2).alignment = { horizontal: 'center' };
      r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.bg } };
      r.height = 22;
    }

    // Consistency check
    const consistent = sumStatus === sum.total;
    const cr = ws1.addRow([]);
    ws1.mergeCells(`A${cr.number + 1}:B${cr.number + 1}`);
    const cc = ws1.getCell(`A${cr.number}`);
    cc.value = consistent
      ? `✓ Data konsisten: ${sum.hadir}+${sum.sakit}+${sum.izin}+${sum.alpa} = ${sumStatus}`
      : `⚠ Selisih: total=${sum.total} tapi H+S+I+A=${sumStatus}`;
    cc.font = { size: 9, bold: true, color: { argb: consistent ? 'FF10B981' : 'FFF43F5E' } };
    cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: consistent ? 'FFDCEFCB' : 'FFFEE2E2' } };
    cc.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

    ws1.views = [{ state: 'frozen', xSplit: 0, ySplit: 0 }];

    // ============================================================
    // SHEET 2 — MATRIX PRESENSI
    // ============================================================
    const ws2 = wb.addWorksheet('Matrix Presensi');

    // Build matrix header columns
    const matrixCols: Partial<ExcelJS.Column>[] = [
      { width: 5 },   // No
      { width: 6 },  // No. Absen
      { width: 24 }, // Nama Siswa
      { width: 14 }, // NISN
    ];
    // One column per date
    for (const dl of dateLabels) matrixCols.push({ width: 9 });
    // Total columns (H, S, I, A, % Hadir)
    matrixCols.push({ width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 7 });
    ws2.columns = matrixCols;

    // Title
    const totalCols = 4 + dateStrs.length + 5;
    ws2.mergeCells(1, 1, 1, totalCols);
    const mt = ws2.getCell('A1');
    mt.value = `Matrix Presensi Siswa — ${kelasInfo.nama_kelas}  |  ${format(parseISO(startDate), 'd MMM', { locale: id })} — ${format(parseISO(endDate), 'd MMM yyyy', { locale: id })}`;
    mt.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    mt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    mt.alignment = { horizontal: 'center', vertical: 'middle' };
    ws2.getRow(1).height = 24;

    // Date header row
    ws2.getRow(2).values = [
      'No', 'No.\nAbsen', 'Nama Siswa', 'NISN',
      ...dateLabels,
      'H', 'S', 'I', 'A', '% Hadir',
    ];
    const hRow = ws2.getRow(2);
    hRow.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    hRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    hRow.height = 28;
    hRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
      if (colNum > 4 && colNum <= 4 + dateStrs.length) {
        const dayIdx = colNum - 5;
        const dayOfWeek = format(parseISO(dateStrs[dayIdx]), 'EEE', { locale: id });
        const isWeekend = dayOfWeek === 'Min' || dayOfWeek === 'Sab' || dayOfWeek === 'Sun';
        if (isWeekend) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
          cell.font = { size: 7, color: { argb: 'FF9CA3AF' } };
        }
      }
      // % Hadir header cell: green
      if (colNum === 4 + dateStrs.length + 5) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      }
    });

    // Data rows
    const STATUS_SHORT: Record<string, string> = { hadir: 'H', sakit: 'S', izin: 'I', alpa: 'A' };
    matrix.forEach((s, si) => {
      const rowNum = si + 3;
      const bg = si % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';

      // Static data cells
      const nameCell = ws2.getRow(rowNum).getCell(4);
      const cell4Content = `${s.nomorAbsen != null ? String(s.nomorAbsen).padStart(2, ' ') + '  ' : '   '}${s.namaSiswa}`;
      nameCell.value = cell4Content;

      // Build row values
      const rowVals: any[] = [si + 1, s.nomorAbsen ?? '-', s.namaSiswa, s.nisn || '-'];
      for (let di = 0; di < dateStrs.length; di++) {
        const v = s.perDate[dateStrs[di]];
        rowVals.push(v ? STATUS_SHORT[v.status] || v.status?.charAt(0).toUpperCase() : '—');
      }
      rowVals.push(
        s.totals.hadir || 0,
        s.totals.sakit || 0,
        s.totals.izin || 0,
        s.totals.alpa || 0,
        `${s.totals.pct}%`,
      );

      const row = ws2.getRow(rowNum);
      row.values = rowVals;
      row.height = 18;

      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        const colIdx = colNum - 1;

        // Determine background and font color
        let fillColor = bg;
        let fontColor = `FF${DK}`;
        let bold = false;

        // Status columns (5 to 4+dateStrs.length)
        if (colIdx >= 4 && colIdx < 4 + dateStrs.length) {
          const di = colIdx - 4;
          const v = s.perDate[dateStrs[di]];
          if (v?.status) {
            const sc = STATUS_COLORS_XLSX[v.status];
            if (sc) { fillColor = sc.fg; fontColor = sc.font; bold = true; }
          } else {
            fillColor = 'FFF9FAFB';
            fontColor = 'FF9CA3AF';
          }
        }

        // Total H/S/I/A columns
        if (colIdx >= 4 + dateStrs.length && colIdx < 4 + dateStrs.length + 4) {
          const ti = colIdx - (4 + dateStrs.length);
          const totalKeys = ['hadir', 'sakit', 'izin', 'alpa'] as const;
          const tk = totalKeys[ti];
          const tv = s.totals[tk] || 0;
          if (tv > 0) {
            fillColor = STATUS_COLORS_XLSX[tk]?.fg || bg;
            fontColor = STATUS_COLORS_XLSX[tk]?.font || fontColor;
            bold = true;
          }
        }

        // % Hadir column (last total col)
        if (colIdx === 4 + dateStrs.length + 4) {
          const pct = s.totals.pct || 0;
          if (pct >= 90) { fillColor = 'FFDCEFCB'; fontColor = 'FF10B981'; bold = true; }
          else if (pct >= 75) { fillColor = 'FFFFF3CD'; fontColor = 'FFF59E0B'; bold = true; }
          else if (pct > 0) { fillColor = 'FFFEE2E2'; fontColor = 'FFF43F5E'; bold = true; }
        }

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
        cell.font = { size: 9, color: { argb: fontColor }, bold };
        cell.alignment = {
          horizontal: colIdx === 0 || colIdx === 1 || colIdx === 2 || colIdx >= 4 ? 'center' : 'left',
          vertical: 'middle',
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };

        // Name column: left align, smaller font
        if (colIdx === 2) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.font = { size: 9, color: { argb: fontColor }, bold: false };
        }
      });
    });

    // Freeze panes: freeze first 4 columns (No, Absen, Nama, NISN) and header row
    ws2.views = [{ state: 'frozen', xSplit: 4, ySplit: 2, activeCell: 'E3' }];

    // ============================================================
    // SHEET 3 — DETAIL HARIAN
    // ============================================================
    const ws3 = wb.addWorksheet('Detail Harian');
    ws3.columns = [
      { width: 5 },   // No
      { width: 6 },   // No. Absen
      { width: 24 },  // Nama Siswa
      { width: 14 },  // NISN
      { width: 14 },  // Tanggal
      { width: 10 },  // Status
      { width: 28 }, // Catatan
    ];

    // Title
    ws3.mergeCells('A1:G1');
    const dt = ws3.getCell('A1');
    dt.value = `Detail Presensi Harian — ${kelasInfo.nama_kelas}  |  ${format(parseISO(startDate), 'd MMM', { locale: id })} — ${format(parseISO(endDate), 'd MMM yyyy', { locale: id })}`;
    dt.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    dt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    dt.alignment = { horizontal: 'center', vertical: 'middle' };
    ws3.getRow(1).height = 24;

    const dHeaders = ['No', 'No.\nAbsen', 'Nama Siswa', 'NISN', 'Tanggal', 'Status', 'Catatan'];
    const dhRow = ws3.addRow(dHeaders);
    dhRow.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    dhRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    dhRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    dhRow.height = 22;

    records.forEach((rec: any, idx: number) => {
      const st = STATUS_COLORS_XLSX[rec.status] || { fg: 'FFFFFFFF', font: `FF${DK}` };
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
      const r = ws3.addRow([
        idx + 1,
        rec.nomorAbsen ?? '-',
        rec.namaSiswa,
        rec.nisn || '-',
        rec.tanggal ? format(parseISO(rec.tanggal), 'd MMM yyyy', { locale: id }) : '-',
        STATUS_LABELS[rec.status] || rec.status,
        rec.catatan || '-',
      ]);
      r.height = 16;
      r.eachCell({ includeEmpty: false }, (cell, colNum) => {
        const isStatusCol = colNum === 6;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isStatusCol ? st.fg : bg } };
        cell.font = { size: 9, color: { argb: isStatusCol ? st.font : `FF${DK}` }, bold: isStatusCol };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
        if (colNum === 1 || colNum === 2 || colNum === 4 || colNum === 6) {
          cell.alignment = { horizontal: 'center' };
        }
      });
    });

    ws3.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' }];

    // ---- Generate and return ----
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
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
