import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookieHeader } from "@/lib/session-sign";

// Sprint 3.1 — Daftar dokumen RPP/Modul Ajar yang menunggu persetujuan di institusi.
// READ-ONLY terhadap guru_administrasi (hanya SELECT). Untuk panel Kepsek/Wakasek.

export async function GET(req: Request) {
  try {
    const sessionData = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cari institusi tempat user punya role kepala_sekolah/wakasek
    const memberRes = await query(
      `SELECT im.institution_id, ARRAY_AGG(imr.value) AS roles
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.status = 'active'
         AND imr.value IN ('kepala_sekolah','wakasek')
       GROUP BY im.institution_id`,
      [sessionData.id]
    );

    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden: bukan pimpinan institusi" }, { status: 403 });
    }

    const instIds = memberRes.rows.map((r: any) => r.institution_id);
    const roleMap: Record<number, string[]> = {};
    memberRes.rows.forEach((r: any) => { roleMap[r.institution_id] = r.roles; });

    const docsRes = await query(
      `SELECT ga.id, ga.user_id, ga.tipe_dokumen, ga.judul_dokumen, ga.approval_status,
              ga.approval_note, ga.created_at, ga.institution_id,
              u.nama_lengkap AS guru_nama
       FROM guru_administrasi ga
       JOIN users u ON u.id = ga.user_id
       WHERE ga.institution_id = ANY($1)
         AND ga.tipe_dokumen IN ('rpp','modul')
         AND ga.approval_status = 'pending'
       ORDER BY ga.created_at ASC`,
      [instIds]
    );

    // Tandai apakah user boleh approve (wakasek hanya kalau double layer)
    const rows = docsRes.rows.map((d: any) => {
      const layerRes = memberRes; // sudah ada di roleMap
      const roles = roleMap[d.institution_id] || [];
      let canApprove = false;
      if (roles.includes("kepala_sekolah")) canApprove = true;
      return { ...d, can_approve: canApprove, my_roles: roles };
    });

    return NextResponse.json({ documents: rows, institutionCount: instIds.length });
  } catch (err: any) {
    console.error("list pending approval error:", err);
    return NextResponse.json({ error: "Gagal memuat daftar persetujuan" }, { status: 500 });
  }
}
