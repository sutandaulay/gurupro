import { pool, query } from "./db";

export type TokenAccessResult = {
  allowed: boolean;
  reason?: "token_habis" | "subscription_expired" | "ok" | "user_not_found";
  remainingTokens?: number;
};

export function evaluateTokenAccess(args: {
  role?: string | null;
  tokenLimit?: number | null;
  subscriptionEnd?: string | Date | null;
  subscriptionStatus?: string | null;
}): TokenAccessResult {
  const role = args.role || "guru";
  const tokenLimit = Number(args.tokenLimit || 0);

  if (role === "admin") {
    return { allowed: true, reason: "ok", remainingTokens: tokenLimit };
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

  if (tokenLimit <= 0) {
    return { allowed: false, reason: "token_habis", remainingTokens: 0 };
  }

  return { allowed: true, reason: "ok", remainingTokens: tokenLimit };
}

export function applyTokenDelta(currentBalance: number, delta: number, kind: "ai_usage" | "topup" | "reset") {
  const base = Number(currentBalance || 0);
  const amount = Math.abs(Number(delta || 0));

  if (kind === "ai_usage") {
    return Math.max(0, base - amount);
  }

  if (kind === "topup") {
    return base + amount;
  }

  if (kind === "reset") {
    return Math.max(0, amount);
  }

  return base;
}

export async function getUserTokenAccess(userId: string) {
  const userRes = await query("SELECT token_limit, addon_token_balance, role, subscription_end, subscription_status FROM users WHERE id = $1", [userId]);
  if (userRes.rows.length === 0) {
    return {
      user: null,
      access: { allowed: false, reason: "user_not_found" as const, remainingTokens: 0 },
    };
  }

  const user = userRes.rows[0];
  const mainBalance = Number(user.token_limit || 0);
  const addonBalance = Number(user.addon_token_balance || 0);
  const combinedBalance = mainBalance + addonBalance;

  return {
    user,
    access: evaluateTokenAccess({
      role: user.role,
      tokenLimit: combinedBalance,
      subscriptionEnd: user.subscription_end,
      subscriptionStatus: user.subscription_status,
    }),
  };
}

export async function consumeUserToken(userId: string, amount = 1) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentRes = await client.query("SELECT token_limit, addon_token_balance FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const currentMain = Number(currentRes.rows[0]?.token_limit || 0);
    const currentAddon = Number(currentRes.rows[0]?.addon_token_balance || 0);

    let nextMain = currentMain;
    let nextAddon = currentAddon;
    let remaining = amount;

    if (currentMain > 0) {
      const usedFromMain = Math.min(currentMain, remaining);
      nextMain = currentMain - usedFromMain;
      remaining -= usedFromMain;
    }

    if (remaining > 0) {
      nextAddon = Math.max(0, currentAddon - remaining);
    }

    await client.query("UPDATE users SET token_limit = $1, addon_token_balance = $2 WHERE id = $3", [nextMain, nextAddon, userId]);
    await client.query("COMMIT");
    return nextMain + nextAddon;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function grantUserTokens(userId: string, amount: number) {
  const res = await query(
    "UPDATE users SET token_limit = GREATEST(0, COALESCE(token_limit, 0) + $1) WHERE id = $2 RETURNING token_limit",
    [amount, userId]
  );
  return Number(res.rows[0]?.token_limit || 0);
}

export async function grantAddonTokens(userId: string, amount: number) {
  const res = await query(
    "UPDATE users SET addon_token_balance = GREATEST(0, COALESCE(addon_token_balance, 0) + $1) WHERE id = $2 RETURNING addon_token_balance",
    [amount, userId]
  );
  return Number(res.rows[0]?.addon_token_balance || 0);
}
