import { query } from "@/lib/db";

// =====================================================
// Agregasi statistik dashboard institusi — SINGLE SOURCE OF TRUTH.
// Dipakai oleh:
//   - buildExecDashboard (cache eksekutif)
//   - /api/institution/[id]/command-center (live)
//   - /api/institution/[id]/dashboard-live (live)
// Menghindari duplikasi perhitungan yang bisa tidak konsisten antar halaman.
// =====================================================

export interface NamaMap { [guruId: string]: string; }

// Guru aktif ber-role 'guru' di institusi
export async function getGuruList(institutionId: number): Promise<{ guruId: string; memberId: string; nama: string }[]> {
  const res = await query(
    `SELECT DISTINCT im.id AS member_id, im.app_user_id AS guru_id, u.nama_lengkap AS nama
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     JOIN users u ON u.id::text = im.app_user_id
     WHERE im.institution_id = $1 AND im.status = 'active'
       AND imr.value = 'guru'`,
    [institutionId]
  );
  return res.rows.map((r: any) => ({
    guruId: String(r.guru_id),
    memberId: String(r.member_id),
    nama: r.nama || "Guru",
  }));
}

export function toNamaMap(guruList: { guruId: string; nama: string }[]): NamaMap {
  const map: NamaMap = {};
  for (const g of guruList) map[g.guruId] = g.nama;
  return map;
}

// Struktur staf: jumlah per role + sub-role
export async function getStrukturStaf(institutionId: number): Promise<Record<string, number>> {
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
  const subRoleRes = await query(
    `SELECT sub_role, COUNT(*)::int AS jumlah
     FROM public.institution_members
     WHERE institution_id = $1 AND status = 'active' AND sub_role IS NOT NULL AND sub_role != ''
     GROUP BY sub_role`,
    [institutionId]
  );
  for (const row of subRoleRes.rows) {
    strukturStaf[`sub_role_${row.sub_role}`] = Number(row.jumlah);
  }
  return strukturStaf;
}

// Guru telat >= 3x dalam rentang waktu
export async function getGuruTelat3x(
  institutionId: number,
  start: Date,
  end: Date,
  namaMap: NamaMap
): Promise<{ id: string; nama: string; jumlahTelat: number }[]> {
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
  return telatRes.rows.map((r: any) => ({
    id: String(r.teacher_id),
    nama: namaMap[String(r.teacher_id)] || "Guru",
    jumlahTelat: Number(r.jumlah_telat),
  }));
}

// Guru aktif ber-role 'guru' yang belum ter-assign kelas/mapel
export async function getGuruBelumTerassign(
  institutionId: number,
  namaMap: NamaMap
): Promise<{ id: string; nama: string }[]> {
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
  return unassignedRes.rows.map((r: any) => ({
    id: String(r.guru_id),
    nama: r.nama || namaMap[String(r.guru_id)] || "Guru",
  }));
}

// Statistik raport per status (e-Raport 3 Lapis)
export async function getRaportStats(institutionId: number): Promise<{
  total: number;
  byStatus: Record<string, number>;
}> {
  const byStatus: Record<string, number> = {};
  let total = 0;
  const tableCheck = await query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_raport') as exists`
  );
  if (!tableCheck.rows[0]?.exists) return { total: 0, byStatus: {} };

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
    byStatus[row.status] = Number(row.jumlah);
    total += Number(row.jumlah);
  }
  return { total, byStatus };
}

// Raport mendekati deadline: status belum final, tahun berjalan
export async function getRaportMendekatiDeadline(
  institutionId: number,
  now: Date = new Date()
): Promise<number> {
  const tableCheck = await query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_raport') as exists`
  );
  if (!tableCheck.rows[0]?.exists) return 0;
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
  return Number(deadlineRes.rows[0]?.jumlah || 0);
}

// Kehadiran guru hari ini (untuk dashboard live / command center)
export async function getKehadiranGuruHariIni(
  institutionId: number,
  guruList: { guruId: string; nama: string }[],
  now: Date = new Date()
): Promise<{
  totalGuru: number;
  hadir: number;
  telat: number;
  izin: number;
  sakit: number;
  alpa: number;
  belumAbsen: number;
  presentRate: number;
  hadirIds: Set<string>;
}> {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const statusCounts: Record<string, number> = {};
  const hadirIds = new Set<string>();

  const guruRes = await query(
    `SELECT al.teacher_id, al.type, al.status
     FROM attendance_logs al
     WHERE al.institution_id = $1 AND al.timestamp >= $2 AND al.timestamp <= $3`,
    [institutionId, startOfDay.toISOString(), endOfDay.toISOString()]
  );

  for (const row of guruRes.rows as any[]) {
    if (row.type === "masuk" && row.status === "valid") {
      hadirIds.add(String(row.teacher_id));
    }
    if (row.status === "flagged") {
      statusCounts["telat"] = (statusCounts["telat"] || 0) + 1;
    }
  }

  const totalGuru = guruList.length;
  const hadir = hadirIds.size;
  const telat = statusCounts["telat"] || 0;
  const belumAbsen = Math.max(0, totalGuru - hadir);
  const presentRate = totalGuru > 0 ? Math.round((hadir / totalGuru) * 100) : 0;

  return {
    totalGuru,
    hadir,
    telat,
    izin: 0,
    sakit: 0,
    alpa: 0,
    belumAbsen,
    presentRate,
    hadirIds,
  };
}

// Jumlah siswa institusi + kehadiran hari ini (command center)
export async function getKehadiranSiswa(institutionId: number): Promise<{
  totalSiswa: number;
  hadir: number;
  byStatus: Record<string, number>;
  presentRate: number;
}> {
  const studentAggRes = await query(
    `SELECT COUNT(DISTINCT st.id)::int AS total_siswa
     FROM students st
     JOIN classes c ON c.id = st.class_id
     JOIN institutions i ON i.school_id = c.school_id
     WHERE i.id = $1`,
    [institutionId]
  );
  const totalSiswa = Number(studentAggRes.rows[0]?.total_siswa || 0);

  const byStatus: Record<string, number> = {};
  const studentTodayRes = await query(
    `SELECT sa.status, COUNT(DISTINCT sa.student_id)::int AS jumlah
     FROM student_attendance sa
     JOIN schedules sc ON sc.id = sa.schedule_id
     JOIN classes c ON c.id = sc.class_id
     JOIN institutions i ON i.school_id = c.school_id
     WHERE i.id = $1 AND sa.tanggal = CURRENT_DATE
     GROUP BY sa.status`,
    [institutionId]
  );
  for (const row of studentTodayRes.rows as any[]) {
    byStatus[String(row.status || "Lainnya").toLowerCase()] = Number(row.jumlah || 0);
  }
  const hadir = byStatus["hadir"] || 0;
  const presentRate = totalSiswa > 0 ? Math.round((hadir / totalSiswa) * 100) : 0;
  return { totalSiswa, hadir, byStatus, presentRate };
}

// Dokumen administrasi per guru: total & belum approved
export async function getAdministrasiDokumen(institutionId: number): Promise<{
  byGuru: Map<string, { total: number; pending: number }>;
  totalDokumen: number;
  dokumenPendingApproval: number;
}> {
  const adokRes = await query(
    `SELECT user_id, tipe_dokumen, approval_status, COUNT(*)::int AS jumlah
     FROM guru_administrasi
     WHERE institution_id = $1 AND tipe_dokumen IN ('rpp','modul','modul_ajar')
     GROUP BY user_id, tipe_dokumen, approval_status`,
    [institutionId]
  );
  const byGuru = new Map<string, { total: number; pending: number }>();
  let totalDokumen = 0;
  let dokumenPendingApproval = 0;
  for (const row of adokRes.rows as any[]) {
    const uid = String(row.user_id);
    const cur = byGuru.get(uid) || { total: 0, pending: 0 };
    cur.total += Number(row.jumlah || 0);
    if ((row.approval_status || "draft") !== "approved") cur.pending += Number(row.jumlah || 0);
    byGuru.set(uid, cur);
    totalDokumen += Number(row.jumlah || 0);
    if ((row.approval_status || "draft") !== "approved") dokumenPendingApproval += Number(row.jumlah || 0);
  }
  return { byGuru, totalDokumen, dokumenPendingApproval };
}

export function awalMingguIni(now = new Date()): { start: Date; end: Date } {
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
