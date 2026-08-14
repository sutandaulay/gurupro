import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { isInstitutionFeatureEnabled } from "@/lib/feature-flags";
import {
  getGuruList,
  toNamaMap,
  getStrukturStaf,
  getGuruTelat3x,
  getGuruBelumTerassign,
  getRaportStats,
  getRaportMendekatiDeadline,
  getKehadiranGuruHariIni,
  getKehadiranSiswa,
  getAdministrasiDokumen,
  awalMingguIni,
} from "@/lib/dashboard-stats";

// =====================================================
// Command Center (Executive Dashboard) — Kepala Sekolah & Wakasek
// Endpoint read-only. Semua agregasi memakai helper bersama
// (lib/dashboard-stats) agar konsisten dengan Dasbor Eksekutif.
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
    const { start, end } = awalMingguIni(now);

    // ========== agregasi via helper bersama ==========
    const guruList = await getGuruList(instId);
    const namaMap = toNamaMap(guruList);
    const guruIds = guruList.map((g) => g.guruId);

    const [
      kehadiranGuru,
      kehadiranSiswa,
      admin,
      strukturStaf,
      telatRes,
      unassignedRes,
      raportStats,
      raportDeadline,
      jurnalCountRes,
    ] = await Promise.all([
      getKehadiranGuruHariIni(instId, guruList, now),
      getKehadiranSiswa(instId),
      getAdministrasiDokumen(instId),
      getStrukturStaf(instId),
      getGuruTelat3x(instId, start, end, namaMap),
      getGuruBelumTerassign(instId, namaMap),
      getRaportStats(instId),
      getRaportMendekatiDeadline(instId, now),
      guruIds.length > 0
        ? query(
            `SELECT user_id::text AS teacher_id, COUNT(*)::int AS jumlah
             FROM teacher_journals
             WHERE user_id::text = ANY($1) AND tanggal >= $2
             GROUP BY user_id`,
            [guruIds, start.toISOString().split("T")[0]]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const jurnalCountMap = new Map<string, number>();
    for (const r of jurnalCountRes.rows as any[]) {
      jurnalCountMap.set(String(r.teacher_id), Number(r.jumlah || 0));
    }

    const guruBelumSubmitRpp = guruList
      .filter((g) => !((admin.byGuru.get(g.guruId)?.total || 0) > 0))
      .map((g) => ({ id: g.guruId, nama: g.nama || "Guru" }));

    return NextResponse.json({
      featureEnabled: true,
      ts: now.toISOString(),
      kehadiranGuru: {
        totalGuru: kehadiranGuru.totalGuru,
        present: kehadiranGuru.hadir,
        telat: kehadiranGuru.telat,
        izin: kehadiranGuru.izin,
        sakit: kehadiranGuru.sakit,
        alpa: kehadiranGuru.alpa,
        belumAbsen: kehadiranGuru.belumAbsen,
        presentRate: kehadiranGuru.presentRate,
      },
      kehadiranSiswa,
      administrasi: {
        totalDokumen: admin.totalDokumen,
        dokumenPendingApproval: admin.dokumenPendingApproval,
        guruBelumSubmitRpp,
      },
      insiden: {
        guruTelatBerulang: telatRes,
        guruBelumTerassign: unassignedRes,
        raportMendekatiDeadline: raportDeadline,
      },
      strukturStaf,
    });
  } catch (error: any) {
    console.error("Command Center error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}