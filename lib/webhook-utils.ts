/**
 * Shared Webhook Utilities
 *
 * Centralizes payment webhook processing logic used by:
 *   - /api/webhook/payment   (unified handler — auto-detects gateway)
 *   - /api/webhook/xendit    (delegates after signature verification)
 *   - /api/webhook/midtrans  (delegates after signature verification)
 *
 * Key features:
 *   - Uniform idempotency (double-checked at handler + inside withTransaction FOR UPDATE)
 *   - FOR UPDATE row-level locking prevents concurrent webhook retries
 *   - Graceful handling of addon poin vs subscription plans
 *   - In-app notifications on success
 */

import { query, withTransaction, pool } from "@/lib/db";
import type { Pool } from "pg";
import { grantAddonPoin } from "@/src/services/poin-service";
import { sendInAppNotification } from "@/lib/institution-members";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import crypto from "crypto";
import { getSystemSetting } from "@/lib/settings";

// ============================================================
// XENDIT SIGNATURE VERIFICATION
// ============================================================

/**
 * Timing-safe comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Retrieves the expected Xendit webhook token.
 * Priority: XENDIT_WEBHOOK_TOKEN env var (production) -> system_settings payment_gateway.xendit.verification_token.
 */
async function getExpectedXenditToken(): Promise<string> {
  const envToken = process.env.XENDIT_WEBHOOK_TOKEN;
  if (envToken) return envToken;
  const pgConfig = await getSystemSetting<{ xendit?: { verification_token?: string } }>("payment_gateway");
  return pgConfig?.xendit?.verification_token ?? "";
}

/**
 * Verifies the Xendit webhook signature/token.
 * Returns null if valid; returns an error NextResponse if invalid.
 */
export async function verifyXenditSignature(req: Request): Promise<NextResponse | null> {
  const providedToken = req.headers.get("x-callback-token") ?? "";
  const expectedToken = await getExpectedXenditToken();

  if (!expectedToken) {
    // No token configured — log warning but allow (sandbox mode)
    console.warn("[WEBHOOK] Xendit: no webhook token configured — skipping verification");
    return null;
  }

  if (!safeCompare(providedToken, expectedToken)) {
    console.warn("[WEBHOOK] Xendit token verification FAILED", {
      hasProvided: providedToken.length > 0,
      hasExpected: expectedToken.length > 0,
      ip: req.headers.get("x-forwarded-for") ?? "unknown",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.info("[WEBHOOK] Xendit token verification OK");
  return null;
}

// ============================================================
// MIDTRANS SIGNATURE VERIFICATION
// ============================================================

async function getMidtransServerKey(): Promise<string | null> {
  if (process.env.MIDTRANS_SERVER_KEY) return process.env.MIDTRANS_SERVER_KEY;
  try {
    const { getPaymentGatewayConfig } = await import("@/lib/settings");
    const config = await getPaymentGatewayConfig();
    return config?.midtrans?.server_key ?? null;
  } catch {
    return null;
  }
}

/**
 * Extracts the raw server key from request headers.
 * Midtrans sends it via `x-server-key` header or `Authorization: Basic <base64(server_key:)>`
 */
function extractServerKeyFromHeader(req: Request): string | null {
  const serverKeyHeader = req.headers.get("x-server-key");
  if (serverKeyHeader) return serverKeyHeader;

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("basic ")) {
    try {
      const base64 = authHeader.slice(6);
      const decoded = Buffer.from(base64, "base64").toString("utf-8");
      const [key] = decoded.split(":");
      if (key) return key;
    } catch {
      // ignore decode errors
    }
  }
  return null;
}

/**
 * Verifies the Midtrans webhook SHA512 signature.
 * Returns null if valid; returns an error NextResponse if invalid.
 */
export async function verifyMidtransSignature(req: Request, payload: any): Promise<NextResponse | null> {
  const serverKey = await getMidtransServerKey();
  const clientServerKey = extractServerKeyFromHeader(req);

  const orderId = payload?.order_id || payload?.transaction_details?.order_id;
  const statusCode = String(payload?.status_code ?? payload?.statusCode ?? "");
  const grossAmount = String(payload?.gross_amount ?? payload?.grossAmount ?? "0");

  if (!serverKey) {
    console.error("[WEBHOOK] Midtrans: no server key configured — rejecting webhook");
    return NextResponse.json({ error: "Server key not configured" }, { status: 401 });
  }

  // SHA512 signature: SHA512(order_id + status_code + gross_amount + server_key)
  const signatureKey = crypto
    .createHash("sha512")
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest("hex");

  const clientSignature = payload?.signature_key ?? clientServerKey ?? "";

  const isSignatureValid =
    clientSignature === signatureKey ||
    (!!clientServerKey && clientServerKey === serverKey);

  if (!isSignatureValid) {
    console.error("[WEBHOOK] Midtrans signature verification FAILED", {
      orderId,
      hasSignatureKey: !!payload?.signature_key,
      hasServerKey: !!clientServerKey,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.info("[WEBHOOK] Midtrans signature verified for order:", orderId);
  return null;
}

// ============================================================
// PAYMENT PROCESSING LOGIC
// ============================================================

/**
 * Process successful payment (shared by all gateways).
 * Idempotent — safe to call multiple times.
 * Uses FOR UPDATE row-level lock to prevent race conditions on concurrent retries.
 */
export async function processPaymentSuccess(transactionId: string) {
  console.log(`[WEBHOOK] Processing payment success for tx: ${transactionId}`);

  await withTransaction(async (client: Pool) => {
    // Atomic lock + read: prevents concurrent webhook retries from duplicating work
    const txRes = await client.query(
      `SELECT * FROM transactions WHERE id = $1 OR external_id = $1 FOR UPDATE`,
      [transactionId]
    );

    if (txRes.rows.length === 0) {
      console.warn(`[WEBHOOK] Transaction not found: ${transactionId}`);
      return;
    }

    const tx = txRes.rows[0];

    // Idempotency check — already processed, skip all side effects
    if (tx.status === "ACTIVATED" || tx.status === "PAID") {
      console.log(`[WEBHOOK] Transaction ${transactionId} already ${tx.status} — idempotent skip`);
      return;
    }

    const userId = tx.user_id;
    const planId = tx.plan_id;

    // Mark transaction as ACTIVATED
    await client.query(
      `UPDATE transactions SET status = 'ACTIVATED', updated_at = NOW() WHERE id = $1`,
      [tx.id]
    );

    // Get user details
    const userRes = await client.query("SELECT * FROM users WHERE id = $1", [userId]);
    const user = userRes.rows[0];

    if (!user) {
      console.error(`[WEBHOOK] User not found: ${userId}`);
      return;
    }

    // --- ADDON POIN PURCHASE ---
    if (planId?.startsWith("addon:")) {
      const addonId = planId.replace("addon:", "");
      const pkgRes = await client.query(
        "SELECT poin_amount FROM addon_token_packages WHERE id = $1",
        [addonId]
      );
      if (pkgRes.rows.length > 0) {
        const poinAmount = pkgRes.rows[0].poin_amount;
        await grantAddonPoin(userId, poinAmount);

        await sendInAppNotification(
          userId,
          "Poin Tambahan Aktif!",
          `Pembelian ${poinAmount} poin tambahan berhasil! Saldo poin Anda telah diperbarui.`,
          "payment_success",
          "addon_purchase",
          tx.id
        );

        console.log(`[WEBHOOK] Granted ${poinAmount} addon poin to user ${userId} (tx ACTIVATED)`);
      }
      return;
    }

    // --- SUBSCRIPTION PLAN ---
    let tokens = 0;
    let durationDays = 30;

    if (planId && planId !== "free") {
      const planRes = await client.query(
        "SELECT tokens, duration_days FROM pricing_plans WHERE id = $1 OR package_name = $1",
        [planId]
      );
      if (planRes.rows.length > 0) {
        tokens = planRes.rows[0].tokens || 0;
        durationDays = planRes.rows[0].duration_days || 30;
      }
    }

    // Calculate new subscription end date (accrual logic)
    const now = new Date();
    let newSubscriptionEnd: Date;

    if (user.subscription_end && new Date(user.subscription_end) > now) {
      newSubscriptionEnd = new Date(user.subscription_end);
      newSubscriptionEnd.setDate(newSubscriptionEnd.getDate() + durationDays);
    } else {
      newSubscriptionEnd = new Date();
      newSubscriptionEnd.setDate(newSubscriptionEnd.getDate() + durationDays);
    }

    // Update user subscription
    await client.query(
      `UPDATE users SET
         status_langganan = $1,
         subscription_status = 'active',
         subscription_end = $2,
         grace_period_ends_at = NULL,
         quota_poin_total = GREATEST(0, COALESCE(quota_poin_total, 0)) + $3,
         quota_poin_used = 0,
         last_expiry_warning_sent = NULL
       WHERE id = $4`,
      [planId || "free", newSubscriptionEnd, tokens, userId]
    );

    // Send in-app notification
    const formattedEndDate = newSubscriptionEnd.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    await sendInAppNotification(
      userId,
      "Pembayaran Berhasil!",
      `Paket langganan Anda telah aktif sampai ${formattedEndDate}. Total ${tokens} poin telah ditambahkan ke akun Anda.`,
      "payment_success",
      "subscription_activated",
      tx.id
    );

    console.log(
      `[WEBHOOK] User ${userId} subscription extended to ${newSubscriptionEnd.toISOString()}, tokens: ${tokens}`
    );
  });
}

/**
 * Process expired payment.
 */
export async function processPaymentExpired(transactionId: string) {
  console.log(`[WEBHOOK] Processing expired payment for tx: ${transactionId}`);
  await query(
    `UPDATE transactions SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1 OR external_id = $1`,
    [transactionId]
  );
}

/**
 * Process denied payment.
 */
export async function processPaymentDenied(transactionId: string) {
  console.log(`[WEBHOOK] Processing denied payment for tx: ${transactionId}`);
  await query(
    `UPDATE transactions SET status = 'DENIED', updated_at = NOW() WHERE id = $1 OR external_id = $1`,
    [transactionId]
  );
}

// ============================================================
// GATEWAY-SPECIFIC HANDLERS (used by all routes)
// ============================================================

/**
 * Xendit webhook handler.
 * Call this after verifying the Xendit signature.
 */
export async function handleXenditCallback(req: Request) {
  try {
    const payload = await req.text();
    const data = JSON.parse(payload);
    console.log("[WEBHOOK] Xendit callback received:", data);

    if (data.status === "PAID" || data.status === "SETTLED") {
      const existingTx = await query(
        "SELECT status FROM transactions WHERE external_id = $1",
        [data.external_id]
      );
      if (existingTx.rows.length > 0) {
        const existingStatus = existingTx.rows[0].status;
        if (existingStatus === "PAID" || existingStatus === "ACTIVATED") {
          console.log(`[WEBHOOK] Xendit tx ${data.external_id} already ${existingStatus} — idempotent skip`);
          return NextResponse.json({ success: true, idempotent: true });
        }
      }
      await processPaymentSuccess(data.external_id);
      return NextResponse.json({ success: true });
    }

    if (data.status === "EXPIRED") {
      await processPaymentExpired(data.external_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[WEBHOOK] Xendit callback error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Midtrans webhook handler.
 * Call this after verifying the Midtrans signature.
 */
export async function handleMidtransCallback(req: Request) {
  try {
    const data = await req.json();
    console.log("[WEBHOOK] Midtrans callback received:", data);

    const transactionStatus = data.transaction_status;
    const orderId = data.order_id;

    if (transactionStatus === "settlement" || transactionStatus === "capture" || transactionStatus === "success") {
      const existingTx = await query(
        "SELECT status FROM transactions WHERE id = $1 OR external_id = $1",
        [orderId]
      );
      if (existingTx.rows.length > 0) {
        const existingStatus = existingTx.rows[0].status;
        if (existingStatus === "PAID" || existingStatus === "ACTIVATED") {
          console.log(`[WEBHOOK] Midtrans tx ${orderId} already ${existingStatus} — idempotent skip`);
          return NextResponse.json({ success: true, idempotent: true });
        }
      }
      await processPaymentSuccess(orderId);
      return NextResponse.json({ success: true });
    }

    if (transactionStatus === "expire") {
      await processPaymentExpired(orderId);
      return NextResponse.json({ success: true });
    }

    if (transactionStatus === "deny") {
      await processPaymentDenied(orderId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[WEBHOOK] Midtrans callback error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Duitku webhook handler.
 */
export async function handleDuitkuCallback(req: Request) {
  try {
    const data = await req.json();
    console.log("[WEBHOOK] Duitku callback received:", data);

    const statusCode = data.statusCode;
    const merchantOrderId = data.merchantOrderId;

    if (statusCode === "00") {
      const existingTx = await query(
        "SELECT status FROM transactions WHERE id = $1 OR external_id = $1",
        [merchantOrderId]
      );
      if (existingTx.rows.length > 0) {
        const existingStatus = existingTx.rows[0].status;
        if (existingStatus === "PAID" || existingStatus === "ACTIVATED") {
          console.log(`[WEBHOOK] Duitku tx ${merchantOrderId} already ${existingStatus} — idempotent skip`);
          return NextResponse.json({ success: true, idempotent: true });
        }
      }
      await processPaymentSuccess(merchantOrderId);
      return NextResponse.json({ success: true });
    }

    if (statusCode === "02" || statusCode === "03") {
      // Expired or pending — no action needed
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[WEBHOOK] Duitku callback error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
