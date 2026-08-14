import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookieHeader } from "@/lib/session-sign";

// Sprint 3.1 — Guru mengajukan RPP/Modul Ajar ke Kepsek (opsional per institusi).
// Tidak mengubah alur generate-dan-pakai; hanya mengubah approval_status draft -> pending.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sessionData = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const docRes = await query(
      `SELECT id, user_id, tipe_dokumen, approval_status, institution_id
       FROM guru_administrasi WHERE id = $1`,
      [id]
    );
    if (docRes.rows.length === 0) {
      return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    }
    const doc = docRes.rows[0];
    if (doc.user_id !== sessionData.id) {
      return NextResponse.json({ error: "Forbidden: bukan dokumen Anda" }, { status: 403 });
    }
    if (!["rpp", "modul"].includes(doc.tipe_dokumen)) {
      return NextResponse.json({ error: "Hanya RPP/Modul Ajar yang bisa diajukan" }, { status: 400 });
    }
    if (!["draft", "revisi"].includes(doc.approval_status)) {
      return NextResponse.json(
        { error: `Tidak bisa diajukan, status saat ini: ${doc.approval_status}` },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE guru_administrasi SET approval_status = 'pending', approved_by = NULL, approved_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING id, approval_status`,
      [id]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error("submit-approval error:", err);
    return NextResponse.json({ error: "Gagal mengajukan dokumen" }, { status: 500 });
  }
}
