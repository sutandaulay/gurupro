import ExcelJS from "exceljs";
import { query } from "@/lib/db";

// Sprint 4.1 — Export Adapter Dapodik (MODUL TERPISAH).
// Murni membaca & mentransformasi data ke format ekspor Excel.
// TIDAK mengubah struktur data e-Raport / TPG / Presensi yang sudah ada.
// Guru/operator generate file lalu import manual ke Dapodik (tidak ada koneksi API ke Dapodik).

export interface DapodikExportOptions {
  institutionId: number;
  semester: "ganjil" | "genap";
  tahunAjaran: string; // "2025/2026"
  version: string; // "2024" | "2025"
}

function semesterRange(semester: string, tahunAjaran: string): { start: string; end: string } {
  const [y1] = tahunAjaran.split("/").map((s) => parseInt(s.trim()));
  if (semester === "ganjil") {
    return { start: `${y1}-07-01`, end: `${y1}-12-31` };
  }
  return { start: `${y1 + 1}-01-01`, end: `${y1 + 1}-06-30` };
}

export async function buildDapodikWorkbook(opts: DapodikExportOptions): Promise<ExcelJS.Buffer> {
  const { institutionId, semester, tahunAjaran, version } = opts;
  const { start, end } = semesterRange(semester, tahunAjaran);

  const wb = new ExcelJS.Workbook();
  wb.creator = "GuruPRO AI";
  wb.created = new Date();

  // ---- Sheet 1: Data Pokok PTK (guru di institusi) ----
  const ptkSheet = wb.addWorksheet("Data PTK");
  ptkSheet.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "Nama", key: "nama", width: 30 },
    { header: "NUPTK", key: "nuptk", width: 20 },
    { header: "NIP", key: "nip", width: 20 },
    { header: "Mapel", key: "mapel", width: 25 },
    { header: "Status", key: "status", width: 15 },
  ];
  const ptkRes = await query(
    `SELECT DISTINCT u.id, u.nama_lengkap, u.nip
     FROM payload.institution_members im
     JOIN payload.institution_members_role imr ON imr.parent_id = im.id
     JOIN users u ON u.id = im.app_user_id
     WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'`,
    [institutionId]
  );
  ptkRes.rows.forEach((r: any, i: number) => {
    ptkSheet.addRow({ no: i + 1, nama: r.nama_lengkap || "", nuptk: "", nip: r.nip || "", mapel: "", status: "Aktif" });
  });

  // ---- Sheet 2: Rekap TPG (dari attendance_summary) ----
  const tpgSheet = wb.addWorksheet("Rekap TPG");
  tpgSheet.columns = [
    { header: "Nama Guru", key: "nama", width: 30 },
    { header: "Total Menit", key: "menit", width: 15 },
    { header: "Total Jam", key: "jam", width: 12 },
    { header: "Sesi", key: "sesi", width: 10 },
    { header: "Hari Hadir", key: "hadir", width: 12 },
  ];
  const tpgRes = await query(
    `SELECT u.nama_lengkap,
            COALESCE(SUM(asum.teaching_minutes_total),0)::int AS menit,
            COALESCE(SUM(asum.teaching_sessions_completed),0)::int AS sesi,
            COUNT(CASE WHEN asum.attendance_status IN ('hadir','telat') THEN 1 END)::int AS hadir
     FROM payload.institution_members im
     JOIN users u ON u.id = im.app_user_id
     LEFT JOIN attendance_summary asum ON asum.teacher_id = im.app_user_id
        AND asum.institution_id = im.institution_id
        AND asum.date >= $2 AND asum.date <= $3
     WHERE im.institution_id = $1 AND im.status = 'active'
     GROUP BY u.id, u.nama_lengkap`,
    [institutionId, start, end]
  );
  tpgRes.rows.forEach((r: any) => {
    const menit = Number(r.menit) || 0;
    tpgSheet.addRow({
      nama: r.nama_lengkap || "",
      menit,
      jam: (menit / 60).toFixed(1),
      sesi: Number(r.sesi) || 0,
      hadir: Number(r.hadir) || 0,
    });
  });

  // ---- Sheet 3: Presensi (ringkas per guru) ----
  const presSheet = wb.addWorksheet("Presensi");
  presSheet.columns = [
    { header: "Nama Guru", key: "nama", width: 30 },
    { header: "Hadir", key: "hadir", width: 10 },
    { header: "Terlambat", key: "telat", width: 10 },
    { header: "Izin", key: "izin", width: 10 },
    { header: "Sakit", key: "sakit", width: 10 },
    { header: "Alpa", key: "alpa", width: 10 },
  ];
  const presRes = await query(
    `SELECT u.nama_lengkap,
            COUNT(CASE WHEN asum.attendance_status='hadir' THEN 1 END)::int AS hadir,
            COUNT(CASE WHEN asum.attendance_status='telat' THEN 1 END)::int AS telat,
            COUNT(CASE WHEN asum.attendance_status='izin' THEN 1 END)::int AS izin,
            COUNT(CASE WHEN asum.attendance_status='sakit' THEN 1 END)::int AS sakit,
            COUNT(CASE WHEN asum.attendance_status='alpa' THEN 1 END)::int AS alpa
     FROM payload.institution_members im
     JOIN users u ON u.id = im.app_user_id
     LEFT JOIN attendance_summary asum ON asum.teacher_id = im.app_user_id
        AND asum.institution_id = im.institution_id
        AND asum.date >= $2 AND asum.date <= $3
     WHERE im.institution_id = $1 AND im.status = 'active'
     GROUP BY u.id, u.nama_lengkap`,
    [institutionId, start, end]
  );
  presRes.rows.forEach((r: any) => {
    presSheet.addRow({
      nama: r.nama_lengkap || "",
      hadir: Number(r.hadir) || 0,
      telat: Number(r.telat) || 0,
      izin: Number(r.izin) || 0,
      sakit: Number(r.sakit) || 0,
      alpa: Number(r.alpa) || 0,
    });
  });

  // ---- Sheet 4: Metadata ekspor ----
  const metaSheet = wb.addWorksheet("Metadata");
  metaSheet.columns = [{ header: "Key", key: "k", width: 25 }, { header: "Value", key: "v", width: 40 }];
  metaSheet.addRow({ k: "Versi Dapodik", v: version });
  metaSheet.addRow({ k: "Tahun Ajaran", v: tahunAjaran });
  metaSheet.addRow({ k: "Semester", v: semester });
  metaSheet.addRow({ k: "Diekspor dari", v: "GuruPRO AI" });
  metaSheet.addRow({ k: "Tanggal Ekspor", v: new Date().toLocaleString("id-ID") });

  return (await wb.xlsx.writeBuffer()) as ExcelJS.Buffer;
}
