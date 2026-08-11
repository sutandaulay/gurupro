import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { isInstitutionFeatureEnabled } from "@/lib/feature-flags";

// =====================================================
// Approval Queue Terpusat — Kepala Sekolah & Wakasek
// Endpoint BARU, read-only. Mengagregasi SEMUA antrian
// persetujuan di satu tempat: dokumen administrasi,
// raport menunggu review, izin guru, dan observasi.
// Gate: feature flag approval_queue + RBAC leader.
// Semua query di-batch (hindari N+1).
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

    const featureEnabled = await isInstitutionFeatureEnabled(instId, "approval_queue");
    if (!featureEnabled) {
      return NextResponse.json(
        { featureEnabled: false, message: "Approval Queue belum aktif untuk institusi ini." },
        { status: 200 }
      );
    }

    // Cek tabel opsional yang keberadaannya bisa bervariasi
    const tableCheck = await query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('guru_observasi','leave_requests')`
    );
    const adaObservasi = tableCheck.rows.some((r: any) => r.table_name === "guru_observasi");
    const adaIzin = tableCheck.rows.some((r: any) => r.table_name === "leave_requests");

    const [
      dokRes,
      raportRes,
      izinRes,
      observasiRes,
    ] = await Promise.all([
      // 1. Dokumen administrasi pending (RPP/modul)
      query(
        `SELECT ga.id, ga.user_id, ga.tipe_dokumen, ga.judul_dokumen, ga.created_at,
                u.nama_lengkap AS pengaju_nama
         FROM guru_administrasi ga
         JOIN users u ON u.id::text = ga.user_id::text
         WHERE ga.institution_id = $1
           AND ga.tipe_dokumen IN ('rpp','modul','modul_ajar')
           AND ga.approval_status = 'pending'
         ORDER BY ga.created_at ASC`,
        [instId]
      ),

      // 2. Raport yang menunggu review (belum difinalisasi)
      query(
        `SELECT dr.id, dr.siswa_id, dr.kelas_id, dr.status, dr.updated_at,
                s.nama_siswa, c.nama_kelas, s.nisn
         FROM data_raport dr
         JOIN students s ON s.id = dr.siswa_id
         JOIN classes c ON c.id = dr.kelas_id
         JOIN institutions i ON i.school_id = c.school_id
         WHERE i.id = $1
           AND dr.status IN ('dikirim_ke_wali_kelas','dikonfirmasi')
         ORDER BY dr.updated_at ASC
         LIMIT 200`,
        [instId]
      ),

      // 3. Izin guru pending (jika tabel ada)
      adaIzin
        ? query(
            `SELECT lr.id, lr.teacher_id, lr.type, lr.start_date, lr.end_date, lr.reason, lr.created_at,
                    u.nama_lengkap AS pengaju_nama
             FROM leave_requests lr
             JOIN users u ON u.id::text = lr.teacher_id::text
             WHERE lr.institution_id = $1 AND lr.status = 'pending'
             ORDER BY lr.created_at ASC`,
            [instId]
          )
        : Promise.resolve({ rows: [] }),

      // 4. Observasi pending (jika tabel ada)
      adaObservasi
        ? query(
            `SELECT id, guru_id, guru_nama, tanggal, skor, catatan, observer
             FROM guru_observasi
             WHERE institution_id = $1 AND status = 'pending'
             ORDER BY tanggal DESC`,
            [instId]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const items: any[] = [];

    for (const r of dokRes.rows as any[]) {
      items.push({
        id: r.id,
        kategori: "dokumen",
        judul: r.judul_dokumen || "Dokumen administrasi",
        deskripsi: `${r.tipe_dokumen} oleh ${r.pengaju_nama || "Guru"}`,
        pengaju: r.pengaju_nama || "Guru",
        tipe: r.tipe_dokumen,
        tanggal: r.created_at,
        target: r.user_id,
        aksiable: true,
        aksiUrl: `/api/administrasi/${r.id}/approve`,
      });
    }

    for (const r of raportRes.rows as any[]) {
      items.push({
        id: r.id,
        kategori: "raport",
        judul: `Raport ${r.nama_siswa}`,
        deskripsi: `${r.nama_kelas} — status: ${r.status.replace(/_/g, " ")}`,
        pengaju: null,
        tipe: r.status,
        tanggal: r.updated_at,
        target: null,
      });
    }

    for (const r of izinRes.rows as any[]) {
      items.push({
        id: r.id,
        kategori: "izin",
        judul: `Izin ${r.type} — ${r.pengaju_nama || "Guru"}`,
        deskripsi: `${new Date(r.start_date).toLocaleDateString("id-ID")} s.d. ${new Date(r.end_date).toLocaleDateString("id-ID")}${r.reason ? ` — ${r.reason}` : ""}`,
        pengaju: r.pengaju_nama || "Guru",
        tipe: r.type,
        tanggal: r.created_at,
        target: r.teacher_id,
      });
    }

    for (const r of observasiRes.rows as any[]) {
      items.push({
        id: r.id,
        kategori: "observasi",
        judul: `Observasi ${r.guru_nama || "Guru"}`,
        deskripsi: `${r.tanggal ? new Date(r.tanggal).toLocaleDateString("id-ID") : "-"} — skor ${r.skor || "-"}${r.observer ? ` oleh ${r.observer}` : ""}`,
        pengaju: r.guru_nama || "Guru",
        tipe: "observasi",
        tanggal: r.tanggal,
        target: r.guru_id,
      });
    }

    const byKategori: Record<string, number> = {};
    for (const it of items) {
      byKategori[it.kategori] = (byKategori[it.kategori] || 0) + 1;
    }

    items.sort((a, b) => {
      const order = { raport: 0, dokumen: 1, izin: 2, observasi: 3 } as const;
      return (order[a.kategori as keyof typeof order] ?? 9) - (order[b.kategori as keyof typeof order] ?? 9);
    });

    return NextResponse.json({
      featureEnabled: true,
      ts: new Date().toISOString(),
      summary: { total: items.length, byKategori },
      items,
    });
  } catch (error: any) {
    console.error("Approval Queue error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
