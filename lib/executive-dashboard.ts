import { query } from "@/lib/db";

// Sprint 3.3 — Agregasi dashboard eksekutif Kepsek/Wakasek (READ-ONLY).
// Semua query membaca tabel eksisting: guru_administrasi (atp), teacher_journals,
// attendance_summary. Hasil disimpan ke executive_dashboard_cache oleh cron.

export interface ExecDashboard {
  institutionId: number;
  weekStart: string;
  weekEnd: string;
  totalGuru: number;
  guruAktifMingguIni: number;
  rataRataProgressKurikulum: number; // persen
  totalSesiMengajar: number;
  completionRateSelesaiMengajar: number; // persen guru yang sudah submit jurnal minggu ini
  progressPerMapel: { mapel: string; progress: number; total: number; persen: number }[];
  topGuru: { nama: string; sesi: number }[];
  latestLaporanMengajar: { id: string; tanggal: string; guru_nama: string; kelas: string; mapel: string; status: string }[];
}

function awalMingguIni(now = new Date()): { start: Date; end: Date } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const hari = d.getDay();
  const selisihKeSenin = hari === 0 ? -6 : 1 - hari;
  const start = new Date(d);
  start.setDate(d.getDate() + selisihKeSenin);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export async function buildExecDashboard(institutionId: number, now = new Date()): Promise<ExecDashboard> {
  const { start, end } = awalMingguIni(now);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  // Guru aktif di institusi ini
  const membersRes = await query(
    `SELECT DISTINCT im.app_user_id AS user_id
     FROM institution_members im
     JOIN institution_members_role imr ON imr.parent_id = im.id
     WHERE im.institution_id = $1 AND im.status = 'active'
       AND imr.value = 'guru'`,
    [institutionId]
  );
  const guruIds = membersRes.rows.map((r: any) => r.user_id).filter(Boolean);
  const totalGuru = guruIds.length;

  let guruAktifMingguIni = 0;
  let totalSesiMengajar = 0;
  let progressPerMapelMap: Record<string, { progress: number; total: number }> = {};
  let totalProgressPct = 0;
  let totalProgressCount = 0;
  const topGuruMap: Record<string, { nama: string; sesi: number }> = {};

  if (totalGuru > 0) {
    // Sesi mengajar minggu ini per guru (dari teacher_journals)
    const jurnalRes = await query(
      `SELECT teacher_id, COUNT(*)::integer AS sesi
       FROM teacher_journals
       WHERE teacher_id = ANY($1) AND tanggal >= $2 AND tanggal <= $3
       GROUP BY teacher_id`,
      [guruIds, startStr, endStr]
    );
    jurnalRes.rows.forEach((r: any) => {
      const sesi = Number(r.sesi) || 0;
      totalSesiMengajar += sesi;
      if (sesi > 0) guruAktifMingguIni++;
      topGuruMap[r.teacher_id] = { nama: r.teacher_id, sesi };
    });

    // Progress kurikulum dari ATP tiap guru
    const atpRes = await query(
      `SELECT judul_dokumen, konten, user_id FROM guru_administrasi
       WHERE user_id = ANY($1) AND tipe_dokumen = 'atp'`,
      [guruIds]
    );
    atpRes.rows.forEach((row: any) => {
      const konten = row.konten || {};
      const total = Number(konten.total_minggu) || 0;
      const progress = Number(konten.progress_minggu) || 0;
      if (total > 0) {
        const pct = Math.round((progress / total) * 100);
        totalProgressPct += pct;
        totalProgressCount++;
        const mapel = row.judul_dokumen || "ATP";
        if (!progressPerMapelMap[mapel]) progressPerMapelMap[mapel] = { progress: 0, total: 0 };
        progressPerMapelMap[mapel].progress += progress;
        progressPerMapelMap[mapel].total += total;
      }
    });

    // Nama guru
    const namaRes = await query(
      `SELECT id, nama_lengkap FROM users WHERE id = ANY($1)`,
      [guruIds]
    );
    const namaMap: Record<string, string> = {};
    namaRes.rows.forEach((r: any) => { namaMap[r.id] = r.nama_lengkap || "Guru"; });
    Object.keys(topGuruMap).forEach((uid) => {
      topGuruMap[uid].nama = namaMap[uid] || "Guru";
    });
  }

  const progressPerMapel = Object.entries(progressPerMapelMap).map(([mapel, v]) => ({
    mapel,
    progress: v.progress,
    total: v.total,
    persen: v.total > 0 ? Math.round((v.progress / v.total) * 100) : 0,
  }));

  const rataRataProgressKurikulum = totalProgressCount > 0 ? Math.round(totalProgressPct / totalProgressCount) : 0;
  const completionRateSelesaiMengajar = totalGuru > 0 ? Math.round((guruAktifMingguIni / totalGuru) * 100) : 0;
  const topGuru = Object.values(topGuruMap)
    .sort((a, b) => b.sesi - a.sesi)
    .slice(0, 5);

  // Latest 5 teaching reports
  const latestRes = await query(
    `SELECT tj.id, tj.tanggal, u.nama_lengkap as guru_nama,
            c.nama_kelas as kelas, s.nama_mapel as mapel, tj.status
     FROM teacher_journals tj
     JOIN institution_members im ON im.user_id = tj.teacher_id AND im.status = 'active'
     JOIN users u ON u.id = tj.teacher_id
     JOIN classes c ON c.id = tj.class_id
     JOIN subjects s ON s.id = tj.subject_id
     WHERE im.institution_id = $1
     ORDER BY tj.tanggal DESC
     LIMIT 5`,
    [institutionId]
  );
  const latestLaporanMengajar = latestRes.rows.map((r: any) => ({
    id: r.id,
    tanggal: r.tanggal?.toISOString().split('T')[0] || '',
    guru_nama: r.guru_nama || 'Guru',
    kelas: r.kelas || '-',
    mapel: r.mapel || '-',
    status: r.status || '-',
  }));

  return {
    institutionId,
    weekStart: startStr,
    weekEnd: endStr,
    totalGuru,
    guruAktifMingguIni,
    rataRataProgressKurikulum,
    totalSesiMengajar,
    completionRateSelesaiMengajar,
    progressPerMapel,
    topGuru,
    latestLaporanMengajar,
  };
}
