import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { query } from "@/lib/db";

// =====================================================
// Wakasek Kurikulum API — read-only agregasi kurikulum
// - Progress ATP per mapel/guru
// - Monitoring jurnal mengajar minggu ini
// - Ringkasan raport + observasi (tampilan kurikulum)
// RBAC: wakasek / kepala_sekolah
// =====================================================

async function authorize(institutionId: number, appUserId: string): Promise<boolean> {
  const res = await query(
    `SELECT imr.value AS role
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
       AND imr.value IN ('wakasek','kepala_sekolah')`,
    [appUserId, institutionId]
  );
  return res.rows.length > 0;
}

function awalMingguIni(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const hari = d.getDay();
  const selisihKeSenin = hari === 0 ? -6 : 1 - hari;
  const start = new Date(d);
  start.setDate(d.getDate() + selisihKeSenin);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) {
      return NextResponse.json({ error: "Invalid institutionId" }, { status: 400 });
    }

    const ok = await authorize(instId, session.id);
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const { start, end } = awalMingguIni(now);
    const semesterAwal = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Progress ATP per guru/mapel (konten.progress_minggu vs total_minggu)
    const atpRes = await query(
      `SELECT ga.id, ga.judul_dokumen, ga.user_id::text AS guru_id,
              u.nama_lengkap AS guru_nama, ga.fase, ga.semester,
              ga.approval_status, ga.konten, ga.created_at,
              sub.nama_mapel AS mapel
       FROM guru_administrasi ga
       JOIN public.institution_members im ON im.app_user_id = ga.user_id::text AND im.status = 'active'
       JOIN users u ON u.id = ga.user_id
       LEFT JOIN subjects sub ON sub.id = ga.subject_id
       WHERE im.institution_id = $1 AND ga.tipe_dokumen = 'atp'
       ORDER BY ga.created_at DESC`,
      [instId]
    );
    const progressPerMapel: Record<
      string,
      { mapel: string; progress: number; total: number; guruCount: number }
    > = {};
    const atpList = atpRes.rows.map((r: any) => {
      const konten = r.konten || {};
      const total = Number(konten.total_minggu) || 0;
      const progress = Number(konten.progress_minggu) || 0;
      const key = r.mapel || r.judul_dokumen || "Tidak diketahui";
      if (!progressPerMapel[key]) {
        progressPerMapel[key] = { mapel: key, progress: 0, total: 0, guruCount: 0 };
      }
      progressPerMapel[key].progress += progress;
      progressPerMapel[key].total += total;
      progressPerMapel[key].guruCount += 1;
      return {
        id: r.id,
        mapel: r.mapel || "-",
        judul: r.judul_dokumen || "-",
        guruId: r.guru_id,
        guruNama: r.guru_nama || "Guru",
        fase: r.fase || "-",
        semester: r.semester ?? null,
        approvalStatus: r.approval_status || null,
        progress,
        total,
        persen: total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0,
        updatedAt: r.created_at ? r.created_at.toISOString() : null,
      };
    });

    // Monitoring jurnal mengajar minggu ini
    const jurnalRes = await query(
      `SELECT tj.user_id::text AS guru_id, u.nama_lengkap AS guru_nama,
              tj.class_id, tj.subject_id,
              c.nama_kelas AS kelas, s.nama_mapel AS mapel,
              COUNT(*)::int AS sesi,
              MAX(tj.tanggal) AS terakhir
       FROM teacher_journals tj
       JOIN public.institution_members im ON im.app_user_id = tj.user_id::text AND im.status = 'active'
       JOIN users u ON u.id = tj.user_id
       LEFT JOIN classes c ON c.id = tj.class_id
       LEFT JOIN subjects s ON s.id = tj.subject_id
       WHERE im.institution_id = $1
         AND tj.tanggal >= $2 AND tj.tanggal <= $3
       GROUP BY tj.user_id, u.nama_lengkap, tj.class_id, tj.subject_id, c.nama_kelas, s.nama_mapel
       ORDER BY sesi DESC`,
      [instId, start.toISOString().split("T")[0], end.toISOString().split("T")[0]]
    );
    const jurnalMingguIni = jurnalRes.rows.map((r: any) => ({
      guruId: r.guru_id,
      guruNama: r.guru_nama || "Guru",
      kelas: r.mapel ? `${r.kelas || "-"} • ${r.mapel}` : (r.kelas || "-"),
      sesi: Number(r.sesi),
      terakhir: r.terakhir ? r.terakhir.toISOString().split("T")[0] : null,
    }));

    // Guru ber-role guru di institusi
    const guruRes = await query(
      `SELECT DISTINCT im.app_user_id::text AS guru_id, u.nama_lengkap AS nama
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       JOIN users u ON u.id::text = im.app_user_id
       WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'`,
      [instId]
    );
    const aktifIds = new Set(jurnalMingguIni.map((j: any) => j.guruId));
    const guruList = guruRes.rows.map((r: any) => ({
      guruId: r.guru_id,
      nama: r.nama || "Guru",
      aktifMingguIni: aktifIds.has(r.guru_id),
    }));

    // Ringkasan progress ATP periode belakangan (untuk tren sederhana)
    const totBulanRes = await query(
      `SELECT im.app_user_id::text AS guru_id, COUNT(*)::int AS atp_count
       FROM guru_administrasi ga
       JOIN public.institution_members im ON im.app_user_id = ga.user_id::text AND im.status = 'active'
       WHERE im.institution_id = $1 AND ga.tipe_dokumen = 'atp'
         AND ga.created_at >= $2
       GROUP BY im.app_user_id`,
      [instId, semesterAwal.toISOString()]
    );

    const summary = {
      totalAtp: atpList.length,
      totalMapel: Object.keys(progressPerMapel).length,
      guruMengajarMingguIni: jurnalMingguIni.reduce(
        (acc: number, j: any) => acc + j.sesi,
        0
      ),
      guruAktifMingguIni: guruList.filter((g: any) => g.aktifMingguIni).length,
      totalGuru: guruList.length,
      rataRataProgress: (() => {
        const keys = Object.keys(progressPerMapel);
        if (keys.length === 0) return 0;
        let totPct = 0;
        let totCount = 0;
        for (const k of keys) {
          const g = progressPerMapel[k];
          if (g.total > 0) {
            totPct += Math.round((g.progress / g.total) * 100);
            totCount++;
          }
        }
        return totCount > 0 ? Math.round(totPct / totCount) : 0;
      })(),
    };

    return NextResponse.json({
      summary,
      progressPerMapel: Object.values(progressPerMapel).map((g) => ({
        ...g,
        persen: g.total > 0 ? Math.min(100, Math.round((g.progress / g.total) * 100)) : 0,
      })),
      atpList,
      jurnalMingguIni,
      guruList,
      periode: {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      },
    });
  } catch (err) {
    console.error("GET /api/institution/[institutionId]/kurikulum error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}