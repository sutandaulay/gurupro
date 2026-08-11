import { query } from "@/lib/db";

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
  const membersRes = await query(
    `SELECT DISTINCT im.id AS member_id, im.app_user_id AS user_id
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.institution_id = $1 AND im.status = 'active'
       AND imr.value = 'guru'`,
    [institutionId]
  );
  const guruIds = membersRes.rows.map((r: any) => r.user_id).filter(Boolean);
  const memberIds = membersRes.rows.map((r: any) => r.member_id).filter(Boolean);
  const totalGuru = guruIds.length;

  // Nama guru
  const namaMap: Record<string, string> = {};
  if (guruIds.length > 0) {
    const namaRes = await query(
      `SELECT id, nama_lengkap FROM users WHERE id = ANY($1)`,
      [guruIds]
    );
    for (const r of namaRes.rows) {
      namaMap[r.id] = r.nama_lengkap || "Guru";
    }
  }

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

  // Cek apakah tabel data_raport ada
  const tableCheck = await query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_raport') as exists`
  );
  if (tableCheck.rows[0]?.exists) {
    const raportStatsRes = await query(
      `SELECT dr.status, COUNT(*)::int AS jumlah
       FROM data_raport dr
       JOIN classes c ON c.id = dr.kelas_id
       JOIN institutions i ON i.school_id = c.school_id
       WHERE i.id = $1
       GROUP BY dr.status`,
      [institutionId]
    );
    for (const row of raportStatsRes.rows) {
      const status = row.status as string;
      const jumlah = Number(row.jumlah);
      if (status in raportStats) {
        (raportStats as any)[status] = jumlah;
        raportStats.total += jumlah;
      }
    }

    // Raport minggu ini
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

    // Mendekati deadline (7 hari)
    const deadlineDate = new Date(now);
    deadlineDate.setDate(deadlineDate.getDate() + 7);
    const deadlineRes = await query(
      `SELECT COUNT(*)::int AS jumlah
       FROM data_raport dr
       JOIN classes c ON c.id = dr.kelas_id
       JOIN institutions i ON i.school_id = c.school_id
       WHERE i.id = $1
         AND dr.status IN ('draft','dikirim_ke_wali_kelas')
         AND EXTRACT(YEAR FROM dr.updated_at) = $2`,
      [institutionId, now.getFullYear()]
    );
    raportStats.raportMendekatiDeadline = Number(deadlineRes.rows[0]?.jumlah || 0);
  }

  // ==========================================
  // 4. Struktur Staf
  // ==========================================
  const strukturStaf: Record<string, number> = {};
  const roleStatsRes = await query(
    `SELECT imr.value AS role, COUNT(*)::int AS jumlah
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.institution_id = $1 AND im.status = 'active'
     GROUP BY imr.value`,
    [institutionId]
  );
  for (const row of roleStatsRes.rows) {
    strukturStaf[row.role] = Number(row.jumlah);
  }

  // Sub-role
  const subRoles: Record<string, { label: string; jumlah: number }> = {};
  const subRoleRes = await query(
    `SELECT sub_role, COUNT(*)::int AS jumlah
     FROM public.institution_members
     WHERE institution_id = $1 AND status = 'active' AND sub_role IS NOT NULL AND sub_role != ''
     GROUP BY sub_role`,
    [institutionId]
  );
  const subRoleLabel: Record<string, string> = {
    wali_kelas: "Wali Kelas",
    pembina_ekskul: "Pembina Ekskul",
  };
  for (const row of subRoleRes.rows) {
    subRoles[row.sub_role] = {
      label: subRoleLabel[row.sub_role] || row.sub_role,
      jumlah: Number(row.jumlah),
    };
    strukturStaf[`sub_role_${row.sub_role}`] = Number(row.jumlah);
  }

  // ==========================================
  // 5. Guru belum ter-assign kelas/mapel
  // ==========================================
  const unassignedRes = await query(
    `SELECT im.app_user_id AS guru_id, u.nama_lengkap AS nama
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     JOIN users u ON u.id::text = im.app_user_id
     WHERE im.institution_id = $1 AND im.status = 'active'
       AND imr.value = 'guru'
       AND NOT EXISTS (
         SELECT 1 FROM teacher_institution_assignments tia
         WHERE tia.institution_id = im.institution_id
           AND tia.teacher_id::text = im.app_user_id
       )`,
    [institutionId]
  );
  const guruBelumTerassign = unassignedRes.rows.map((r: any) => ({
    id: r.guru_id,
    nama: namaMap[r.guru_id] || r.nama || "Guru",
  }));

  // ==========================================
  // 6. Guru telat >= 3x/minggu
  // ==========================================
  const guruTelat3x: { nama: string; jumlahTelat: number }[] = [];
  if (totalGuru > 0) {
    const telatRes = await query(
      `SELECT al.teacher_id, COUNT(*)::int AS jumlah_telat
       FROM attendance_logs al
       WHERE al.institution_id = $1
         AND al.timestamp >= $2
         AND al.timestamp <= $3
         AND (al.status = 'flagged' OR al.flag_reasons::text LIKE '%late%' OR al.flag_reasons::text LIKE '%telat%')
       GROUP BY al.teacher_id
       HAVING COUNT(*) >= 3`,
      [institutionId, start.toISOString(), end.toISOString()]
    );
    for (const row of telatRes.rows) {
      guruTelat3x.push({
        nama: namaMap[row.teacher_id] || "Guru",
        jumlahTelat: Number(row.jumlah_telat),
      });
    }
  }

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
