import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Sprint 3.1 — Kepsek/Wakasek menyetujui atau minta revisi RPP/Modul Ajar.
// Reuse pola SKP Approval Flow: cek institutions.approvalLayerConfig (single/double).
// Hanya mengubah approval_status dokumen, tidak mengubah isi/generation RPP.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sessionCookie = req.headers.get("cookie")?.split(";")
      .find((c) => c.trim().startsWith("gurupro_session="));
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split("=")[1]));

    const docRes = await query(
      `SELECT id, user_id, tipe_dokumen, approval_status, institution_id
       FROM guru_administrasi WHERE id = $1`,
      [id]
    );
    if (docRes.rows.length === 0) {
      return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    }
    const doc = docRes.rows[0];
    if (!["rpp", "modul"].includes(doc.tipe_dokumen)) {
      return NextResponse.json({ error: "Bukan dokumen RPP/Modul Ajar" }, { status: 400 });
    }

    // Cek wewenang via institusi (jika dokumen terikat institusi)
    let institutionId = doc.institution_id;
    if (institutionId) {
      const roleRes = await query(
        `SELECT imr.value FROM institution_members im
         JOIN institution_members_role imr ON imr.parent_id = im.id
         WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
        [sessionData.id, institutionId]
      );
      const roles = roleRes.rows.map((r: any) => r.value);

      const instRes = await query(`SELECT approval_layer_config FROM institutions WHERE id = $1`, [institutionId]);
      const layer = instRes.rows[0]?.approval_layer_config || "single";

      let hasPermission = false;
      if (roles.includes("kepala_sekolah")) hasPermission = true;
      else if (roles.includes("wakasek")) hasPermission = layer === "double";

      if (!hasPermission) {
        return NextResponse.json(
          { error: "Forbidden: Anda tidak memiliki wewenang menyetujui dokumen ini" },
          { status: 403 }
        );
      }
    } else {
      // Dokumen individu tanpa institusi: hanya admin yang bisa approve
      if (sessionData.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const { catatan, aksi } = body; // aksi: 'approve' | 'revisi'

    if (aksi !== "approve" && aksi !== "revisi") {
      return NextResponse.json({ error: "Aksi tidak valid (approve/revisi)" }, { status: 400 });
    }
    if (doc.approval_status !== "pending") {
      return NextResponse.json(
        { error: `Dokumen tidak dalam status pending (status: ${doc.approval_status})` },
        { status: 400 }
      );
    }

    const newStatus = aksi === "approve" ? "approved" : "revisi";
    const result = await query(
      `UPDATE guru_administrasi
       SET approval_status = $1,
           approval_note = COALESCE($2, approval_note),
           approved_by = $3,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $4 AND approval_status = 'pending'
       RETURNING id, approval_status, approval_note`,
      [newStatus, catatan || null, sessionData.id, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Gagal memproses dokumen" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error("approve RPP error:", err);
    return NextResponse.json({ error: "Gagal memproses persetujuan" }, { status: 500 });
  }
}
