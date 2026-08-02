import { pool, query } from "./db";
import { sendInAppNotification } from "./institution-members";

export type TokenAccessResult = {
  allowed: boolean;
  reason?: "token_habis" | "subscription_expired" | "ok" | "user_not_found" | "token_low";
  remainingTokens?: number;
};

export function evaluateTokenAccess(args: {
  role?: string | null;
  totalPoinAvailable?: number | null;
  subscriptionEnd?: string | Date | null;
  subscriptionStatus?: string | null;
}): TokenAccessResult {
  const role = args.role || "guru";
  const totalPoin = Number(args.totalPoinAvailable || 0);

  if (role === "admin") {
    return { allowed: true, reason: "ok", remainingTokens: totalPoin };
  }

  if (args.subscriptionStatus === "locked") {
    return { allowed: false, reason: "subscription_expired", remainingTokens: 0 };
  }

  if (args.subscriptionEnd && args.subscriptionStatus !== "grace_period") {
    const expiry = new Date(args.subscriptionEnd).getTime();
    const isExpired = Number.isFinite(expiry) && expiry <= Date.now();

    if (isExpired) {
      return { allowed: false, reason: "subscription_expired", remainingTokens: 0 };
    }
  }

  if (totalPoin <= 0) {
    return { allowed: false, reason: "token_habis", remainingTokens: 0 };
  }

  return { allowed: true, reason: "ok", remainingTokens: totalPoin };
}

export async function getUserTokenAccess(userId: string) {
  const userRes = await query(
    `SELECT
       id, role,
       quota_poin_total, quota_poin_used,
       addon_poin, addon_poin_used, addon_poin_grace_period_ends,
       subscription_end, subscription_status
     FROM users WHERE id = $1`,
    [userId]
  );

  if (userRes.rows.length === 0) {
    return {
      user: null,
      access: { allowed: false, reason: "user_not_found" as const, remainingTokens: 0 },
    };
  }

  const user = userRes.rows[0];

  const mainAvailable = Math.max(0, (user.quota_poin_total || 0) - (user.quota_poin_used || 0));
  const addonAvailable = Math.max(0, (user.addon_poin || 0) - (user.addon_poin_used || 0));

  const gracePeriodEnds = user.addon_poin_grace_period_ends
    ? new Date(user.addon_poin_grace_period_ends).getTime()
    : null;
  const isAddonGraceActive = gracePeriodEnds && gracePeriodEnds > Date.now();
  const effectiveAddon = isAddonGraceActive ? addonAvailable : 0;

  const combinedBalance = mainAvailable + effectiveAddon;

  return {
    user,
    access: evaluateTokenAccess({
      role: user.role,
      totalPoinAvailable: combinedBalance,
      subscriptionEnd: user.subscription_end,
      subscriptionStatus: user.subscription_status,
    }),
  };
}

/**
 * @deprecated Use consumeUserPoin from @/src/services/poin-service instead.
 * This function is kept for backward compatibility but reads from the old
 * token_limit/addon_token_balance columns.
 */
export async function consumeUserToken(userId: string, amount = 1) {
  // Fallback: read from new columns and delegate
  const userRes = await query(
    `SELECT quota_poin_total, quota_poin_used, addon_poin, addon_poin_used, addon_poin_grace_period_ends
     FROM users WHERE id = $1`,
    [userId]
  );
  if (userRes.rows.length === 0) return 0;

  const user = userRes.rows[0];
  const mainAvailable = Math.max(0, (user.quota_poin_total || 0) - (user.quota_poin_used || 0));
  const addonAvailable = Math.max(0, (user.addon_poin || 0) - (user.addon_poin_used || 0));
  const gracePeriodEnds = user.addon_poin_grace_period_ends
    ? new Date(user.addon_poin_grace_period_ends).getTime()
    : null;
  const isAddonGraceActive = gracePeriodEnds && gracePeriodEnds > Date.now();
  const effectiveAddon = isAddonGraceActive ? addonAvailable : 0;

  const combined = mainAvailable + effectiveAddon;
  return Math.max(0, combined - amount);
}

/**
 * @deprecated Use grantUserPoin from @/src/services/poin-service instead.
 */
export async function grantUserTokens(userId: string, amount: number) {
  // Delegate to new system
  const res = await query(
    "UPDATE users SET quota_poin_total = GREATEST(0, COALESCE(quota_poin_total, 0)) + $1 WHERE id = $2 RETURNING quota_poin_total",
    [amount, userId]
  );
  return Number(res.rows[0]?.quota_poin_total || 0);
}

/**
 * @deprecated Use grantAddonPoin from @/src/services/poin-service instead.
 */
export async function grantAddonTokens(userId: string, amount: number) {
  // Delegate to new system
  const res = await query(
    "UPDATE users SET addon_poin = GREATEST(0, COALESCE(addon_poin, 0)) + $1 WHERE id = $2 RETURNING addon_poin",
    [amount, userId]
  );
  return Number(res.rows[0]?.addon_poin || 0);
}

/**
 * @deprecated Token usage logging is now handled by poin-service via poin_transactions.
 */
export async function logAIUsage(args: {
  userId: string;
  feature: string;
  model?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  imageTokens?: number;
  totalCostIdr?: number;
  tokensCharged?: number;
  success?: boolean;
  errorMessage?: string | null;
  durationMs?: number;
  mapel?: string;
  jenjang?: string;
  jumlahSoal?: number;
}): Promise<void> {
  // No-op: poin_transactions ledger in poin-service replaces this
  console.warn("[TokenSystem] logAIUsage is deprecated. Use poin_transactions instead.");
}
