import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookieHeader } from "@/lib/session-sign";
import { notifyTeacherDocDecided, notifyLeaderForDoubleApproval, logApprovalAction } from "@/lib/approval-notifications";
import { getApprovalLayer, hasWakasek, getLeaderRoles } from "@/lib/approval-config";

// Sprint 3.1 — Kepsek/Wakasek menyetujui atau minta revisi RPP/Modul Ajar.
// Alur lapisan ditentukan public.institutions.approval_layer_config:
//   single -> Kepsek menyetujui langsung
//   double -> Wakasek setujui dulu (pending), lalu Kepsek final (approved)
// Hanya mengubah approval_status dokumen, tidak mengubah isi/generation RPP.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sessionData = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const docRes = await query(
      `SELECT id, user_id, tipe_dokumen, approval_status, institution_id, judul_dokumen,
              wakasek_approved_by, wakasek_approved_at
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

    const institutionId = doc.institution_id;
    let roles: string[] = [];

    // Cek wewenang via institusi (jika dokumen terikat institusi)
    if (institutionId) {
      roles = await getLeaderRoles(sessionData.id, institutionId);
      const layer = await getApprovalLayer(institutionId);
      const isKepsek = roles.includes("kepala_sekolah");
      const isWakasek = roles.includes("wakasek");
      const wakasekSudahApprove = Boolean(doc.wakasek_approved_by && doc.wakasek_approved_at);

      if (layer === "double") {
        // double: Wakasek menyetujui layer-1; Kepsek finalisasi layer-2.
        if (isKepsek) {
          // Kepsek: boleh final approve bila wakasek sudah approve ATAU tidak ada wakasek.
          if (aksi === "approve" && !wakasekSudahApprove) {
            const adaWakasek = await hasWakasek(institutionId);
            if (adaWakasek) {
              return NextResponse.json(
                { error: "Double approval: mohon menunggu persetujuan Wakasek terlebih dahulu." },
                { status: 400 }
              );
            }
          }
        } else if (isWakasek) {
          // Wakasek hanya boleh layer-1 (approve) dan minta revisi.
          if (wakasekSudahApprove && aksi === "approve") {
            return NextResponse.json(
              { error: "Dokumen sudah disetujui Wakasek, menunggu persetujuan final Kepsek." },
              { status: 400 }
            );
          }
        } else {
          return NextResponse.json(
            { error: "Forbidden: Anda tidak memiliki wewenang menyetujui dokumen ini" },
            { status: 403 }
          );
        }
      } else {
        // single: hanya Kepsek.
        if (!isKepsek) {
          return NextResponse.json(
            { error: "Forbidden: hanya Kepala Sekolah yang dapat menyetujui." },
            { status: 403 }
          );
        }
      }
    } else {
      // Dokumen individu tanpa institusi: hanya admin yang bisa approve
      if (sessionData.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const ksRes = await query(`SELECT nama_lengkap FROM users WHERE id = $1`, [sessionData.id]);
    const ksNama = ksRes.rows[0]?.nama_lengkap || "Kepala Sekolah";

    // ── Aksi revisi: kembalikan ke guru, reset semua jejak approval ──
    if (aksi === "revisi") {
      const result = await query(
        `UPDATE guru_administrasi
         SET approval_status = 'revisi',
             approval_note = $1,
             approved_by = NULL,
             approved_at = NULL,
             wakasek_approved_by = NULL,
             wakasek_approved_at = NULL
         WHERE id = $2 AND approval_status = 'pending'
         RETURNING id, approval_status, approval_note`,
        [catatan || null, id]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Gagal memproses dokumen" }, { status: 404 });
      }
      await notifyTeacherDocDecided(doc.user_id, id, doc.judul_dokumen, "revisi", catatan || null, ksNama);
      await logApprovalAction({
        docId: id,
        actorUserId: sessionData.id,
        actorName: ksNama,
        action: "revisi",
        note: catatan || null,
        institutionId,
      });
      return NextResponse.json(result.rows[0]);
    }

    // ── Aksi approve: tentukan final vs layer-1 ──
    const layer = institutionId ? await getApprovalLayer(institutionId) : "single";
    if (layer === "double") {
      const isKepsek = roles.includes("kepala_sekolah");
      const wakasekSudahApprove = Boolean(doc.wakasek_approved_by && doc.wakasek_approved_at);

      if (isKepsek) {
        // Finalisasi: status -> approved
        const result = await query(
          `UPDATE guru_administrasi
           SET approval_status = 'approved',
               approval_note = COALESCE($1, approval_note),
               approved_by = $2,
               approved_at = NOW()
           WHERE id = $3 AND approval_status = 'pending'
           RETURNING id, approval_status, approval_note`,
          [catatan || null, sessionData.id, id]
        );
        if (result.rows.length === 0) {
          return NextResponse.json({ error: "Gagal memproses dokumen" }, { status: 404 });
        }
        await notifyTeacherDocDecided(doc.user_id, id, doc.judul_dokumen, "approve", catatan || null, ksNama);
        await logApprovalAction({
          docId: id,
          actorUserId: sessionData.id,
          actorName: ksNama,
          action: "approve",
          note: catatan || null,
          institutionId,
        });
        return NextResponse.json(result.rows[0]);
      }

      if (!wakasekSudahApprove) {
        // Wakasek layer-1: dokumentasikan, status tetap pending (menunggu Kepsek).
        const result = await query(
          `UPDATE guru_administrasi
           SET wakasek_approved_by = $1,
               wakasek_approved_at = NOW(),
               approval_note = COALESCE($2, approval_note),
               updated_at = NOW()
           WHERE id = $3 AND approval_status = 'pending'
           RETURNING id, approval_status, wakasek_approved_at`,
          [sessionData.id, catatan || null, id]
        );
        if (result.rows.length === 0) {
          return NextResponse.json({ error: "Gagal memproses dokumen" }, { status: 404 });
        }
        await notifyLeaderForDoubleApproval(institutionId, id, doc.judul_dokumen, ksNama);
        await logApprovalAction({
          docId: id,
          actorUserId: sessionData.id,
          actorName: ksNama,
          action: "wakasek_approve",
          note: catatan || null,
          institutionId,
        });
        return NextResponse.json({
          ...result.rows[0],
          message: "Disetujui lapisan Wakasek. Menunggu persetujuan final Kepsek.",
        });
      }
    }

    // ── Single-layer (atau dokumen tanpa institusi): langsung approved ──
    const result = await query(
      `UPDATE guru_administrasi
       SET approval_status = 'approved',
           approval_note = COALESCE($1, approval_note),
           approved_by = $2,
           approved_at = NOW()
       WHERE id = $3 AND approval_status = 'pending'
       RETURNING id, approval_status, approval_note`,
      [catatan || null, sessionData.id, id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Gagal memproses dokumen" }, { status: 404 });
    }
    await notifyTeacherDocDecided(doc.user_id, id, doc.judul_dokumen, "approve", catatan || null, ksNama);
    await logApprovalAction({
      docId: id,
      actorUserId: sessionData.id,
      actorName: ksNama,
      action: "approve",
      note: catatan || null,
      institutionId,
    });
    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error("approve RPP error:", err);
    return NextResponse.json({ error: "Gagal memproses persetujuan" }, { status: 500 });
  }
}