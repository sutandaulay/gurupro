import { query } from "./db";
import { sendEventNotification } from "./notifications";
import { getPricingConfig } from "./settings";

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
  const pricingConfig = await getPricingConfig();
  
  let planDetails = (pricingConfig as any)[planKey];
  if (!planDetails) {
    const amount = Number(transaction.amount);
    if (amount >= 400000) {
      planDetails = pricingConfig.one_year;
    } else if (amount >= 220000) {
      planDetails = pricingConfig.six_month;
    } else {
      planDetails = pricingConfig.three_month;
    }
  }

  const tokensToAdd = planDetails.tokens;
  const durationDays = planDetails.duration_days;
  const planName = planKey === "three_month" ? "3 Bulan" : planKey === "six_month" ? "6 Bulan" : planKey === "one_year" ? "1 Tahun" : "Free";

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
         subscription_start = COALESCE($3, NOW()),
         subscription_end = $4
     WHERE id = $5`,
    [tokensToAdd, planKey, currentStart, newEnd, userId]
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
