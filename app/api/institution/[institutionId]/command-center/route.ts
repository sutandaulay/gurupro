import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { isInstitutionFeatureEnabled } from "@/lib/feature-flags";

// =====================================================
// Command Center (Executive Dashboard) — Kepala Sekolah & Wakasek
// Endpoint BARU, read-only. Tidak menyentuh endpoint modul existing.
// Semua agregasi di-batch dalam Promise.all (hindari N+1).
// Konsisten skema: public.institution_members / chaining school_id.
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

    const featureEnabled = await isInstitutionFeatureEnabled(instId, "command_center");
    if (!featureEnabled) {
      return NextResponse.json(
        {
          featureEnabled: false,
          message: "Command Center belum aktif untuk institusi ini. Aktifkan lewat feature flag per institusi.",
        },
        { status: 200 }
      );
    }

    // ========== data time window ==========
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const tomorrow = new Date(startOfToday);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayOfWeek = now.getDay();
    const backToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - backToMonday);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // ========== SQL (semua read-only) ==========
    const [
      guruRes,
      guruAttendanceTodayRes,
      studentAggRes,
      studentTodayRes,
      adokRes,
      stafRes,
      unassignedRes,
      telatRes,
      raportRes,
    ] = await Promise.all([
      // 1. Guru aktif
      query(
        `SELECT DISTINCT im.app_user_id AS guru_id, u.nama_lengkap AS nama
         FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         JOIN users u ON u.id::text = im.app_user_id
         WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'`,
        [instId]
      ),

      // 2. Kehadiran guru hari ini
      query(
        `SELECT teacher_id, attendance_status, check_in_time
         FROM attendance_summary
         WHERE institution_id = $1 AND date >= $2 AND date < $3`,
        [instId, startOfToday.toISOString(), tomorrow.toISOString()]
      ),

      // 3. Jumlah siswa institusi (via classes.school_id = institutions.school_id)
      query(
        `SELECT COUNT(DISTINCT st.id)::int AS total_siswa
         FROM students st
         JOIN classes c ON c.id = st.class_id
         JOIN institutions i ON i.school_id = c.school_id
         WHERE i.id = $1`,
        [instId]
      ),

      // 4. Kehadiran siswa hari ini
      query(
        `SELECT sa.status, COUNT(DISTINCT sa.student_id)::int AS jumlah
         FROM student_attendance sa
         JOIN schedules sc ON sc.id = sa.schedule_id
         JOIN classes c ON c.id = sc.class_id
         JOIN institutions i ON i.school_id = c.school_id
         WHERE i.id = $1 AND sa.tanggal = CURRENT_DATE
         GROUP BY sa.status`,
        [instId]
      ),

      // 5. Dokumen administrasi (RPP/modul) per guru di institusi
      query(
        `SELECT user_id, tipe_dokumen, approval_status, COUNT(*)::int AS jumlah
         FROM guru_administrasi
         WHERE institution_id = $1 AND tipe_dokumen IN ('rpp','modul','modul_ajar')
         GROUP BY user_id, tipe_dokumen, approval_status`,
        [instId]
      ),

      // 6. Struktur staf
      query(
        `SELECT imr.value AS role, COUNT(DISTINCT im.id)::int AS jumlah
         FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         WHERE im.institution_id = $1 AND im.status = 'active'
         GROUP BY imr.value`,
        [instId]
      ),

      // 7. Guru belum terassigned kelas/mapel
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

      // 8. Guru telat berulang minggu ini (>= 3x)
      query(
        `SELECT al.teacher_id, COUNT(*)::int AS jumlah_telat
         FROM attendance_logs al
         WHERE al.institution_id = $1
           AND al.timestamp >= $2 AND al.timestamp <= $3
           AND (al.status = 'flagged' OR al.flag_reasons::text ILIKE '%late%' OR al.flag_reasons::text ILIKE '%telat%')
         GROUP BY al.teacher_id
         HAVING COUNT(*) >= 3`,
        [instId, startOfWeek.toISOString(), endOfWeek.toISOString()]
      ),

      // 9. Raport mendekati deadline (belum finalisasi)
      query(
        `SELECT COUNT(*)::int AS jumlah
         FROM data_raport dr
         JOIN classes c ON c.id = dr.kelas_id
         JOIN institutions i ON i.school_id = c.school_id
         WHERE i.id = $1 AND dr.status IN ('draft','dikirim_ke_wali_kelas')`,
        [instId]
      ),
    ]);

    // ========== komposisi ==========
    const guruList = guruRes.rows as any[];
    const namaMap = new Map<string, string>();
    for (const g of guruList) namaMap.set(g.guru_id, g.nama || "Guru");

    const totalGuru = guruList.length;

    // Kehadiran guru hari ini
    const statusCounts: Record<string, number> = {};
    const hadirIds = new Set<string>();
    for (const row of guruAttendanceTodayRes.rows as any[]) {
      const status = row.attendance_status || "tanpa_data";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      if (["hadir", "telat"].includes(status) && row.check_in_time) hadirIds.add(row.teacher_id);
    }
    const presentCount = statusCounts["hadir"] || 0;
    const lateCount = statusCounts["telat"] || 0;
    const izinCount = (statusCounts["izin"] || 0);
    const sakitCount = (statusCounts["sakit"] || 0);
    const alpaCount = (statusCounts["alpa"] || 0);
    const belumAbsen = Math.max(0, totalGuru - presentCount - lateCount - izinCount - sakitCount - alpaCount);

    // Kehadiran siswa
    const totalSiswa = Number(studentAggRes.rows[0]?.total_siswa || 0);
    const siswaStatus: Record<string, number> = {};
    for (const row of studentTodayRes.rows as any[]) {
      const st = String(row.status || "Lainnya").toLowerCase();
      siswaStatus[st] = (siswaStatus[st] || 0) + Number(row.jumlah || 0);
    }
    const siswaHadir = siswaStatus["hadir"] || 0;

    // Dokumen administrasi
    const byGuru = new Map<string, { total: number; pending: number }>();
    for (const row of adokRes.rows as any[]) {
      const cur = byGuru.get(row.user_id) || { total: 0, pending: 0 };
      cur.total += Number(row.jumlah || 0);
      if ((row.approval_status || "draft") !== "approved") cur.pending += Number(row.jumlah || 0);
      byGuru.set(row.user_id, cur);
    }
    const guruBelumSubmitRpp = guruList
      .filter((g) => !((byGuru.get(g.guru_id)?.total || 0) > 0))
      .map((g) => ({ id: g.guru_id, nama: g.nama || "Guru" }));
    const dokPending = [...byGuru.entries()].reduce(
      (acc, [_, v]) => acc + v.pending,
      0
    );

    // Struktur staf
    const strukturStaf: Record<string, number> = {};
    for (const row of stafRes.rows as any[]) {
      strukturStaf[row.role] = Number(row.jumlah || 0);
    }

    const guruTelatBerulang = (telatRes.rows as any[]).map((r) => ({
      id: r.teacher_id,
      nama: namaMap.get(r.teacher_id) || "Guru",
      jumlahTelat: Number(r.jumlah_telat || 0),
    }));
    const guruBelumTerassign = (unassignedRes.rows as any[]).map((r) => ({
      id: r.guru_id,
      nama: r.nama || "Guru",
    }));
    const raportMendekatiDeadline = Number(raportRes.rows[0]?.jumlah || 0);

    const guruPresentRate =
      totalGuru > 0 ? Math.round(((presentCount + lateCount) / totalGuru) * 100) : 0;
    const siswaPresentRate =
      totalSiswa > 0 ? Math.round((siswaHadir / totalSiswa) * 100) : 0;

    return NextResponse.json({
      featureEnabled: true,
      ts: now.toISOString(),
      kehadiranGuru: {
        totalGuru,
        present: presentCount,
        telat: lateCount,
        izin: izinCount,
        sakit: sakitCount,
        alpa: alpaCount,
        belumAbsen,
        presentRate: guruPresentRate,
      },
      kehadiranSiswa: {
        totalSiswa,
        hadir: siswaHadir,
        byStatus: siswaStatus,
        presentRate: siswaPresentRate,
      },
      administrasi: {
        totalDokumen: [...byGuru.values()].reduce((a, v) => a + v.total, 0),
        dokumenPendingApproval: dokPending,
        guruBelumSubmitRpp,
      },
      insiden: {
        guruTelatBerulang,
        guruBelumTerassign,
        raportMendekatiDeadline,
      },
      strukturStaf,
    });
  } catch (error: any) {
    console.error("Command Center error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}