import { query } from "@/lib/db";

// =====================================================
// Konfigurasi lapisan approval RPP/Modul Ajar.
// Single source of truth: public.institutions.approval_layer_config
//   'single' -> Kepsek langsung menyetujui
//   'double' -> Wakasek dulu, lalu Kepsek final
// Fallback aman ke 'single' bila kolom/query gagal.
// =====================================================

export type ApprovalLayer = "single" | "double";

export async function getApprovalLayer(institutionId: number | null): Promise<ApprovalLayer> {
  if (!institutionId) return "single";
  try {
    const res = await query(
      `SELECT approval_layer_config FROM institutions WHERE id = $1`,
      [institutionId]
    );
    const val = res.rows[0]?.approval_layer_config;
    return val === "double" ? "double" : "single";
  } catch {
    return "single";
  }
}

// Apakah institusi punya anggota ber-role wakasek aktif?
export async function hasWakasek(institutionId: number): Promise<boolean> {
  try {
    const res = await query(
      `SELECT im.id
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'wakasek'
       LIMIT 1`,
      [institutionId]
    );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

export async function getLeaderRoles(
  appUserId: string,
  institutionId: number
): Promise<string[]> {
  const res = await query(
    `SELECT imr.value AS role
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
       AND imr.value IN ('kepala_sekolah','wakasek')
     GROUP BY imr.value`,
    [appUserId, institutionId]
  );
  return res.rows.map((r: any) => r.role);
}
