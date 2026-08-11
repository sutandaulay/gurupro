import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { isInstitutionFeatureEnabled } from "@/lib/feature-flags";

// =====================================================
// Smart Alert / Anomaly Detection — Kepala Sekolah & Wakasek
// Endpoint BARU, read-only. Mendeteksi anomali operasional
// dari data eksisting (kehadiran, jurnal, raport, assignment).
// Gate: feature flag smart_alerts + RBAC leader.
// Semua deteksi di-batch dalam Promise.all (hindari N+1).
// =====================================================

const LEADER_ROLES = ["kepala_sekolah", "wakasek"];

async function getLeaderRoles(appUserId: string, institutionId: number): Promise<string[]> {
  const res = await query(
    `SELECT imr.value AS role
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
       AND imr.value = ANY($3)
     GROUP BY imr.value`,
    [appUserId, institutionId, LEADER_ROLES]
  );
  return res.rows.map((r: any) => r.role);
}

function waktuMingguIni() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayOfWeek = now.getDay();
  const backToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - backToMonday);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const todayStart = startOfToday.toISOString();
  const weekStart = startOfWeek.toISOString();
  const weekEnd = endOfWeek.toISOString();
  const todayStr = now.toISOString().split("T")[0];
  return { now, todayStart, weekStart, weekEnd, todayStr };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) {
      return NextResponse.json({ error: "Invalid institution ID" }, { status: 400 });
    }

    const roles = await getLeaderRoles(session.id, instId);
    if (roles.length === 0) {
      return NextResponse.json(
        { error: "Forbidden: hanya untuk Kepala Sekolah / Wakasek" },
        { status: 403 }
      );
    }

    const featureEnabled = await isInstitutionFeatureEnabled(instId, "smart_alerts");
    if (!featureEnabled) {
      return NextResponse.json(
        {
          featureEnabled: false,
          message: "Smart Alert belum aktif untuk institusi ini.",
        },
        { status: 200 }
      );
    }

    const { now, todayStart, weekStart, weekEnd, todayStr } = waktuMingguIni();

    // ========== SQL deteksi (semua read-only, dibatch) ==========
    const [
      guruRes,
      kelasKehadiranRes,
      telatRes,
      unassignedRes,
      raportDeadlineRes,
      jurnalRes,
      adokRes,
    ] = await Promise.all([
      // 0. Daftar guru aktif + nama
      query(
        `SELECT DISTINCT im.app_user_id AS guru_id, u.nama_lengkap AS nama
         FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         JOIN users u ON u.id::text = im.app_user_id
         WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'`,
        [instId]
      ),

      // 1. Kehadiran siswa per kelas (minggu ini) — rate < 80% => alert
      query(
        `SELECT c.id AS kelas_id, c.nama_kelas,
                COUNT(DISTINCT sa.student_id)::int AS total_siswa,
                COUNT(DISTINCT CASE WHEN LOWER(sa.status) = 'hadir' THEN sa.student_id END)::int AS siswa_hadir,
                COUNT(*)::int AS total_record
         FROM student_attendance sa
         JOIN schedules sc ON sc.id = sa.schedule_id
         JOIN classes c ON c.id = sc.class_id
         JOIN institutions i ON i.school_id = c.school_id
         WHERE i.id = $1 AND sa.tanggal >= $2 AND sa.tanggal <= $3
         GROUP BY c.id, c.nama_kelas`,
        [instId, todayStr, todayStr]
      ),

      // 2. Guru telat berulang minggu ini (>= 3x)
      query(
        `SELECT al.teacher_id, COUNT(*)::int AS jumlah_telat
         FROM attendance_logs al
         WHERE al.institution_id = $1
           AND al.timestamp >= $2 AND al.timestamp <= $3
           AND (al.status = 'flagged' OR al.flag_reasons::text ILIKE '%late%' OR al.flag_reasons::text ILIKE '%telat%')
         GROUP BY al.teacher_id
         HAVING COUNT(*) >= 3`,
        [instId, weekStart, weekEnd]
      ),

      // 3. Guru belum ter-assign kelas/mapel
      query(
        `SELECT im.app_user_id AS guru_id, u.nama_lengkap AS nama
         FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         JOIN users u ON u.id::text = im.app_user_id
         WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'
           AND NOT EXISTS (
             SELECT 1 FROM teacher_institution_assignments tia
             WHERE tia.institution_id = im.institution_id
               AND tia.teacher_id::text = im.app_user_id
           )`,
        [instId]
      ),

      // 4. Raport mendekati deadline (belum finalisasi)
      query(
        `SELECT COUNT(*)::int AS jumlah
         FROM data_raport dr
         JOIN classes c ON c.id = dr.kelas_id
         JOIN institutions i ON i.school_id = c.school_id
         WHERE i.id = $1 AND dr.status IN ('draft','dikirim_ke_wali_kelas')`,
        [instId]
      ),

      // 5. Guru tanpa jurnal minggu ini (inaktif mengajar)
      query(
        `SELECT im.app_user_id AS guru_id, u.nama_lengkap AS nama
         FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         JOIN users u ON u.id::text = im.app_user_id
         WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'
           AND NOT EXISTS (
             SELECT 1 FROM teacher_journals tj
             WHERE tj.user_id::text = im.app_user_id
               AND tj.tanggal >= $2 AND tj.tanggal <= $3
           )`,
        [instId, todayStr, todayStr]
      ),

      // 6. Dokumen administrasi pending (RPP/modul belum approved)
      query(
        `SELECT ga.user_id, u.nama_lengkap AS nama,
                COUNT(*) FILTER (WHERE ga.approval_status = 'pending')::int AS pending,
                COUNT(*)::int AS total
         FROM guru_administrasi ga
         JOIN public.institution_members im ON im.app_user_id = ga.user_id::text AND im.status = 'active'
         JOIN users u ON u.id::text = ga.user_id::text
         WHERE ga.institution_id = $1 AND ga.tipe_dokumen IN ('rpp','modul','modul_ajar')
         GROUP BY ga.user_id, u.nama_lengkap
         HAVING COUNT(*) FILTER (WHERE ga.approval_status = 'pending') > 0`,
        [instId]
      ),
    ]);

    const guruList = guruRes.rows as any[];
    const namaMap = new Map<string, string>();
    for (const g of guruList) namaMap.set(g.guru_id, g.nama || "Guru");

    const alerts: any[] = [];
    let critical = 0;
    let warning = 0;
    let info = 0;

    // --- Kelas kehadiran < 80% (hari ini) ---
    for (const row of kelasKehadiranRes.rows as any[]) {
      const total = Number(row.total_record || 0);
      if (total === 0) continue;
      const hadir = Number(row.siswa_hadir || 0);
      const rate = Math.round((hadir / total) * 100);
      if (rate < 80) {
        alerts.push({
          id: `hadir-kelas-${row.kelas_id}`,
          level: rate < 60 ? "critical" : "warning",
          kategori: "kehadiran_siswa",
          judul: `Kehadiran kelas ${row.nama_kelas} ${rate}%`,
          deskripsi: `${hadir} dari ${total} siswa hadir hari ini (target ≥ 80%).`,
          nilai: rate,
          target: [{ id: row.kelas_id, nama: row.nama_kelas }],
        });
      }
    }

    // --- Guru telat berulang ---
    for (const row of telatRes.rows as any[]) {
      alerts.push({
        id: `telat-${row.teacher_id}`,
        level: "warning",
        kategori: "kehadiran_guru",
        judul: `${namaMap.get(row.teacher_id) || "Guru"} telat ${row.jumlah_telat}x`,
        deskripsi: `Tercatat telat ${row.jumlah_telat} kali dalam minggu ini (≥ 3x).`,
        nilai: Number(row.jumlah_telat),
        target: [{ id: row.teacher_id, nama: namaMap.get(row.teacher_id) || "Guru" }],
      });
    }

    // --- Guru belum ter-assign ---
    const unassigned = (unassignedRes.rows as any[]).map((r) => ({
      id: r.guru_id,
      nama: r.nama || "Guru",
    }));
    if (unassigned.length > 0) {
      alerts.push({
        id: "unassigned",
        level: "critical",
        kategori: "assignment",
        judul: `${unassigned.length} guru belum ter-assign`,
        deskripsi: "Guru belum memiliki kelas/mapel yang ter-assign.",
        nilai: unassigned.length,
        target: unassigned,
      });
    }

    // --- Raport mendekati deadline ---
    const raportDeadline = Number(raportDeadlineRes.rows[0]?.jumlah || 0);
    if (raportDeadline > 0) {
      alerts.push({
        id: "raport-deadline",
        level: raportDeadline > 50 ? "critical" : "warning",
        kategori: "raport",
        judul: `${raportDeadline} raport belum finalisasi`,
        deskripsi: "Raport berstatus draft/dikirim_ke_wali_kelas dan mendekati deadline.",
        nilai: raportDeadline,
        target: [],
      });
    }

    // --- Guru tanpa jurnal hari ini ---
    const tanpaJurnal = (jurnalRes.rows as any[]).map((r) => ({
      id: r.guru_id,
      nama: r.nama || "Guru",
    }));
    if (tanpaJurnal.length > 0) {
      alerts.push({
        id: "tanpa-jurnal",
        level: "info",
        kategori: "jurnal",
        judul: `${tanpaJurnal.length} guru belum mengisi jurnal hari ini`,
        deskripsi: "Guru aktif belum mengirim laporan mengajar hari ini.",
        nilai: tanpaJurnal.length,
        target: tanpaJurnal,
      });
    }

    // --- Dokumen pending ---
    for (const row of adokRes.rows as any[]) {
      alerts.push({
        id: `dok-pending-${row.user_id}`,
        level: "info",
        kategori: "administrasi",
        judul: `${row.nama || "Guru"} punya ${row.pending} dokumen pending`,
        deskripsi: "Dokumen RPP/modul menunggu review/approval.",
        nilai: Number(row.pending),
        target: [{ id: row.user_id, nama: row.nama || "Guru" }],
      });
    }

    for (const a of alerts) {
      if (a.level === "critical") critical++;
      else if (a.level === "warning") warning++;
      else info++;
    }

    alerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 } as const;
      return order[a.level as keyof typeof order] - order[b.level as keyof typeof order];
    });

    return NextResponse.json({
      featureEnabled: true,
      ts: now.toISOString(),
      summary: { critical, warning, info, total: alerts.length },
      alerts,
    });
  } catch (error: any) {
    console.error("Smart Alerts error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
