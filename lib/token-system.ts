import { pool, query } from "./db";
import { sendInAppNotification } from "./institution-members";

export type TokenAccessResult = {
  allowed: boolean;
  reason?: "token_habis" | "subscription_expired" | "ok" | "user_not_found" | "token_low";
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

    // Check if tokens are now low (<= 5) and send in-app notification
    const newTotal = nextMain + nextAddon;
    if (newTotal <= 5 && newTotal >= 0) {
      try {
        await sendInAppNotification(
          userId,
          "⚠️ Kuota Token Menipis!",
          `Sisa token Anda tinggal ${newTotal}. Pertimbangkan untuk melakukan top-up agar tidak terganggu aktivitas.`,
          "token_low",
          "token_balance",
          null
        );
        console.log(`[TokenSystem] Sent low token warning to user ${userId}`);
      } catch (notifErr) {
        console.error("[TokenSystem] Failed to send low token notification:", notifErr);
      }
    }

    return newTotal;
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

/**
 * Catat penggunaan AI ke tabel TokenUsage (audit terpusat).
 * Dipanggil dari semua endpoint AI setelah generate (sukses maupun gagal).
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
  const requestId = `tu_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    await query(
      `INSERT INTO "TokenUsage"
        (id, user_id, request_id, feature, model, provider, input_tokens, output_tokens, image_tokens, total_cost_idr, tokens_charged, success, error_message, duration_ms, mapel, jenjang, jumlah_soal)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        args.userId,
        requestId,
        args.feature || "unknown",
        args.model || "unknown",
        args.provider || "unknown",
        args.inputTokens || 0,
        args.outputTokens || 0,
        args.imageTokens || 0,
        args.totalCostIdr || 0,
        args.tokensCharged || 0,
        args.success !== false,
        args.errorMessage || null,
        args.durationMs || 0,
        args.mapel || "-",
        args.jenjang || "-",
        args.jumlahSoal || 0,
      ]
    );
  } catch (err) {
    console.error("[TokenSystem] Failed to write TokenUsage log:", err);
  }
}
