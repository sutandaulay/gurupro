/**
 * Token-per-Poin Ratio Cache
 *
 * Rasio diambil SANGAT SERING (setiap generation) sehingga TIDAK BOLEH
 * query DB di tiap request. Di-cache di memory aplikasi.
 *
 * Invalidation: saat admin mengubah setting `tokens_per_poin`
 * (lihat `invalidateTokensPerPoinCache()`), cache di-reset agar
 * pembacaan berikutnya mengambil nilai baru dari DB.
 *
 * Kritis untuk audit: nilai rasio yang dipakai untuk menghitung Poin
 * SUDAH disimpan per-transaksi (`ratio_used_at_transaction`) — jadi
 * perubahan rasio di kemudian hari TIDAK mengubah transaksi lama.
 */

import { DEFAULT_TOKENS_PER_POIN } from "./billing";
import { getSystemSetting, updateSystemSetting } from "@/lib/settings";
import { query } from "@/lib/db";

const RATIO_KEY = "tokens_per_poin";

// In-memory singleton cache (survives module reload via globalThis)
const globalForRatio = globalThis as unknown as {
  __tokensPerPoinCache?: { value: number; expires: number } | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

async function readRatioFromDb(): Promise<number> {
  const raw = await getSystemSetting<number>(RATIO_KEY);
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_TOKENS_PER_POIN;
}

/**
 * Ambil rasio token-per-poin dari cache (atau DB bila cache miss/expired).
 * WAJIB dipakai oleh seluruh downstream — jangan hardcode rasio.
 */
export async function getTokensPerPoin(): Promise<number> {
  const cache = globalForRatio.__tokensPerPoinCache;
  const now = Date.now();
  if (cache && cache.expires > now) {
    return cache.value;
  }
  const value = await readRatioFromDb();
  globalForRatio.__tokensPerPoinCache = { value, expires: now + CACHE_TTL_MS };
  return value;
}

/**
 * Reset cache. Dipanggil saat admin mengubah setting `tokens_per_poin`
 * agar generation berikutnya memakai nilai baru (cache invalidation).
 */
export function invalidateTokensPerPoinCache(): void {
  globalForRatio.__tokensPerPoinCache = null;
}

/**
 * Inisialisasi nilai awal bila belum ada di DB.
 * Menulis default 2000 (positif >0) bila setting belum diset.
 */
export async function ensureTokensPerPoinSetting(): Promise<void> {
  const existing = await getSystemSetting<number>(RATIO_KEY);
  if (existing === null || existing === undefined) {
    await updateSystemSetting(RATIO_KEY, DEFAULT_TOKENS_PER_POIN);
  }
  invalidateTokensPerPoinCache();
}

// ============================================================
// UPDATE RATIO + AUDIT LOG (Item 2 & 3)
// ============================================================

/**
 * Update rasio token-per-Poin oleh admin.
 *
 * Melakukan dalam satu transaction:
 * 1. Ambil nilai lama dari DB
 * 2. Update system_settings dengan nilai baru
 * 3. Invalidate in-memory cache (segera生效)
 * 4. INSERT ke poin_ratio_audit (audit trail terpisah)
 *
 * Ini memastikan:
 * - Cache invalidation langsung (bukan tunggu TTL 5 menit)
 * - Audit log perubahan rasio tersimpan permanen
 *
 * @param adminUserId - ID admin yang mengubah
 * @param newRatio - Nilai rasio baru (harus > 0)
 * @param note - Catatan opsional dari admin
 * @returns { oldRatio, newRatio } atau error
 */
export async function updateTokensPerPoinRatio(
  adminUserId: string,
  newRatio: number,
  note?: string
): Promise<{ oldRatio: number; newRatio: number }> {
  // Validasi input
  const ratio = Number(newRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error("Rasio harus angka positif lebih dari 0");
  }

  // Ambil nilai lama
  const oldRatio = await readRatioFromDb();

  // Jika nilai sama, tidak perlu apa-apa
  if (oldRatio === ratio) {
    return { oldRatio, newRatio: ratio };
  }

  // Update setting + write audit log dalam transaction
  const client = (await import("@/lib/db")).pool;
  const dbQuery = (await import("@/lib/db")).query;

  const dbClient = await client.connect();
  try {
    await dbClient.query("BEGIN");

    // 1. Update system_settings
    await dbClient.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [RATIO_KEY, String(ratio)]
    );

    // 2. Insert audit log
    await dbClient.query(
      `INSERT INTO poin_ratio_audit (admin_user_id, old_ratio, new_ratio, note)
       VALUES ($1, $2, $3, $4)`,
      [adminUserId, oldRatio, ratio, note || null]
    );

    await dbClient.query("COMMIT");

    // 3. Invalidate cache — langsung生效
    invalidateTokensPerPoinCache();

    console.log(`[RatioCache] Ratio updated: ${oldRatio} → ${ratio} by admin ${adminUserId}`);
    return { oldRatio, newRatio: ratio };
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
}
