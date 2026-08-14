import { query } from "@/lib/db";
import {
  getGuruList,
  toNamaMap,
  getStrukturStaf,
  getGuruTelat3x,
  getGuruBelumTerassign,
  getRaportStats,
  getRaportMendekatiDeadline,
  awalMingguIni,
} from "@/lib/dashboard-stats";

// =====================================================
// Sprint 3.3 / Dashboard Institusi v2
// Agregasi dashboard eksekutif KS + Wakasek.
// Semua query membaca tabel eksisting.
// Hasil disimpan ke executive_dashboard_cache oleh cron.
// =====================================================

export interface ExecDashboard {
  institutionId: number;
  weekStart: string;
  weekEnd: string;
  // Kehadiran
  totalGuru: number;
  guruAktifMingguIni: number;
  guruTelat3x: { nama: string; jumlahTelat: number }[];
  totalSesiMengajar: number;
  completionRateSelesaiMengajar: number;
  // Raport 3 Lapis
  raportStats: {
    total: number;
    draft: number;
    dikirim_ke_wali_kelas: number;
    dikonfirmasi: number;
    difinalisasi: number;
    siap_print: number;
  };
  raportMingguIni: { status: string; jumlah: number }[];
  raportMendekatiDeadline: number;
  // Kurikulum
  rataRataProgressKurikulum: number;
  progressPerMapel: { mapel: string; progress: number; total: number; persen: number }[];
  // Aktivitas
  topGuru: { nama: string; sesi: number; menit: number }[];
  latestLaporanMengajar: {
    id: string;
    tanggal: string;
    guru_nama: string;
    kelas: string;
    mapel: string;
    status: string;
  }[];
  // Struktur
  strukturStaf: Record<string, number>;
  subRoles: Record<string, { label: string; jumlah: number }>;
  guruBelumTerassign: { id: string; nama: string }[];
  // Proses Mengajar (Tahap 5)
  engagementPlatform: {
    guruBulanIni: { nama: string; raportSubmit: number; jurnalCount: number; aktivitasTerakhir: string }[];
  };
  // Observasi (Tahap 5)
  observasiTerbaru: {
    id: string;
    guruId: string;
    guruNama: string;
    tanggal: string;
    skor: number;
    catatan: string;
    observer: string;
  }[];
  observasiPending: number;
}

export async function buildExecDashboard(
  institutionId: number,
  now: Date = new Date()
): Promise<ExecDashboard> {
  const { start, end } = awalMingguIni(now);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  // ==========================================
  // 1. Guru aktif di institusi
  // ==========================================
  const guruList = await getGuruList(institutionId);
  const guruIds = guruList.map((g) => g.guruId);
  const namaMap = toNamaMap(guruList);
  const totalGuru = guruIds.length;

  let guruAktifMingguIni = 0;
  let totalSesiMengajar = 0;
  const topGuruMap: Record<string, { sesi: number; menit: number }> = {};
  const progressPerMapelMap: Record<string, { progress: number; total: number }> = {};
  let totalProgressPct = 0;
  let totalProgressCount = 0;

  // ==========================================
  // 2. Sesi & Jurnal mingguan
  // ==========================================
  if (totalGuru > 0) {
    const jurnalRes = await query(
      `SELECT user_id::text AS teacher_id, COUNT(*)::integer AS sesi
       FROM teacher_journals
       WHERE user_id::text = ANY($1) AND tanggal >= $2 AND tanggal <= $3
       GROUP BY user_id`,
      [guruIds, startStr, endStr]
    );
    for (const r of jurnalRes.rows) {
      const sesi = Number(r.sesi) || 0;
      totalSesiMengajar += sesi;
      if (sesi > 0) guruAktifMingguIni++;
      if (!topGuruMap[r.teacher_id]) topGuruMap[r.teacher_id] = { sesi: 0, menit: 0 };
      topGuruMap[r.teacher_id].sesi += sesi;
    }

    // Progress kurikulum dari ATP
    const atpRes = await query(
      `SELECT judul_dokumen, konten, user_id FROM guru_administrasi
       WHERE user_id::text = ANY($1) AND tipe_dokumen = 'atp'`,
      [guruIds]
    );
    for (const row of atpRes.rows) {
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
    }
  }

  // ==========================================
  // 3. Raport 3 Lapis Stats
  // ==========================================
  const raportStats = {
    total: 0,
    draft: 0,
    dikirim_ke_wali_kelas: 0,
    dikonfirmasi: 0,
    difinalisasi: 0,
    siap_print: 0,
    raportMendekatiDeadline: 0,
  };
  const raportMingguIni: { status: string; jumlah: number }[] = [];

  const raportRes = await getRaportStats(institutionId);
  for (const [status, jumlah] of Object.entries(raportRes.byStatus)) {
    if (status in raportStats) {
      (raportStats as any)[status] = jumlah;
      raportStats.total += jumlah;
    }
  }

  // Raport minggu ini
  try {
    const tableCheck = await query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_raport') as exists`
    );
    if (tableCheck.rows[0]?.exists) {
      const raporMingguRes = await query(
        `SELECT dr.status, COUNT(*)::int AS jumlah
         FROM data_raport dr
         JOIN classes c ON c.id = dr.kelas_id
         JOIN institutions i ON i.school_id = c.school_id
         WHERE i.id = $1
           AND dr.updated_at >= $2
           AND dr.updated_at <= $3
         GROUP BY dr.status`,
        [institutionId, start.toISOString(), end.toISOString()]
      );
      for (const row of raporMingguRes.rows) {
        raportMingguIni.push({ status: row.status, jumlah: Number(row.jumlah) });
      }
    }
  } catch {
    raportMingguIni.length = 0;
  }

  raportStats.raportMendekatiDeadline = await getRaportMendekatiDeadline(institutionId, now);

  // ==========================================
  // 4. Struktur Staf
  // ==========================================
  const strukturStaf = await getStrukturStaf(institutionId);
  const subRoles: Record<string, { label: string; jumlah: number }> = {};
  const subRoleLabel: Record<string, string> = {
    wali_kelas: "Wali Kelas",
    pembina_ekskul: "Pembina Ekskul",
  };
  for (const key of Object.keys(strukturStaf)) {
    if (key.startsWith("sub_role_")) {
      const subRole = key.replace("sub_role_", "");
      subRoles[subRole] = {
        label: subRoleLabel[subRole] || subRole,
        jumlah: strukturStaf[key],
      };
    }
  }

  // ==========================================
  // 5. Guru belum ter-assign kelas/mapel
  // ==========================================
  const guruBelumTerassign = (await getGuruBelumTerassign(institutionId, namaMap)).map((g) => ({
    id: g.id,
    nama: g.nama || namaMap[g.id] || "Guru",
  }));

  // ==========================================
  // 6. Guru telat >= 3x/minggu
  // ==========================================
  const guruTelat3x = (await getGuruTelat3x(institutionId, start, end, namaMap)).map((g) => ({
    nama: g.nama || "Guru",
    jumlahTelat: g.jumlahTelat,
  }));

  // ==========================================
  // 7. Top Guru
  // ==========================================
  const topGuru = Object.entries(topGuruMap)
    .map(([uid, v]) => ({
      nama: namaMap[uid] || "Guru",
      sesi: v.sesi,
      menit: v.menit,
    }))
    .sort((a, b) => b.sesi - a.sesi)
    .slice(0, 5);

  // ==========================================
  // 8. Progress per Mapel
  // ==========================================
  const progressPerMapel = Object.entries(progressPerMapelMap).map(([mapel, v]) => ({
    mapel,
    progress: v.progress,
    total: v.total,
    persen: v.total > 0 ? Math.round((v.progress / v.total) * 100) : 0,
  }));

  // ==========================================
  // 9. Latest Laporan Mengajar
  // ==========================================
  let latestLaporanMengajar: ExecDashboard["latestLaporanMengajar"] = [];
  try {
    const latestRes = await query(
      `SELECT tj.id, tj.tanggal, u.nama_lengkap as guru_nama,
              c.nama_kelas as kelas, s.nama_mapel as mapel, tj.status
       FROM teacher_journals tj
       JOIN public.institution_members im ON im.app_user_id = tj.user_id::text AND im.status = 'active'
       JOIN users u ON u.id::text = tj.user_id
       LEFT JOIN classes c ON c.id = tj.class_id
       LEFT JOIN subjects s ON s.id = tj.subject_id
       WHERE im.institution_id = $1
       ORDER BY tj.tanggal DESC
       LIMIT 5`,
      [institutionId]
    );
    latestLaporanMengajar = latestRes.rows.map((r: any) => ({
      id: r.id,
      tanggal: r.tanggal?.toISOString().split("T")[0] || "",
      guru_nama: r.guru_nama || "Guru",
      kelas: r.kelas || "-",
      mapel: r.mapel || "-",
      status: r.status || "-",
    }));
  } catch {
    latestLaporanMengajar = [];
  }

  // ==========================================
  // 10. Engagement Platform (Raport Submit + Jurnal)
  // ==========================================
  const engagementPlatform: ExecDashboard["engagementPlatform"] = { guruBulanIni: [] };
  if (totalGuru > 0) {
    const bulanAwal = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const raportSubmitRes = await query(
      `SELECT h.changed_by::text AS guru_id, COUNT(DISTINCT h.data_raport_id)::int AS jumlah
       FROM data_raport_status_history h
       JOIN public.institution_members im ON im.app_user_id = h.changed_by::text AND im.status = 'active'
       WHERE im.institution_id = $1
         AND h.changed_by_role = 'guru_mapel'
         AND h.changed_at >= $2
       GROUP BY h.changed_by`,
      [institutionId, bulanAwal]
    );
    const raportSubmitMap: Record<string, number> = {};
    for (const r of raportSubmitRes.rows) {
      raportSubmitMap[r.guru_id] = Number(r.jumlah);
    }

    const jurnalCountRes = await query(
      `SELECT user_id::text AS teacher_id, COUNT(*)::int AS jumlah
       FROM teacher_journals
       WHERE user_id::text = ANY($1) AND tanggal >= $2
       GROUP BY user_id`,
      [guruIds, bulanAwal]
    );
    const jurnalCountMap: Record<string, number> = {};
    for (const r of jurnalCountRes.rows) {
      jurnalCountMap[r.teacher_id] = Number(r.jumlah);
    }

    engagementPlatform.guruBulanIni = guruIds.slice(0, 20).map((uid: string) => ({
      nama: namaMap[uid] || "Guru",
      raportSubmit: raportSubmitMap[uid] || 0,
      jurnalCount: jurnalCountMap[uid] || 0,
      aktivitasTerakhir: "",
    }));
  }

  // ==========================================
  // 11. Observasi Terbaru (dari tabel baru atau fallback)
  // ==========================================
  let observasiTerbaru: ExecDashboard["observasiTerbaru"] = [];
  let observasiPending = 0;
  const observasiCheck = await query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guru_observasi') as exists`
  );
  if (observasiCheck.rows[0]?.exists) {
    const obsRes = await query(
      `SELECT id, guru_id, guru_nama, tanggal, skor, catatan, observer
       FROM guru_observasi
       WHERE institution_id = $1
       ORDER BY tanggal DESC
       LIMIT 10`,
      [institutionId]
    );
    observasiTerbaru = obsRes.rows.map((r: any) => ({
      id: r.id,
      guruId: r.guru_id,
      guruNama: r.guru_nama || namaMap[r.guru_id] || "Guru",
      tanggal: r.tanggal?.toISOString().split("T")[0] || "",
      skor: Number(r.skor) || 0,
      catatan: r.catatan || "",
      observer: r.observer || "",
    }));
    const pendingRes = await query(
      `SELECT COUNT(*)::int AS jumlah
       FROM guru_observasi
       WHERE institution_id = $1 AND status = 'pending'`,
      [institutionId]
    );
    observasiPending = Number(pendingRes.rows[0]?.jumlah || 0);
  }

  const rataRataProgressKurikulum =
    totalProgressCount > 0 ? Math.round(totalProgressPct / totalProgressCount) : 0;
  const completionRateSelesaiMengajar =
    totalGuru > 0 ? Math.round((guruAktifMingguIni / totalGuru) * 100) : 0;

  return {
    institutionId,
    weekStart: startStr,
    weekEnd: endStr,
    totalGuru,
    guruAktifMingguIni,
    guruTelat3x,
    totalSesiMengajar,
    completionRateSelesaiMengajar,
    raportStats: {
      ...raportStats,
      raportMendekatiDeadline: raportStats.raportMendekatiDeadline || 0,
    } as any,
    raportMingguIni,
    raportMendekatiDeadline: raportStats.raportMendekatiDeadline || 0,
    rataRataProgressKurikulum,
    progressPerMapel,
    topGuru,
    latestLaporanMengajar,
    strukturStaf,
    subRoles,
    guruBelumTerassign,
    engagementPlatform,
    observasiTerbaru,
    observasiPending,
  };
}
