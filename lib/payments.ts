import { query } from "./db";
import { sendEventNotification } from "./notifications";

/**
 * Get plan details from pricing_plans table (source of truth managed via Admin Dashboard)
 */
async function getPlanDetails(planKey: string) {
  // Try to find by id (UUID) or package_name (legacy key)
  const res = await query(
    `SELECT id, package_name, tokens, duration_days, price
     FROM pricing_plans
     WHERE (id = $1 OR LOWER(package_name) = LOWER($1))
       AND is_active = true
     LIMIT 1`,
    [planKey]
  );
  if (res.rows.length > 0) return res.rows[0];
  return null;
}

/**
 * Automatically activates a subscription transaction.
 * Upgrades user subscription, adds tokens, writes audit logs, and sends alert notifications.
 */
export async function activateTransaction(transactionId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const txRes = await query("SELECT * FROM transactions WHERE id = $1", [transactionId]);
  if (txRes.rows.length === 0) {
    throw new Error(`Transaksi ID ${transactionId} tidak ditemukan`);
  }
  const transaction = txRes.rows[0];

  if (transaction.status === "ACTIVATED") {
    return { success: true, message: "Transaksi sudah aktif." };
  }

  const userId = transaction.user_id;
  const planKey = transaction.plan_id || "three_month";
  
  // Lookup plan from pricing_plans table (Admin Dashboard source of truth)
  let plan = await getPlanDetails(planKey);

  // Fallback: try to find by amount if planKey not matched
  if (!plan) {
    const amount = Number(transaction.amount);
    const amountPlan = await query(
      `SELECT id, package_name, tokens, duration_days, price
       FROM pricing_plans
       WHERE is_active = true
       ORDER BY ABS(price - $1) ASC
       LIMIT 1`,
      [amount]
    );
    if (amountPlan.rows.length > 0) {
      plan = amountPlan.rows[0];
    }
  }

  // Final fallback: hardcoded defaults (shouldn't happen if pricing_plans has data)
  if (!plan) {
    if (Number(transaction.amount) >= 400000) {
      plan = { id: "one_year", package_name: "1 Tahun", tokens: 2500, duration_days: 365, price: 400000 };
    } else if (Number(transaction.amount) >= 220000) {
      plan = { id: "six_month", package_name: "6 Bulan", tokens: 1100, duration_days: 180, price: 220000 };
    } else {
      plan = { id: "three_month", package_name: "3 Bulan", tokens: 500, duration_days: 90, price: 120000 };
    }
  }

  const tokensToAdd = Number(plan.tokens || 0);
  const durationDays = Number(plan.duration_days || 30);
  const planName = plan.package_name || plan.id;
  const newPlanKey = plan.id; // Use the actual pricing_plans ID as the status_langganan

  // Calculate new subscription end date (accrual logic)
  const userDateRes = await query("SELECT subscription_end, subscription_start FROM users WHERE id = $1", [userId]);
  let newEnd = new Date();
  const currentEnd = userDateRes.rows[0]?.subscription_end;
  const currentStart = userDateRes.rows[0]?.subscription_start;

  if (currentEnd && new Date(currentEnd) > new Date()) {
    newEnd = new Date(currentEnd);
  }
  newEnd.setDate(newEnd.getDate() + durationDays);

  // Update user's token limit, status, and subscription dates
  await query(
    `UPDATE users 
     SET token_limit = COALESCE(token_limit, 0) + $1, 
         status_langganan = $2,
         subscription_status = 'active',
         subscription_start = COALESCE($3, NOW()),
         subscription_end = $4,
         grace_period_ends_at = NULL,
         last_expiry_warning_sent = NULL
     WHERE id = $5`,
    [tokensToAdd, newPlanKey, currentStart, newEnd, userId]
  );

  // Update transaction status to ACTIVATED
  await query("UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2", ["ACTIVATED", transactionId]);

  // Log audit trail
  await query(
    `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [userId, "Aktivasi Paket", `Aktivasi paket ${planName} (+${tokensToAdd} Token) secara otomatis`, "127.0.0.1"]
  );

  // Send notification
  const userRes = await query("SELECT email, whatsapp, nama_lengkap FROM users WHERE id = $1", [userId]);
  if (userRes.rows.length > 0) {
    const user = userRes.rows[0];
    await sendEventNotification("payment_success", user, {
      amount: Number(transaction.amount).toLocaleString("id-ID"),
      plan_name: `GuruPRO Premium ${planName}`,
      payment_method: transaction.payment_method || "Online Payment",
      tokens_added: tokensToAdd
    });
  }

  return { success: true, message: "Transaksi berhasil diaktifkan." };
}

/**
 * Shared service to process successful subscription payments.
 * Awards tokens, upgrades user to PRO, logs transactions, and dispatches notifications.
 */
export async function processSuccessPayment(
  externalId: string,
  paymentMethod: string,
  amountPaid: number,
  isMock: boolean = false
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    let transaction;

    // 1. Find transaction in database
    if (isMock && externalId.length === 36) {
      const txRes = await query("SELECT * FROM transactions WHERE id = $1", [externalId]);
      if (txRes.rows.length === 0) {
        throw new Error(`Transaksi Mock ID ${externalId} tidak ditemukan`);
      }
      transaction = txRes.rows[0];
    } else {
      const txRes = await query("SELECT * FROM transactions WHERE external_id = $1", [externalId]);
      if (txRes.rows.length === 0) {
        throw new Error(`Transaksi dengan external_id ${externalId} tidak ditemukan`);
      }
      transaction = txRes.rows[0];
    }

    // 2. Check if already processed
    if (transaction.status === "ACTIVATED") {
      return { success: true, message: "Transaksi sudah aktif." };
    }

    // Update payment method first
    await query(
      "UPDATE transactions SET payment_method = $1 WHERE id = $2",
      [paymentMethod, transaction.id]
    );

    // 3. Automatically activate the package instantly!
    return await activateTransaction(transaction.id);
  } catch (error: any) {
    console.error("Error in processSuccessPayment:", error);
    return { success: false, error: error.message };
  }
}
