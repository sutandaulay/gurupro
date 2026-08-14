import { query } from "@/lib/db";

// =====================================================
// Notifikasi approval RPP/Modul Ajar (in-app)
// Menutup loop guru <-> Kepsek:
//   - Guru mengajukan  -> notif ke Kepsek/Wakasek
//   - Kepsek setujui   -> notif ke guru
//   - Kepsek minta rev -> notif ke guru
// =====================================================

// Audit trail approval: catat tiap aksi untuk pertanggungjawaban.
export async function logApprovalAction(params: {
  docId: string;
  actorUserId: string;
  actorName: string;
  action: "submit" | "wakasek_approve" | "approve" | "revisi";
  note?: string | null;
  institutionId?: number | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO guru_administrasi_approval_log
         (doc_id, actor_user_id, actor_name, action, note, institution_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        params.docId,
        params.actorUserId,
        params.actorName,
        params.action,
        params.note ?? null,
        params.institutionId ?? null,
      ]
    );
  } catch (err) {
    console.error("Failed to log approval action:", err);
  }
}

async function send(userId: string, title: string, body: string, type: string, referenceId: string) {
  try {
    await query(
      `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id, created_at)
       VALUES ($1, $2, $3, $4, 'administrasi', $5, NOW())`,
      [userId, title, body, type, referenceId]
    );
  } catch (err) {
    console.error("Failed to send approval notification:", err);
  }
}

// Guru mengajukan dokumen -> beri tahu pimpinan institusi (Kepsek/Wakasek)
export async function notifyLeadersDocSubmitted(
  institutionId: number | null,
  docId: string,
  judul: string,
  guruNama: string
): Promise<void> {
  if (!institutionId) return;
  const res = await query(
    `SELECT DISTINCT im.app_user_id::text AS user_id
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.institution_id = $1 AND im.status = 'active'
       AND imr.value IN ('kepala_sekolah','wakasek')`,
    [institutionId]
  );
  for (const r of res.rows) {
    await send(
      r.user_id,
      "Dokumen baru menunggu persetujuan",
      `"${judul}" diajukan oleh ${guruNama} dan menunggu persetujuan Anda.`,
      "approval",
      docId
    );
  }
}

// Kepsek/Wakasek memutuskan -> beri tahu guru pemilik dokumen
export async function notifyTeacherDocDecided(
  userId: string,
  docId: string,
  judul: string,
  aksi: "approve" | "revisi",
  catatan: string | null,
  ksNama: string
): Promise<void> {
  if (aksi === "approve") {
    await send(
      userId,
      "Dokumen disetujui",
      `"${judul}" telah disetujui oleh ${ksNama}.`,
      "approval",
      docId
    );
  } else {
    await send(
      userId,
      "Dokumen perlu revisi",
      `"${judul}" diminta revisi oleh ${ksNama}.${catatan ? ` Catatan: ${catatan}` : ""}`,
      "approval",
      docId
    );
  }
}

// Kepsek menyetujui pada double-layer (Wakasek -> Kepsek)
export async function notifyLeaderForDoubleApproval(
  institutionId: number | null,
  docId: string,
  judul: string,
  wakasekNama: string
): Promise<void> {
  if (!institutionId) return;
  const res = await query(
    `SELECT DISTINCT im.app_user_id::text AS user_id
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.institution_id = $1 AND im.status = 'active'
       AND imr.value = 'kepala_sekolah'`,
    [institutionId]
  );
  for (const r of res.rows) {
    await send(
      r.user_id,
      "Menunggu persetujuan final (double approval)",
      `"${judul}" telah disetujui Wakasek ${wakasekNama} dan menunggu persetujuan final Anda.`,
      "approval",
      docId
    );
  }
}
