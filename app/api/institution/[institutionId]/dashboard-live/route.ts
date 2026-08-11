import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSession } from '@/lib/session';

// =====================================================
// LIVE dashboard untuk Kepala Sekolah — data hari ini
// Dipanggil langsung saat KS login (tidak dari cache).
// Reuse data layer presensi yang sama dengan teacher-dashboard.
// =====================================================

export async function GET(
  _req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) {
      return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 });
    }

    // RBAC: hanya kepala_sekolah / wakasek / admin
    const memberRes = await query(
      `SELECT imr.value AS role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
         AND imr.value IN ('kepala_sekolah','wakasek','operator','admin_sekolah','bendahara')`,
      [session.id, instId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // ==========================================
    // 1. Kehadiran hari ini — dari attendanceLogs (sama dengan teacher-dashboard)
    // ==========================================
    const guruRows = await query(
      `SELECT im.app_user_id AS guru_id, u.nama_lengkap AS nama
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       JOIN users u ON u.id::text = im.app_user_id
       WHERE im.institution_id = $1 AND im.status = 'active'
         AND imr.value = 'guru'`,
      [instId]
    );
    const guruList = guruRows.rows;

    // Kehadiran hari ini per guru
    const hadirIds = new Set<string>();
    const guruTelatMap: Record<string, number> = {};
    const guruTelatMingguIni = new Set<string>();

    // Cek minggu ini (Senin = start of week)
    const nowDay = new Date(today);
    const dayOfWeek = nowDay.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(nowDay);
    startOfWeek.setDate(nowDay.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    for (const guru of guruList) {
      guruTelatMap[guru.guru_id] = 0;
    }

    const todayLogs = await query(
      `SELECT al.teacher_id, al.type, al.status, al.timestamp
       FROM attendance_logs al
       WHERE al.institution_id = $1
         AND al.timestamp >= $2
         AND al.timestamp <= $3`,
      [instId, startOfDay.toISOString(), endOfDay.toISOString()]
    );

    const todayLogsMingguIni = await query(
      `SELECT al.teacher_id, al.type, al.status
       FROM attendance_logs al
       WHERE al.institution_id = $1
         AND al.timestamp >= $2
         AND al.timestamp <= $3`,
      [instId, startOfWeek.toISOString(), endOfDay.toISOString()]
    );

    for (const log of todayLogs.rows) {
      if (log.type === 'masuk' && log.status === 'valid') {
        hadirIds.add(log.teacher_id);
      }
    }

    for (const log of todayLogsMingguIni.rows) {
      if (log.status === 'flagged' || (log.status === 'valid' && log.type === 'masuk')) {
        // Count telat flags from week
        const flagStr: string = (log as any).flag_reasons || '';
        if (flagStr.includes('late') || flagStr.includes('telat')) {
          guruTelatMap[log.teacher_id] = (guruTelatMap[log.teacher_id] || 0) + 1;
        }
      }
    }

    const guruTelat3x = guruList
      .filter((g: any) => guruTelatMap[g.guru_id] >= 3)
      .map((g: any) => ({ id: g.guru_id, nama: g.nama }));

    // ==========================================
    // 2. e-Raport 3 Lapis — hitung per status
    // ==========================================
    const raportStats = await query(
`SELECT dr.status, COUNT(*)::int AS jumlah
        FROM data_raport dr
        JOIN classes c ON c.id = dr.kelas_id
        JOIN institutions i ON i.school_id = c.school_id
        WHERE i.id = $1
        GROUP BY dr.status`,
      [instId]
    );
    const raportByStatus: Record<string, number> = {};
    let totalRaport = 0;
    for (const row of raportStats.rows) {
      raportByStatus[row.status] = Number(row.jumlah);
      totalRaport += Number(row.jumlah);
    }

    // ==========================================
    // 3. Alert: guru belum ter-assign kelas/mapel
    // ==========================================
    const unassignedGurus = guruList.filter((g: any) => {
      // Guru tanpa assigned_mapel atau assigned_kelas
      return true; // will be enriched below
    });

    // Check dari public.institution_members_assigned_mapel & assigned_kelas
    const unassignedRes = await query(
      `SELECT im.app_user_id AS guru_id, u.nama_lengkap AS nama
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       JOIN users u ON u.id::text = im.app_user_id
       WHERE im.institution_id = $1 AND im.status = 'active'
         AND imr.value = 'guru'
         AND NOT EXISTS (
           SELECT 1 FROM public.institution_members_assigned_mapel am
           WHERE am._parent_id = im.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.institution_members_assigned_kelas ak
           WHERE ak._parent_id = im.id
         )`,
      [instId]
    );

    // ==========================================
    // 4. Struktur Staf
    // ==========================================
    const roleStats = await query(
      `SELECT imr.value AS role, COUNT(*)::int AS jumlah
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.institution_id = $1 AND im.status = 'active'
       GROUP BY imr.value`,
      [instId]
    );

    const strukturStaf: Record<string, number> = {};
    for (const row of roleStats.rows) {
      strukturStaf[row.role] = Number(row.jumlah);
    }

    // Sub-role counts
    const subRoleStats = await query(
      `SELECT sub_role, COUNT(*)::int AS jumlah
       FROM public.institution_members
       WHERE institution_id = $1 AND status = 'active' AND sub_role IS NOT NULL AND sub_role != ''
       GROUP BY sub_role`,
      [instId]
    );
    for (const row of subRoleStats.rows) {
      strukturStaf[`sub_role_${row.sub_role}`] = Number(row.jumlah);
    }

    // ==========================================
    // 5. Raport mendekati deadline (asumsi deadline = 7 hari dari now)
    // ==========================================
    const deadlineDate = new Date(today);
    deadlineDate.setDate(deadlineDate.getDate() + 7);
    const raportDeadlineRes = await query(
`SELECT COUNT(*)::int AS jumlah
        FROM data_raport dr
        JOIN classes c ON c.id = dr.kelas_id
        JOIN institutions i ON i.school_id = c.school_id
        WHERE i.id = $1
          AND dr.status IN ('draft','dikirim_ke_wali_kelas')
          AND dr.periode LIKE $2`,
      [instId, `${today.getFullYear()}%`]
    );
    const raportDeadline = Number(raportDeadlineRes.rows[0]?.jumlah || 0);

    return NextResponse.json({
      today: today.toISOString(),
      institutionId: instId,
      // Kehadiran
      kehadiran: {
        totalGuru: guruList.length,
        hadirHariIni: hadirIds.size,
        belumAbsen: guruList.length - hadirIds.size,
        guruTelat3xMingguIni: guruTelat3x,
      },
      // Raport
      raport: {
        total: totalRaport,
        byStatus: raportByStatus,
        draft: raportByStatus['draft'] || 0,
        dikirim_ke_wali_kelas: raportByStatus['dikirim_ke_wali_kelas'] || 0,
        dikonfirmasi: raportByStatus['dikonfirmasi'] || 0,
        difinalisasi: raportByStatus['difinalisasi'] || 0,
        siap_print: raportByStatus['siap_print'] || 0,
        mendekatiDeadline: raportDeadline,
      },
      // Alerts
      alerts: {
        guruBelumTerassign: unassignedRes.rows.map((r: any) => ({ id: r.guru_id, nama: r.nama })),
        guruTelatBerulang: guruTelat3x,
      },
      // Struktur Staf
      strukturStaf,
    });
  } catch (error: any) {
    console.error('[KS Live Dashboard] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
