/**
 * GuruPRO Poin Service
 *
 * Service untuk mengelola kuota Poin dengan:
 * - Transaction + row-level lock untuk mencegah race condition
 * - Pengurangan dari kuota utama duluan, baru add-on
 * - Logging ke ledger untuk audit trail
 * - Grace period support untuk add-on
 */

import { pool, query } from '@/lib/db';
import {
  convertTokensToPoin,
  calculateEffectiveTokens,
  type PoinDeductionResult,
  type PoinTransaction,
} from '@/src/config/billing';
export type { PoinDeductionResult, PoinTransaction } from '@/src/config/billing';
import { getTokensPerPoin, invalidateTokensPerPoinCache } from '@/src/config/ratio-cache';
import { deductPoinFromAIResult } from '@/src/lib/ai-usage';
import type { AIUsageResult } from '@/src/lib/ai-usage-result';

// ============================================
// POIN ACCESS CHECK
// ============================================

export type PoinAccessResult = {
  allowed: boolean;
  reason?: 'poin_habis' | 'subscription_expired' | 'ok' | 'user_not_found' | 'grace_period_expired';
  remainingPoin?: number;
  remainingMainPoin?: number;
  remainingAddonPoin?: number;
};

/**
 * Evaluasi apakah user memiliki akses Poin yang cukup
 */
export function evaluatePoinAccess(args: {
  role?: string | null;
  mainPoinAvailable?: number | null;
  addonPoinAvailable?: number | null;
  subscriptionEnd?: string | Date | null;
  subscriptionStatus?: string | null;
  gracePeriodEndsAt?: string | Date | null;
}): PoinAccessResult {
  const role = args.role || 'guru';

  // Admin selalu punya akses
  if (role === 'admin') {
    return {
      allowed: true,
      reason: 'ok',
      remainingPoin: Infinity,
    };
  }

  // Cek subscription expired
  if (args.subscriptionStatus === 'locked') {
    return { allowed: false, reason: 'subscription_expired', remainingPoin: 0 };
  }

  if (args.subscriptionEnd && args.subscriptionStatus !== 'grace_period') {
    const expiry = new Date(args.subscriptionEnd).getTime();
    const isExpired = Number.isFinite(expiry) && expiry <= Date.now();

    if (isExpired) {
      return { allowed: false, reason: 'subscription_expired', remainingPoin: 0 };
    }
  }

  // Hitung total Poin tersedia
  const mainAvailable = Number(args.mainPoinAvailable || 0);
  const addonAvailable = Number(args.addonPoinAvailable || 0);
  const totalAvailable = mainAvailable + addonAvailable;

  if (totalAvailable <= 0) {
    return { allowed: false, reason: 'poin_habis', remainingPoin: 0 };
  }

  return {
    allowed: true,
    reason: 'ok',
    remainingPoin: totalAvailable,
    remainingMainPoin: mainAvailable,
    remainingAddonPoin: addonAvailable,
  };
}

/**
 * Ambil status Poin user dari database
 */
export async function getUserPoinAccess(userId: string): Promise<{
  user: any;
  access: PoinAccessResult;
}> {
  const userRes = await query(
    `SELECT
       id, role,
       quota_poin_total, quota_poin_used,
       addon_poin, addon_poin_used, addon_poin_grace_period_ends,
       subscription_end, subscription_status, grace_period_ends_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (userRes.rows.length === 0) {
    return {
      user: null,
      access: { allowed: false, reason: 'user_not_found' as const, remainingPoin: 0 },
    };
  }

  const user = userRes.rows[0];

  // Hitung Poin yang tersedia
  const mainAvailable = Math.max(0, (user.quota_poin_total || 0) - (user.quota_poin_used || 0));
  const addonAvailable = Math.max(0, (user.addon_poin || 0) - (user.addon_poin_used || 0));

  // Cek grace period untuk add-on
  const gracePeriodEnds = user.addon_poin_grace_period_ends
    ? new Date(user.addon_poin_grace_period_ends).getTime()
    : null;
  const isAddonGraceActive = gracePeriodEnds && gracePeriodEnds > Date.now();

  // Jika add-on expired dan Poin addon habis, jangan hitung addon
  const effectiveAddonAvailable = isAddonGraceActive ? addonAvailable : 0;

  return {
    user,
    access: evaluatePoinAccess({
      role: user.role,
      mainPoinAvailable: mainAvailable,
      addonPoinAvailable: effectiveAddonAvailable,
      subscriptionEnd: user.subscription_end,
      subscriptionStatus: user.subscription_status,
      gracePeriodEndsAt: user.grace_period_ends_at,
    }),
  };
}

// ============================================
// POIN CONSUMPTION (ATOMIC)
// ============================================

/**
 * Konsumsi Poin dari user dengan transaction + row-level lock
 * Menggunakan sistem AKUMULASI TOKEN:
 * - Setiap generate → token diakumulasi
 * - Poin dipotong hanya saat akumulasi >= tokensPerPoin
 * - Sisa akumulasi di-reset modulo tokensPerPoin
 *
 * @param userId - User ID
 * @param rawTokens - Total token mentah dari Gemini usage_metadata
 * @param feature - Nama fitur AI yang digunakan
 * @param options - Opsi tambahan (model, provider, dll)
 * @returns Result dari operasi
 */
export async function consumeUserPoin(
  userId: string,
  rawTokens: number,
  feature: string,
  options?: {
    model?: string;
    provider?: string;
    mapel?: string;
    jenjang?: string;
    jumlahSoal?: number;
  }
): Promise<PoinDeductionResult & { tokenAccumulated: number; tokensUntilNextPoin: number }> {
  const tokensPerPoin = await getTokensPerPoin();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock user row untuk prevent race condition
    const userRes = await client.query(
      `SELECT
         id, role,
         quota_poin_total, quota_poin_used,
         addon_poin, addon_poin_used, addon_poin_grace_period_ends,
         token_accumulated
       FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('User tidak ditemukan');
    }

    const user = userRes.rows[0];

    // Admin tidak dipotong
    if (user.role === 'admin') {
      await client.query('ROLLBACK');
      return {
        success: true,
        poinDeducted: 0,
        remainingPoin: Infinity,
        rawTokens,
        source: 'main',
        tokenAccumulated: 0,
        tokensUntilNextPoin: tokensPerPoin,
      };
    }

    // 2. Hitung Poin yang tersedia
    const mainAvailable = Math.max(0, (user.quota_poin_total || 0) - (user.quota_poin_used || 0));
    const addonAvailable = Math.max(0, (user.addon_poin || 0) - (user.addon_poin_used || 0));

    // Cek grace period untuk add-on
    const gracePeriodEnds = user.addon_poin_grace_period_ends
      ? new Date(user.addon_poin_grace_period_ends).getTime()
      : null;
    const isAddonGraceActive = gracePeriodEnds && gracePeriodEnds > Date.now();

    const totalAvailable = mainAvailable + (isAddonGraceActive ? addonAvailable : 0);
    const currentAccumulated = user.token_accumulated || 0;

    // 3. Tambah rawTokens ke akumulasi
    const newAccumulated = currentAccumulated + rawTokens;

    // 4. Hitung berapa Poin yang perlu dipotong
    const poinNeeded = Math.floor(newAccumulated / tokensPerPoin);
    const remainder = newAccumulated % tokensPerPoin;

    // 5. Tentukan status dan action
    let poinDeducted = 0;
    let usedFromMain = 0;
    let usedFromAddon = 0;
    let success = true;
    let finalAccumulated = newAccumulated;

    if (poinNeeded > 0) {
      // Threshold tercapai — potong Poin
      if (totalAvailable < poinNeeded) {
        // Poin tidak cukup — potong semua yang ada, akumulasi hangus
        poinDeducted = totalAvailable;
        usedFromMain = Math.min(mainAvailable, totalAvailable);
        usedFromAddon = totalAvailable - usedFromMain;
        finalAccumulated = 0; // akumulasi hangus karena Poin habis
        success = false;
      } else {
        // Poin cukup — potong sesuai akumulasi
        poinDeducted = poinNeeded;
        usedFromMain = Math.min(mainAvailable, poinNeeded);
        usedFromAddon = poinNeeded - usedFromMain;
        finalAccumulated = remainder; // reset sisa modulo
      }
    } else {
      // Belum mencapai threshold — tidak potong Poin, cuma akumulasi
      poinDeducted = 0;
      finalAccumulated = newAccumulated;
    }

    // 6. Update database
    await client.query(
      `UPDATE users SET
         quota_poin_used = COALESCE(quota_poin_used, 0) + $1,
         addon_poin_used = COALESCE(addon_poin_used, 0) + $2,
         token_accumulated = $3
       WHERE id = $4`,
      [usedFromMain, usedFromAddon, finalAccumulated, userId]
    );

    // 7. Log ke ledger
    const transactionId = `ptx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const source = usedFromMain > 0 ? 'main' : 'addon';

    await client.query(
      `INSERT INTO poin_transactions (
         id, user_id, feature, raw_tokens, poin_deducted, source,
         model, provider, mapel, jenjang, jumlah_soal, success,
         ratio_used_at_transaction, cached_tokens
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        transactionId,
        userId,
        feature,
        rawTokens,
        poinDeducted,
        source,
        options?.model || 'gemini-2.5-flash-lite',
        options?.provider || 'gemini',
        options?.mapel || '-',
        options?.jenjang || '-',
        options?.jumlahSoal || 0,
        success,
        tokensPerPoin,
        0,
      ]
    );

    await client.query('COMMIT');

    const remainingPoin = totalAvailable - poinDeducted;
    const tokensUntilNextPoin = tokensPerPoin - finalAccumulated;

    // 8. Check jika Poin menipis (<= 5) dan kirim notifikasi
    if (remainingPoin <= 5 && remainingPoin >= 0 && poinDeducted > 0) {
      sendLowPoinWarning(userId, remainingPoin).catch(err =>
        console.error('[PoinService] Failed to send low poin warning:', err)
      );
    }

    return {
      success,
      poinDeducted,
      remainingPoin,
      rawTokens,
      source: usedFromMain > 0 ? 'main' : (usedFromAddon > 0 ? 'addon' : 'main'),
      tokenAccumulated: finalAccumulated,
      tokensUntilNextPoin: Math.max(0, tokensUntilNextPoin),
    };

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[PoinService] consumeUserPoin error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Konsumsi Poin dari AIUsageResult terstandar (provider-agnostic).
 *
 * Total token = inputTokens + outputTokens.
 * cachedTokens dihitung dangan bobot lebih ringan (lihat CACHED_TOKEN_RATIO
 * di billing.ts via calculateEffectiveTokens) - sesuai kebijakan masing-masing
 * provider. Downstream CUKUP memanggil ini; TIDAK perlu membaca
 * struktur response provider tertentu.
 *
 * Sistem AKUMULASI TOKEN aktif: Poin dipotong hanya saat akumulasi >= tokensPerPoin.
 *
 * @returns Result + ratio_used_at_transaction yang disimpan ke ledger
 */
/**
 * Konsumsi Poin dari hasil AI usage.
 *
 * GUARD: Jika usage null/undefined/zero tokens, langsung return no-op
 * tanpa menulis ke DB. Ini mencegah bug di caller yang lupa cek kondisi.
 */
export async function consumeUserPoinFromUsage(
  userId: string,
  usage: AIUsageResult | null,
  feature: string,
  options?: {
    mapel?: string;
    jenjang?: string;
    jumlahSoal?: number;
  }
): Promise<PoinDeductionResult & { ratioUsed: number; tokenAccumulated: number; tokensUntilNextPoin: number }> {
  const inputTokens = usage?.inputTokens || 0;
  const outputTokens = usage?.outputTokens || 0;
  const cachedTokens = usage?.cachedTokens || 0;

  // GUARD: No real usage = no Poin deduction. Early return.
  if (!usage || (inputTokens === 0 && outputTokens === 0)) {
    const ratioUsed = await getTokensPerPoin();
    const userRes = await query(
      "SELECT token_accumulated FROM users WHERE id = $1",
      [userId]
    );
    const tokenAccumulated = userRes.rows[0]?.token_accumulated || 0;
    return {
      success: true,
      poinDeducted: 0,
      remainingPoin: 0,
      rawTokens: 0,
      source: 'main' as const,
      ratioUsed,
      tokenAccumulated,
      tokensUntilNextPoin: ratioUsed - tokenAccumulated,
    };
  }

  const model = usage.model || 'gemini-2.5-flash-lite';
  const provider = usage.provider || 'gemini';

  const effectiveTokens = calculateEffectiveTokens({
    promptTokenCount: inputTokens,
    candidatesTokenCount: outputTokens,
    cachedContentTokenCount: cachedTokens,
  });

  const result = await consumeUserPoin(userId, effectiveTokens, feature, {
    model,
    provider,
    mapel: options?.mapel,
    jenjang: options?.jenjang,
    jumlahSoal: options?.jumlahSoal,
  });

  const ratioUsed = await getTokensPerPoin();
  return { ...result, ratioUsed };
}

/**
 * Log gagal penggunaan Poin (untuk audit trail)
 */
export async function logFailedPoinUsage(
  userId: string,
  rawTokens: number,
  feature: string,
  errorMessage: string,
  options?: {
    model?: string;
    provider?: string;
    mapel?: string;
    jenjang?: string;
  }
): Promise<void> {
  try {
    const poinNeeded = convertTokensToPoin(rawTokens);
    const transactionId = `ptx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const ratioUsed = await getTokensPerPoin();

    await query(
      `INSERT INTO poin_transactions (
         id, user_id, feature, raw_tokens, poin_deducted, source,
         model, provider, mapel, jenjang, success, error_message,
         ratio_used_at_transaction, cached_tokens
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        transactionId,
        userId,
        feature,
        rawTokens,
        0,
        'failed',
        options?.model || 'gemini-2.5-flash-lite',
        options?.provider || 'gemini',
        options?.mapel || '-',
        options?.jenjang || '-',
        false,
        errorMessage,
        ratioUsed,
        0,
      ]
    );
  } catch (err) {
    console.error('[PoinService] logFailedPoinUsage error:', err);
  }
}

// ============================================
// POIN GRANT (Top-up)
// ============================================

/**
 * Tambah Poin ke kuota utama user
 */
export async function grantUserPoin(userId: string, poinAmount: number): Promise<number> {
  const res = await query(
    `UPDATE users SET
       quota_poin_total = GREATEST(0, COALESCE(quota_poin_total, 0) + $1)
     WHERE id = $2
     RETURNING quota_poin_total`,
    [poinAmount, userId]
  );
  return Number(res.rows[0]?.quota_poin_total || 0);
}

/**
 * Tambah Poin ke add-on user dengan grace period
 */
export async function grantAddonPoin(
  userId: string,
  poinAmount: number,
  gracePeriodDays: number = 14
): Promise<{ addonPoin: number; gracePeriodEnds: Date }> {
  const gracePeriodEnds = new Date();
  gracePeriodEnds.setDate(gracePeriodEnds.getDate() + gracePeriodDays);

  const res = await query(
    `UPDATE users SET
       addon_poin = GREATEST(0, COALESCE(addon_poin, 0) + $1),
       addon_poin_grace_period_ends = CASE
         WHEN addon_poin_grace_period_ends IS NULL OR addon_poin_grace_period_ends < NOW()
         THEN $2
         ELSE addon_poin_grace_period_ends
       END
     WHERE id = $3
     RETURNING addon_poin, addon_poin_grace_period_ends`,
    [poinAmount, gracePeriodEnds, userId]
  );

  return {
    addonPoin: Number(res.rows[0]?.addon_poin || 0),
    gracePeriodEnds: new Date(res.rows[0]?.addon_poin_grace_period_ends),
  };
}

// ============================================
// QUOTA RESET
// ============================================

/**
 * Reset kuota Poin utama (bulanan)
 */
export async function resetMainQuota(userId: string, newTotal: number): Promise<number> {
  const res = await query(
    `UPDATE users SET
       quota_poin_total = $1,
       quota_poin_used = 0,
       main_token_reset_date = NOW()
     WHERE id = $2
     RETURNING quota_poin_total`,
    [newTotal, userId]
  );
  return Number(res.rows[0]?.quota_poin_total || 0);
}

// ============================================
// HELPERS
// ============================================

/**
 * Kirim notifikasi jika Poin menipis
 */
async function sendLowPoinWarning(userId: string, remainingPoin: number): Promise<void> {
  const { sendInAppNotification } = await import('@/lib/institution-members');

  await sendInAppNotification(
    userId,
    '⚠️ Poin Menipis!',
    `Sisa Poin Anda tinggal ${remainingPoin}. Pertimbangkan untuk melakukan top-up agar tidak terganggu aktivitas.`,
    'poin_low',
    'poin_balance',
    undefined
  );
}

/**
 * Get poin transaction history untuk user
 */
export async function getUserPoinTransactions(
  userId: string,
  limit: number = 50
): Promise<PoinTransaction[]> {
  const res = await query(
    `SELECT id, user_id, feature, raw_tokens, poin_deducted, source,
            model, provider, mapel, jenjang, success, error_message, created_at
     FROM poin_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return res.rows.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    feature: row.feature,
    rawTokens: row.raw_tokens,
    poinDeducted: row.poin_deducted,
    source: row.source,
    timestamp: row.created_at,
    model: row.model,
    provider: row.provider,
    success: row.success,
    errorMessage: row.error_message,
  }));
}

/**
 * Get summary Poin usage untuk user
 */
export async function getUserPoinSummary(userId: string): Promise<{
  mainTotal: number;
  mainUsed: number;
  mainAvailable: number;
  addonTotal: number;
  addonUsed: number;
  addonAvailable: number;
  totalAvailable: number;
  totalTransactions: number;
}> {
  const userRes = await query(
    `SELECT quota_poin_total, quota_poin_used, addon_poin, addon_poin_used
     FROM users WHERE id = $1`,
    [userId]
  );

  if (userRes.rows.length === 0) {
    return {
      mainTotal: 0, mainUsed: 0, mainAvailable: 0,
      addonTotal: 0, addonUsed: 0, addonAvailable: 0,
      totalAvailable: 0, totalTransactions: 0,
    };
  }

  const user = userRes.rows[0];
  const mainTotal = user.quota_poin_total || 0;
  const mainUsed = user.quota_poin_used || 0;
  const mainAvailable = Math.max(0, mainTotal - mainUsed);

  const addonTotal = user.addon_poin || 0;
  const addonUsed = user.addon_poin_used || 0;
  const addonAvailable = Math.max(0, addonTotal - addonUsed);

  const txRes = await query(
    `SELECT COUNT(*) as total FROM poin_transactions WHERE user_id = $1 AND success = true`,
    [userId]
  );

  return {
    mainTotal,
    mainUsed,
    mainAvailable,
    addonTotal,
    addonUsed,
    addonAvailable,
    totalAvailable: mainAvailable + addonAvailable,
    totalTransactions: parseInt(txRes.rows[0]?.total || '0'),
  };
}
