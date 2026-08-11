import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { isInstitutionFeatureEnabled } from "@/lib/feature-flags";

// =====================================================
// PKG Digital — Kepala Sekolah & Wakasek
// Endpoint BARU, read-only. Agregasi Penilaian Kinerja
// Guru dari tabel PKG existing (observasi_kinerja,
// observasi_indikator, indikator_kinerja_config,
// laporan_kinerja). Tabel PKG tidak punya sekolah_id,
// jadi scoping per institusi via institution_members.
// Gate: flag pkg_digital + RBAC leader.
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

// Filter guru yang jadi anggota institusi (role guru)
const GURU_MEMBER_JOIN = `
  FROM public.institution_members im
  JOIN public.institution_members_role imr ON imr.parent_id = im.id
  JOIN users u ON u.id::text = im.app_user_id
  WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'`;

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
    const featureEnabled = await isInstitutionFeatureEnabled(instId, "pkg_digital");
    if (!featureEnabled) {
      return NextResponse.json(
        { featureEnabled: false, message: "PKG Digital belum aktif untuk institusi ini." },
        { status: 200 }
      );
    }

    const [
      guruRes,
      observasiRes,
      laporanRes,
      komponenRes,
      ratingRes,
    ] = await Promise.all([
      // 1. Daftar guru institusi
      query(`SELECT im.app_user_id AS guru_id, u.nama_lengkap AS nama ${GURU_MEMBER_JOIN}`, [instId]),

      // 2. Observasi per guru + rata-rata rating
      query(
        `SELECT im.app_user_id AS guru_id,
                COUNT(DISTINCT ok.id)::int AS total_observasi,
                ROUND(AVG(oi.rating)::numeric, 1) AS rata_rating
         FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         LEFT JOIN observasi_kinerja ok ON ok.guru_id::text = im.app_user_id
         LEFT JOIN observasi_indikator oi ON oi.observasi_id = ok.id
         WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'
         GROUP BY im.app_user_id`,
        [instId]
      ),

      // 3. Laporan kinerja terbaru per guru
      query(
        `SELECT DISTINCT ON (im.app_user_id) im.app_user_id AS guru_id,
                l.status AS laporan_status, l.predikat, l.semester,
                l.rata_rata_rating, l.updated_at
         FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         LEFT JOIN laporan_kinerja l ON l.guru_id::text = im.app_user_id
         WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'
         ORDER BY im.app_user_id, l.updated_at DESC NULLS LAST`,
        [instId]
      ),

      // 4. Komponen indikator PKG
      query(
        `SELECT ik.id, ik.kode, ik.nama, ik.komponen, ik.bobot_persen
         FROM indikator_kinerja_config ik
         WHERE ik.is_active = TRUE
         ORDER BY ik.kode ASC`,
        []
      ),

      // 5. Rata-rata rating per komponen (indikator) untuk institusi ini
      query(
        `SELECT ik.kode AS kode,
                COUNT(DISTINCT oi.id)::int AS jumlah_rating,
                ROUND(AVG(oi.rating)::numeric, 1) AS rata_rating
         FROM indikator_kinerja_config ik
         LEFT JOIN observasi_indikator oi ON oi.indikator_id = ik.id
         LEFT JOIN observasi_kinerja ok ON ok.id = oi.observasi_id
         LEFT JOIN public.institution_members im ON im.app_user_id::text = ok.guru_id::text
         LEFT JOIN public.institution_members_role imr ON imr.parent_id = im.id
         WHERE ik.is_active = TRUE
           AND (ok.id IS NULL OR (im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'))
         GROUP BY ik.kode`,
        [instId]
      ),
    ]);

    const guruList = guruRes.rows as any[];
    const namaMap = new Map<string, string>();
    for (const g of guruList) namaMap.set(g.guru_id, g.nama || "Guru");

    const observasiMap = new Map<string, { total: number; rata: number | null }>();
    for (const r of observasiRes.rows as any[]) {
      observasiMap.set(r.guru_id, {
        total: Number(r.total_observasi || 0),
        rata: r.rata_rating === null ? null : Number(r.rata_rating),
      });
    }

    const laporanMap = new Map<string, any>();
    for (const r of laporanRes.rows as any[]) {
      laporanMap.set(r.guru_id, {
        status: r.laporan_status,
        predikat: r.predikat,
        semester: r.semester,
        rata: r.rata_rata_rating === null ? null : Number(r.rata_rata_rating),
      });
    }

    const perGuru = guruList.map((g) => {
      const obs = observasiMap.get(g.guru_id) || { total: 0, rata: null };
      const lap = laporanMap.get(g.guru_id) || {};
      return {
        guru_id: g.guru_id,
        nama: g.nama || "Guru",
        totalObservasi: obs.total,
        rataRating: obs.rata,
        laporanStatus: lap.status || null,
        predikat: lap.predikat || null,
        semester: lap.semester || null,
        laporanRataRating: lap.rata ?? null,
      };
    });

    const totalObservasi = perGuru.reduce((a, g) => a + g.totalObservasi, 0);
    const guruDiobservasi = perGuru.filter((g) => g.totalObservasi > 0).length;
    const ratingList = perGuru.map((g) => g.rataRating).filter((v): v is number => v !== null);
    const rataRataInstitusi =
      ratingList.length > 0 ? Math.round((ratingList.reduce((a, b) => a + b, 0) / ratingList.length) * 10) / 10 : null;

    const perKomponen = (komponenRes.rows as any[]).map((k) => {
      const rated = ratingRes.rows.find((r: any) => r.kode === k.kode);
      return {
        id: k.id,
        kode: k.kode,
        nama: k.nama,
        komponen: k.komponen,
        bobotPersen: Number(k.bobot_persen || 0),
        jumlahRating: Number(rated?.jumlah_rating || 0),
        rataRating: rated?.rata_rating === null || rated?.rata_rating === undefined ? null : Number(rated.rata_rating),
      };
    });

    const laporanByStatus: Record<string, number> = {};
    for (const g of perGuru) {
      if (g.laporanStatus) {
        laporanByStatus[g.laporanStatus] = (laporanByStatus[g.laporanStatus] || 0) + 1;
      }
    }
    const tanpaLaporan = perGuru.filter((g) => !g.laporanStatus).length;

    return NextResponse.json({
      featureEnabled: true,
      ts: new Date().toISOString(),
      summary: {
        totalGuru: perGuru.length,
        guruDiobservasi,
        totalObservasi,
        rataRataInstitusi,
        tanpaLaporan,
        laporanByStatus,
      },
      perGuru,
      perKomponen,
    });
  } catch (error: any) {
    console.error("PKG Digital error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
