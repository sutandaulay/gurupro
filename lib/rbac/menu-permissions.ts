import { pool, query } from "@/lib/db";

/**
 * Visibilitas menu/fitur/submenu per ROLE per institusi.
 * Default: TAMPAK. Konfigurasi tersimpan sebagai override eksplisit
 * (visible true/false) pada tabel institution_role_menu_settings.
 */

export interface RoleMenuSettingRow {
  feature_key: string;
  visible: boolean;
}

/** Ambil seluruh pengaturan satu role di satu institusi. */
export async function getRoleMenuSettings(
  institutionId: number,
  role: string
): Promise<RoleMenuSettingRow[]> {
  try {
    const res = await query(
      `SELECT feature_key, visible
       FROM institution_role_menu_settings
       WHERE institution_id = $1 AND role = $2
       ORDER BY feature_key`,
      [institutionId, role]
    );
    return res.rows.map((r: any) => ({ feature_key: r.feature_key, visible: Boolean(r.visible) }));
  } catch (err) {
    console.error(`[menu-permissions] getRoleMenuSettings error for role=${role}@${institutionId}:`, err);
    return [];
  }
}

/**
 * Simpan snapshot visibilitas lengkap sebuah role di institusi.
 * Menghapus baris lama lalu menulis ulang (full replace) di dalam satu transaksi.
 */
export async function saveRoleMenuSettings(
  institutionId: number,
  role: string,
  items: { featureKey: string; visible: boolean }[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM institution_role_menu_settings
       WHERE institution_id = $1 AND role = $2`,
      [institutionId, role]
    );
    for (const item of items) {
      await client.query(
        `INSERT INTO institution_role_menu_settings
           (institution_id, role, feature_key, visible, created_at, updated_at)
         VALUES ($1, $2, $3, $4, now(), now())
         ON CONFLICT (institution_id, role, feature_key)
         DO UPDATE SET visible = EXCLUDED.visible, updated_at = now()`,
        [institutionId, role, item.featureKey, item.visible]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[menu-permissions] saveRoleMenuSettings error for role=${role}@${institutionId}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Hitung feature key yang TERSEMBUNYI efektif untuk sekumpulan role user
 * di institusi aktif.
 *
 * Aturan gabungan:
 *  - Fitur tampil jika TIDAK ADA baris konfigurasi (default) ATAU
 *    salah satu role user menandainya visible = true.
 *  - Fitur tersembunyi hanya jika ADA konfigurasi dan SEMUA role user
 *    menandainya visible = false.
 */
export async function getEffectiveHiddenKeys(
  institutionId: number,
  roles: string[]
): Promise<string[]> {
  if (!institutionId || !roles || roles.length === 0) return [];

  try {
    const res = await query(
      `SELECT feature_key, visible
       FROM institution_role_menu_settings
       WHERE institution_id = $1 AND role = ANY($2::text[])`,
      [institutionId, roles]
    );

    const visibilityByKey: Record<string, { visible: boolean; anyRows: boolean }> = {};
    for (const r of res.rows as any[]) {
      const v = visibilityByKey[r.feature_key] ?? { visible: false, anyRows: false };
      v.anyRows = true;
      if (Boolean(r.visible)) v.visible = true;
      visibilityByKey[r.feature_key] = v;
    }

    const hidden: string[] = [];
    for (const [key, v] of Object.entries(visibilityByKey)) {
      if (v.anyRows && !v.visible) hidden.push(key);
    }
    return hidden;
  } catch (err) {
    console.error(`[menu-permissions] getEffectiveHiddenKeys error for ${institutionId}:`, err);
    return [];
  }
}
