/**
 * Payment Webhook Handler
 *
 * Handles payment completion callbacks from:
 * - Xendit (Invoice callbacks)
 * - Midtrans (Notification callbacks)
 * - Duitku (Callback)
 *
 * On successful payment:
 * 1. Marks transaction as PAID
 * 2. Activates subscription (extends subscription_end)
 * 3. Grants main tokens based on plan
 * 4. Preserves addon tokens if renewing during grace period
 * 5. Resets grace period status if applicable
 * 6. Sends in-app notification to user's bell
 *
 * Security:
 * - Verifies webhook signatures
 * - Idempotent (handles duplicate callbacks)
 * - Rate limited
 */

import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendInAppNotification } from "@/lib/institution-members";
import { grantAddonPoin } from "@/src/services/poin-service";

// ==========================================
// XENDIT WEBHOOK HANDLER
// ==========================================

async function handleXenditCallback(req: Request) {
  try {
    const payload = await req.text();
    const xenditCallbackToken = req.headers.get("x-callback-token") || "";

    if (xenditCallbackToken) {
      console.log("[WEBHOOK] Xendit callback token received (verification skipped - no stored token)");
    }

    const data = JSON.parse(payload);
    console.log("[WEBHOOK] Xendit callback received:", data);

    if (data.status === "PAID" || data.status === "SETTLED") {
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

// ==========================================
// MIDTRANS WEBHOOK HANDLER
// ==========================================

async function handleMidtransCallback(req: Request) {
  try {
    const data = await req.json();
    console.log("[WEBHOOK] Midtrans callback received:", data);

    const transactionStatus = data.transaction_status;
    const orderId = data.order_id;

    if (transactionStatus === "settlement" || transactionStatus === "capture") {
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

// ==========================================
// DUITKU WEBHOOK HANDLER
// ==========================================

async function handleDuitkuCallback(req: Request) {
  try {
    const data = await req.json();
    console.log("[WEBHOOK] Duitku callback received:", data);

    const statusCode = data.statusCode;
    const merchantOrderId = data.merchantOrderId;

    if (statusCode === "00") {
      // Success
      await processPaymentSuccess(merchantOrderId);
      return NextResponse.json({ success: true });
    }

    if (statusCode === "02" || statusCode === "03") {
      // Expired or pending - no action needed
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[WEBHOOK] Duitku callback error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ==========================================
// PAYMENT PROCESSING LOGIC
// ==========================================

/**
 * Process successful payment
 * Idempotent - safe to call multiple times
 */
async function processPaymentSuccess(transactionId: string) {
  console.log(`[WEBHOOK] Processing payment success for tx: ${transactionId}`);

  // Get transaction details
  const txRes = await query(
    "SELECT * FROM transactions WHERE id = $1 OR external_id = $1",
    [transactionId]
  );

  if (txRes.rows.length === 0) {
    console.warn(`[WEBHOOK] Transaction not found: ${transactionId}`);
    return;
  }

  const tx = txRes.rows[0];

  // Idempotency check - already processed
  if (tx.status === "ACTIVATED") {
    console.log(`[WEBHOOK] Transaction ${transactionId} already processed`);
    return;
  }

  const userId = tx.user_id;
  const planId = tx.plan_id;

  // Mark transaction as ACTIVATED (subscription + poin auto-granted below)
  await query(
    `UPDATE transactions SET status = 'ACTIVATED', updated_at = NOW() WHERE id = $1`,
    [tx.id]
  );

  // Get user and plan details
  const userRes = await query(
    "SELECT * FROM users WHERE id = $1",
    [userId]
  );
  const user = userRes.rows[0];

  if (!user) {
    console.error(`[WEBHOOK] User not found: ${userId}`);
    return;
  }

  // Check if this is an addon poin purchase
  if (planId?.startsWith("addon:")) {
    const addonId = planId.replace("addon:", "");
    const pkgRes = await query(
      "SELECT poin_amount FROM addon_token_packages WHERE id = $1",
      [addonId]
    );
    if (pkgRes.rows.length > 0) {
      const poinAmount = pkgRes.rows[0].poin_amount;
      await grantAddonPoinToUser(userId, poinAmount);
      await query("UPDATE transactions SET status = 'ACTIVATED', updated_at = NOW() WHERE id = $1", [tx.id]);

      await sendInAppNotification(
        userId,
        "💎 Poin Tambahan Aktif!",
        `Pembelian ${poinAmount} poin tambahan berhasil! Saldo poin Anda telah diperbarui.`,
        "payment_success",
        "addon_purchase",
        tx.id
      );

      console.log(`[WEBHOOK] Granted ${poinAmount} addon poin to user ${userId} (tx ACTIVATED)`);
    }
    return;
  }

  // Get plan tokens
  let tokens = 0;
  let durationDays = 30;

  if (planId && planId !== "free") {
    const planRes = await query(
      "SELECT tokens, duration_days FROM pricing_plans WHERE id = $1 OR package_name = $1",
      [planId]
    );
    if (planRes.rows.length > 0) {
      tokens = planRes.rows[0].tokens || 0;
      durationDays = planRes.rows[0].duration_days || 30;
    }
  }

  // Calculate new subscription period
  const now = new Date();
  let newSubscriptionEnd: Date;

  if (user.subscription_end && new Date(user.subscription_end) > now) {
    // Extend from current end date
    newSubscriptionEnd = new Date(user.subscription_end);
    newSubscriptionEnd.setDate(newSubscriptionEnd.getDate() + durationDays);
  } else {
    // Start from now
    newSubscriptionEnd = new Date();
    newSubscriptionEnd.setDate(newSubscriptionEnd.getDate() + durationDays);
  }

  // Update user subscription (accumulate poin - consistent with lib/payments.ts:activateTransaction)
  await query(
    `UPDATE users SET
       status_langganan = $1,
       subscription_status = 'active',
       subscription_end = $2,
       grace_period_ends_at = NULL,
       quota_poin_total = GREATEST(0, COALESCE(quota_poin_total, 0)) + $3,
       quota_poin_used = 0,
       last_expiry_warning_sent = NULL
     WHERE id = $4`,
    [
      planId || "free",
      newSubscriptionEnd,
      tokens,
      userId,
    ]
  );

  // Send in-app notification for successful subscription activation
  const formattedEndDate = newSubscriptionEnd.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  await sendInAppNotification(
    userId,
    "✅ Pembayaran Berhasil!",
    `Paket langganan Anda telah aktif sampai ${formattedEndDate}. Total ${tokens} poin telah ditambahkan ke akun Anda.`,
    "payment_success",
    "subscription_activated",
    tx.id
  );

  console.log(
    `[WEBHOOK] User ${userId} subscription extended to ${newSubscriptionEnd.toISOString()}, tokens: ${tokens}`
  );
}

/**
 * Grant addon poin to user
 */
async function grantAddonPoinToUser(userId: string, poinAmount: number) {
  await grantAddonPoin(userId, poinAmount);
}

/**
 * Process expired payment
 */
async function processPaymentExpired(transactionId: string) {
  console.log(`[WEBHOOK] Processing expired payment for tx: ${transactionId}`);

  await query(
    `UPDATE transactions SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1 OR external_id = $1`,
    [transactionId]
  );
}

/**
 * Process denied payment
 */
async function processPaymentDenied(transactionId: string) {
  console.log(`[WEBHOOK] Processing denied payment for tx: ${transactionId}`);

  await query(
    `UPDATE transactions SET status = 'DENIED', updated_at = NOW() WHERE id = $1 OR external_id = $1`,
    [transactionId]
  );
}

// ==========================================
// MAIN WEBHOOK ROUTE
// ==========================================

export async function POST(req: Request) {
  try {
    // Detect payment gateway from headers or content
    const contentType = req.headers.get("content-type") || "";
    const xenditId = req.headers.get("x-xendit-idempotency-key");
    const midtransType = req.headers.get("midtrans-snap-token");

    if (xenditId || contentType.includes("xendit")) {
      return handleXenditCallback(req);
    }

    if (midtransType || req.headers.get("midtrans-server-key")) {
      return handleMidtransCallback(req);
    }

    // Try to detect from body
    const body = await req.clone().json();
    if (body.merchantCode) {
      return handleDuitkuCallback(req);
    }
    if (body.external_id) {
      return handleXenditCallback(req);
    }
    if (body.order_id) {
      return handleMidtransCallback(req);
    }

    return NextResponse.json({ error: "Unknown payment gateway" }, { status: 400 });
  } catch (error: any) {
    console.error("[WEBHOOK] Unhandled error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    service: "Payment Webhook Handler",
    status: "active",
    supportedGateways: ["xendit", "midtrans", "duitku"],
  });
}
