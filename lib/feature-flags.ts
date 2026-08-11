import { query } from "@/lib/db";

// =====================================================
// Feature Flags per institusi (§6.2 rollout bertahap)
// Tabel BARU institution_feature_flags — tidak menyentuh
// skema modul existing. Default: readonly/pasif (FALSE),
// fitur dinyalakan eksplisit per institusi sebelum rilis.
// =====================================================

export type InstitutionFeatureKey =
  | "command_center"
  | "smart_alerts"
  | "kanban_tasks"
  | "approval_queue"
  | "pkg_digital"
  | "akreditasi";

export const INSTITUTION_FEATURES: Record<InstitutionFeatureKey, string> = {
  command_center: "Executive Dashboard / Command Center",
  smart_alerts: "Smart Alert / Anomaly Detection",
  kanban_tasks: "Kanban Task Management",
  approval_queue: "Approval Queue Terpusat",
  pkg_digital: "PKG Digital",
  akreditasi: "Modul Akreditasi & Pengawasan",
};

const DEFAULT_ENABLED: Partial<Record<InstitutionFeatureKey, boolean>> = {};

/**
 * Cek apakah sebuah fitur aktif untuk institusi tertentu.
 * Default dari DEFAULT_ENABLED bila belum ada flag eksplisit.
 */
export async function isInstitutionFeatureEnabled(
  institutionId: number,
  featureKey: InstitutionFeatureKey
): Promise<boolean> {
  try {
    const res = await query(
      `SELECT enabled FROM institution_feature_flags
       WHERE institution_id = $1 AND feature_key = $2`,
      [institutionId, featureKey]
    );
    if (res.rows.length > 0) {
      return Boolean(res.rows[0].enabled);
    }
  } catch (err) {
    console.error(`[feature-flags] read error for ${featureKey}@${institutionId}:`, err);
  }
  return DEFAULT_ENABLED[featureKey] ?? false;
}

/** Daftar fitur yang sedang aktif untuk sebuah institusi. */
export async function getEnabledFeatures(
  institutionId: number
): Promise<InstitutionFeatureKey[]> {
  try {
    const res = await query(
      `SELECT feature_key, enabled FROM institution_feature_flags
       WHERE institution_id = $1 AND enabled = TRUE`,
      [institutionId]
    );
    const explicit = new Set(res.rows.map((r: any) => r.feature_key));
    const result: InstitutionFeatureKey[] = [...res.rows.map((r: any) => r.feature_key)];
    for (const key of Object.keys(DEFAULT_ENABLED) as InstitutionFeatureKey[]) {
      if ((DEFAULT_ENABLED[key] ?? false) && !explicit.has(key)) {
        result.push(key);
      }
    }
    return result;
  } catch (err) {
    console.error(`[feature-flags] getEnabledFeatures error for ${institutionId}:`, err);
    return [];
  }
}

/**
 * Nyalakan/matikan fitur untuk institusi (upsert).
 * Dipakai oleh panel pengaturan Kepsek (per-institusi), bukan gate publik.
 */
export async function setInstitutionFeature(
  institutionId: number,
  featureKey: InstitutionFeatureKey,
  enabled: boolean
): Promise<void> {
  await query(
    `INSERT INTO institution_feature_flags (institution_id, feature_key, enabled, created_at, updated_at)
     VALUES ($1, $2, $3, now(), now())
     ON CONFLICT (institution_id, feature_key)
     DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`,
    [institutionId, featureKey, enabled]
  );
}

/** Menyalakan fitur untuk semua institusi yang statusnya aktif (event rollout). */
export async function enableFeatureForAllActiveInstitutions(
  featureKey: InstitutionFeatureKey,
  enabled: boolean = true
): Promise<number> {
  const res = await query(
    `INSERT INTO institution_feature_flags (institution_id, feature_key, enabled, created_at, updated_at)
     SELECT id, $1, $2, now(), now() FROM institutions WHERE status = 'active'
     ON CONFLICT (institution_id, feature_key)
     DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
     RETURNING institution_id`,
    [featureKey, enabled]
  );
  return res.rows.length;
}