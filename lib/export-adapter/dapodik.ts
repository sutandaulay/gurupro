import ExcelJS from "exceljs";
import { query } from "@/lib/db";

// Sprint 4.1 — Export Adapter Dapodik (MODUL TERPISAH).
// Murni membaca & mentransformasi data ke format ekspor Excel.
// TIDAK mengubah struktur data e-Raport / TPG / Presensi yang sudah ada.
// Guru/operator generate file lalu import manual ke Dapodik (tidak ada koneksi API ke Dapodik).

export interface DapodikExportOptions {
  institutionId: number;
  semester: "ganjil" | "genap";
  tahunAjaran: string;
  version: string;
}

function semesterRange(semester: string, tahunAjaran: string): { start: string; end: string } {
  const [y1] = tahunAjaran.split("/").map((s) => parseInt(s.trim()));
  if (semester === "ganjil") {
    return { start: `${y1}-07-01`, end: `${y1}-12-31` };
  }
  return { start: `${y1 + 1}-01-01`, end: `${y1 + 1}-06-30` };
}

// Helper: apply header style
function styleHeaderRow(ws: ExcelJS.Worksheet, rowIndex: number, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    const cell = ws.getCell(`${String.fromCharCode(64 + c)}${rowIndex}`);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
  }
  ws.getRow(rowIndex).height = 20;
}

// Helper: apply data row style
function styleDataRow(row: ExcelJS.Row, rowIndex: number, colCount: number) {
  const bgColor = rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.font = { size: 11 };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
    if (c > 1) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }
}

// Helper: format menit to jam-menit string
function formatJam(menit: number): string {
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  if (j === 0) return `${m}m`;
  if (m === 0) return `${j}j`;
  return `${j}j ${m}m`;
}

export async function buildDapodikWorkbook(opts: DapodikExportOptions): Promise<ExcelJS.Buffer> {
  const { institutionId, semester, tahunAjaran, version } = opts;
  const { start, end } = semesterRange(semester, tahunAjaran);

  const wb = new ExcelJS.Workbook();
  wb.creator = "GuruPRO AI";
  wb.created = new Date();

  // ---- Sheet 1: Data Pokok PTK (guru di institusi) ----
  const ptkSheet = wb.addWorksheet("Data PTK");
  const ptkColumns = [
    { header: "No", key: "no", width: 5 },
    { header: "Nama", key: "nama", width: 30 },
    { header: "NUPTK", key: "nuptk", width: 20 },
    { header: "NIP", key: "nip", width: 20 },
    { header: "Mapel", key: "mapel", width: 25 },
    { header: "Status", key: "status", width: 15 },
  ];
  ptkSheet.columns = ptkColumns;

  const ptkRes = await query(
    `SELECT DISTINCT u.id, u.nama_lengkap, u.nip
     FROM public.institution_members im
     JOIN payload.institution_members_role imr ON imr.parent_id = im.id
     JOIN users u ON u.id = im.app_user_id
     WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'`,
    [institutionId]
  );
  ptkRes.rows.forEach((r: any, i: number) => {
    const row = ptkSheet.addRow({ no: i + 1, nama: r.nama_lengkap || "", nuptk: r.nuptk || "", nip: r.nip || "", mapel: r.mapel || "", status: "Aktif" });
    styleDataRow(row, i + 1, 6);
  });

  // Style header
  styleHeaderRow(ptkSheet, 1, 6);
  ptkSheet.getColumn(1).width = 5;

  // Freeze header
  ptkSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];

  // ---- Sheet 2: Rekap TPG (dari attendance_summary) ----
  const tpgSheet = wb.addWorksheet("Rekap TPG");
  const tpgColumns = [
    { header: "Nama Guru", key: "nama", width: 30 },
    { header: "Total Menit", key: "menit", width: 15 },
    { header: "Total Jam", key: "jam", width: 12 },
    { header: "Sesi", key: "sesi", width: 10 },
    { header: "Hari Hadir", key: "hadir", width: 12 },
  ];
  tpgSheet.columns = tpgColumns;

  const tpgRes = await query(
    `SELECT u.nama_lengkap,
            COALESCE(SUM(asum.teaching_minutes_total),0)::int AS menit,
            COALESCE(SUM(asum.teaching_sessions_completed),0)::int AS sesi,
            COUNT(DISTINCT CASE WHEN asum.attendance_status IN ('hadir','telat') THEN DATE(asum.date) END)::int AS hadir
     FROM public.institution_members im
     JOIN users u ON u.id = im.app_user_id
     LEFT JOIN attendance_summary asum ON asum.teacher_id = im.app_user_id
        AND asum.institution_id = im.institution_id
        AND asum.date >= $2 AND asum.date <= $3
     WHERE im.institution_id = $1 AND im.status = 'active'
     GROUP BY u.id, u.nama_lengkap`,
    [institutionId, start, end]
  );
  tpgRes.rows.forEach((r: any, i: number) => {
    const menit = Number(r.menit) || 0;
    const row = tpgSheet.addRow({
      nama: r.nama_lengkap || "",
      menit,
      jam: formatJam(menit),
      sesi: Number(r.sesi) || 0,
      hadir: Number(r.hadir) || 0,
    });
    styleDataRow(row, i + 1, 5);
  });

  // Grand total row
  const totalMenit = tpgRes.rows.reduce((s: number, r: any) => s + (Number(r.menit) || 0), 0);
  const totalRow = tpgSheet.addRow({ nama: "TOTAL", menit: totalMenit, jam: formatJam(totalMenit), sesi: 0, hadir: 0 });
  styleHeaderRow(tpgSheet, tpgSheet.rowCount, 5);

  styleHeaderRow(tpgSheet, 1, 5);
  tpgSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];

  // ---- Sheet 3: Presensi (ringkas per guru) ----
  const presSheet = wb.addWorksheet("Presensi");
  const presColumns = [
    { header: "Nama Guru", key: "nama", width: 30 },
    { header: "Hadir", key: "hadir", width: 10 },
    { header: "Terlambat", key: "telat", width: 10 },
    { header: "Izin", key: "izin", width: 10 },
    { header: "Sakit", key: "sakit", width: 10 },
    { header: "Alpa", key: "alpa", width: 10 },
  ];
  presSheet.columns = presColumns;

  const presRes = await query(
    `SELECT u.nama_lengkap,
            COUNT(DISTINCT CASE WHEN asum.attendance_status='hadir' THEN DATE(asum.date) END)::int AS hadir,
            COUNT(DISTINCT CASE WHEN asum.attendance_status='telat' THEN DATE(asum.date) END)::int AS telat,
            COUNT(DISTINCT CASE WHEN asum.attendance_status='izin' THEN DATE(asum.date) END)::int AS izin,
            COUNT(DISTINCT CASE WHEN asum.attendance_status='sakit' THEN DATE(asum.date) END)::int AS sakit,
            COUNT(DISTINCT CASE WHEN asum.attendance_status='alpa' THEN DATE(asum.date) END)::int AS alpa
     FROM public.institution_members im
     JOIN users u ON u.id = im.app_user_id
     LEFT JOIN attendance_summary asum ON asum.teacher_id = im.app_user_id
        AND asum.institution_id = im.institution_id
        AND asum.date >= $2 AND asum.date <= $3
     WHERE im.institution_id = $1 AND im.status = 'active'
     GROUP BY u.id, u.nama_lengkap`,
    [institutionId, start, end]
  );
  presRes.rows.forEach((r: any, i: number) => {
    const row = presSheet.addRow({
      nama: r.nama_lengkap || "",
      hadir: Number(r.hadir) || 0,
      telat: Number(r.telat) || 0,
      izin: Number(r.izin) || 0,
      sakit: Number(r.sakit) || 0,
      alpa: Number(r.alpa) || 0,
    });
    styleDataRow(row, i + 1, 6);
  });

  styleHeaderRow(presSheet, 1, 6);
  presSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];

  // ---- Sheet 4: Metadata ekspor ----
  const metaSheet = wb.addWorksheet("Metadata");
  metaSheet.columns = [{ header: "Key", key: "k", width: 25 }, { header: "Value", key: "v", width: 40 }];
  metaSheet.addRow({ k: "Versi Dapodik", v: version });
  metaSheet.addRow({ k: "Tahun Ajaran", v: tahunAjaran });
  metaSheet.addRow({ k: "Semester", v: semester });
  metaSheet.addRow({ k: "Diekspor dari", v: "GuruPRO AI" });
  metaSheet.addRow({ k: "Tanggal Ekspor", v: new Date().toLocaleString("id-ID") });

  // Style metadata
  metaSheet.getColumn(1).width = 25;
  metaSheet.getColumn(2).width = 40;
  metaSheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { bold: true, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  });

  return (await wb.xlsx.writeBuffer()) as ExcelJS.Buffer;
}
