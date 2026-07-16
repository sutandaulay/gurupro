/**
 * Token System Cron Jobs
 *
 * Handles:
 * 1. Monthly token reset - resets mainTokenBalance based on tier's monthlyTokenQuota
 * 2. Grace period enforcement - transitions users through grace_period -> locked states
 *
 * Usage:
 *   npx tsx scripts/token-jobs.ts [all|monthly|daily]
 *
 * For Vercel Cron:
 *   Add to vercel.json:
 *   { "cron": "0 0 * * *", "path": "/api/cron/token-jobs" }
 *
 * For production cron (node server):
 *   - Run daily to enforce grace periods
 *   - Run monthly to reset tokens (or daily with per-user reset tracking)
 */

import { pool, query } from "@/lib/db";

// Get app URL with fallback
function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://gurupro.id";
  return appUrl.replace(/\/$/, "");
}
import { sendWhatsAppNotification, sendEmailNotification } from "../lib/notifications";

const DEFAULT_GRACE_PERIOD_DAYS = 7;

interface UserTierInfo {
  statusLangganan: string;
  gracePeriodDays: number;
}

/**
 * Get grace period days for a user's tier
 * Reads from pricing_plans table's grace_period_days column
 */
async function getGracePeriodDaysForUser(statusLangganan: string): Promise<number> {
  // Try to find grace period from pricing_plans
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  try {
    if (uuidRegex.test(statusLangganan)) {
      const res = await query(
        "SELECT grace_period_days FROM pricing_plans WHERE id = $1",
        [statusLangganan]
      );
      if (res.rows.length > 0 && res.rows[0].grace_period_days != null) {
        return res.rows[0].grace_period_days;
      }
    } else {
      // Try by package_name
      const res = await query(
        "SELECT grace_period_days FROM pricing_plans WHERE package_name = $1 AND is_active = true LIMIT 1",
        [statusLangganan]
      );
      if (res.rows.length > 0 && res.rows[0].grace_period_days != null) {
        return res.rows[0].grace_period_days;
      }
    }
  } catch (e) {
    console.warn("Could not read grace_period_days from pricing_plans:", e);
  }

  // Fallback to default
  return DEFAULT_GRACE_PERIOD_DAYS;
}

/**
 * Reset monthly tokens for all active subscribers
 *
 * Rules:
 * - Only resets mainTokenBalance (token_limit)
 * - Does NOT touch addonTokenBalance
 * - Uses mainTokenResetDate per-user for accurate monthly cycles
 * - Reads monthlyTokenQuota from user's tier (pricing_plans)
 */
export async function resetMonthlyTokens(): Promise<{ processed: number; errors: number }> {
  console.log("[CRON] Starting monthly token reset...");

  const result = { processed: 0, errors: 0 };

  try {
    // Select users with active subscription who need monthly token reset
    const usersRes = await query(`
      SELECT
        u.id as user_id,
        u.status_langganan,
        u.main_token_reset_date,
        u.token_limit as current_main_balance,
        u.addon_token_balance,
        u.subscription_start,
        u.subscription_end,
        u.is_active,
        u.subscription_status
      FROM users u
      WHERE u.is_active = true
        AND u.status_langganan IS NOT NULL
        AND u.status_langganan != 'free'
        AND (u.subscription_status = 'active' OR u.subscription_status IS NULL)
        AND (u.subscription_end IS NULL OR u.subscription_end > NOW())
        AND (
          u.main_token_reset_date IS NULL
          OR u.main_token_reset_date <= NOW()
        )
    `);

    console.log(`[CRON] Found ${usersRes.rows.length} users needing token reset`);

    for (const user of usersRes.rows) {
      try {
        const userId = user.user_id;
        const planKey = user.status_langganan;

        if (!planKey) {
          console.warn(`[CRON] User ${userId} has no status_langganan, skipping`);
          continue;
        }

        // Get quota from pricing_plans
        let quota = 0;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (uuidRegex.test(planKey)) {
          const planRes = await query(
            "SELECT tokens FROM pricing_plans WHERE id = $1 AND is_active = true",
            [planKey]
          );
          if (planRes.rows.length > 0) {
            quota = Number(planRes.rows[0].tokens || 0);
          }
        } else {
          const planRes = await query(
            "SELECT tokens FROM pricing_plans WHERE package_name = $1 AND is_active = true LIMIT 1",
            [planKey]
          );
          if (planRes.rows.length > 0) {
            quota = Number(planRes.rows[0].tokens || 0);
          }
        }

        if (quota <= 0) {
          console.warn(`[CRON] User ${userId} has no quota for plan ${planKey}, skipping`);
          continue;
        }

        // Reset every 30 days (monthly)
        const nextResetDate = new Date();
        nextResetDate.setDate(nextResetDate.getDate() + 30);

        // Update user's main token balance to full quota
        // NOTE: addon_token_balance is NOT touched - it carries over
        await query(
          `UPDATE users
           SET token_limit = $1,
               main_token_reset_date = $2
           WHERE id = $3`,
          [quota, nextResetDate, userId]
        );

        console.log(
          `[CRON] Reset tokens for user ${userId}: ${user.current_main_balance} → ${quota} (addon preserved: ${user.addon_token_balance}, next reset: ${nextResetDate.toISOString().split('T')[0]})`
        );
        result.processed++;
      } catch (err: any) {
        console.error(`[CRON] Failed to reset tokens for user ${user.user_id}:`, err.message);
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error("[CRON] Monthly token reset failed:", err.message);
    throw err;
  }

  console.log(`[CRON] Monthly token reset completed: ${result.processed} processed, ${result.errors} errors`);
  return result;
}

/**
 * Enforce grace periods - runs daily
 *
 * Transitions:
 * 1. active → grace_period (when subscription ends)
 * 2. grace_period → locked (when grace period expires)
 *
 * When locked:
 * - subscription_status = 'locked'
 * - addon_token_balance = 0 (token eceran hangus)
 */
/**
 * Check and send warnings (WhatsApp & Email) for users whose subscriptions end in 3 days or 1 day.
 */
export async function sendSubscriptionWarnings(): Promise<{ sent: number; errors: number }> {
  console.log("[CRON] Checking for approaching subscription expirations...");
  const result = { sent: 0, errors: 0 };
  const appUrl = getAppUrl();

  try {
    const usersRes = await query(`
      SELECT
        id,
        email,
        whatsapp,
        nama_lengkap,
        subscription_end,
        last_expiry_warning_sent
      FROM users
      WHERE is_active = true
        AND status_langganan IS NOT NULL
        AND status_langganan != 'free'
        AND (subscription_status = 'active' OR subscription_status IS NULL)
        AND subscription_end > NOW()
        AND subscription_end <= NOW() + INTERVAL '3 days'
    `);

    console.log(`[CRON] Found ${usersRes.rows.length} users with ending subscriptions in 3-day window`);

    for (const user of usersRes.rows) {
      try {
        const now = new Date();
        const subEnd = new Date(user.subscription_end);
        const msDiff = subEnd.getTime() - now.getTime();
        const hoursRemaining = msDiff / (1000 * 60 * 60);

        let warningLevel: "h1" | "h3" | null = null;

        if (hoursRemaining <= 24) {
          if (user.last_expiry_warning_sent !== "h1") {
            warningLevel = "h1";
          }
        } else if (hoursRemaining <= 72) {
          if (user.last_expiry_warning_sent !== "h3" && user.last_expiry_warning_sent !== "h1") {
            warningLevel = "h3";
          }
        }

        if (!warningLevel) {
          continue; // Warning already sent for this level or not within timeframe
        }

        const daysLeftText = warningLevel === "h1" ? "1 hari" : "3 hari";
        const formattedEndDate = subEnd.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        // 1. Send WhatsApp Notification
        if (user.whatsapp) {
          const waMessage = `[PENTING] Masa Langganan GuruPRO Segera Berakhir!

Yth. Guru *${user.nama_lengkap}*,

Masa aktif paket berlangganan GuruPRO Anda akan berakhir dalam *${daysLeftText}* (pada *${formattedEndDate}*).

Silakan lakukan perpanjangan paket melalui halaman Billing akun Anda untuk tetap menggunakan generator AI GuruPRO tanpa terputus.

Perpanjang di: ${appUrl}/dashboard/billing`;

          await sendWhatsAppNotification(user.whatsapp, waMessage);
        }

        // 2. Send Email Notification
        if (user.email) {
          const emailSubject = `[PENTING] Masa Langganan GuruPRO Anda Segera Berakhir dalam ${daysLeftText}`;
          const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #4f46e5; margin-bottom: 16px;">Masa Langganan Segera Berakhir</h2>
              <p>Yth. Guru <strong>${user.nama_lengkap}</strong>,</p>
              <p>Kami ingin menginformasikan bahwa masa aktif paket berlangganan GuruPRO Anda akan berakhir dalam <strong>${daysLeftText}</strong> (pada <strong>${formattedEndDate}</strong>).</p>
              <p>Untuk tetap dapat menikmati akses tanpa batas ke semua generator AI (Modul Ajar, Silabus, LKPD, Soal, dll.) serta menghindari reset kuota token utama Anda, silakan lakukan perpanjangan paket sekarang.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/dashboard/billing" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Perpanjang Langganan Sekarang
                </a>
              </div>
              <p style="color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Abaikan email ini jika Anda sudah melakukan perpanjangan.
              </p>
            </div>
          `;

          await sendEmailNotification(user.email, emailSubject, emailHtml);
        }

        // Update database that warning has been sent
        await query(
          "UPDATE users SET last_expiry_warning_sent = $1 WHERE id = $2",
          [warningLevel, user.id]
        );

        console.log(`[CRON] Subscription warning (${warningLevel}) sent to ${user.nama_lengkap} (${user.email})`);
        result.sent++;
      } catch (err: any) {
        console.error(`[CRON] Failed to send subscription warning to user ${user.id}:`, err.message);
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error("[CRON] Subscription warning check failed:", err.message);
  }

  return result;
}

export async function enforceGracePeriods(): Promise<{ graceEntered: number; locked: number }> {
  console.log("[CRON] Starting grace period enforcement...");

  // Send warnings to users whose subscriptions are ending soon
  await sendSubscriptionWarnings();

  const result = { graceEntered: 0, locked: 0 };

  try {
    // Step 1: Move expired subscriptions into grace period
    // For each user, get their tier's grace_period_days
    const expiredRes = await query(`
      SELECT
        u.id as user_id,
        u.status_langganan,
        u.subscription_end,
        u.grace_period_ends_at,
        u.subscription_status
      FROM users u
      WHERE u.is_active = true
        AND u.subscription_end IS NOT NULL
        AND u.subscription_end < NOW()
        AND u.subscription_status NOT IN ('locked', 'grace_period')
    `);

    console.log(`[CRON] Found ${expiredRes.rows.length} subscriptions needing grace period`);

    for (const user of expiredRes.rows) {
      try {
        const gracePeriodDays = await getGracePeriodDaysForUser(user.status_langganan);
        const graceEndsAt = new Date(user.subscription_end);
        graceEndsAt.setDate(graceEndsAt.getDate() + gracePeriodDays);

        await query(
          `UPDATE users
           SET subscription_status = 'grace_period',
               grace_period_ends_at = $1
           WHERE id = $2`,
          [graceEndsAt, user.user_id]
        );

        console.log(
          `[CRON] User ${user.user_id} entered grace period until ${graceEndsAt.toISOString().split('T')[0]} (${gracePeriodDays} days)`
        );
        result.graceEntered++;
      } catch (err: any) {
        console.error(`[CRON] Failed to set grace period for user ${user.user_id}:`, err.message);
      }
    }

    // Step 2: Lock users whose grace period has expired
    const lockRes = await query(`
      SELECT
        u.id as user_id,
        u.subscription_status,
        u.grace_period_ends_at,
        u.addon_token_balance
      FROM users u
      WHERE u.subscription_status = 'grace_period'
        AND u.grace_period_ends_at IS NOT NULL
        AND u.grace_period_ends_at < NOW()
    `);

    console.log(`[CRON] Found ${lockRes.rows.length} grace periods expiring`);

    for (const user of lockRes.rows) {
      try {
        // Lock user — addon tokens are PRESERVED (user can use them after renewing)
        await query(
          `UPDATE users
           SET subscription_status = 'locked',
               grace_period_ends_at = NULL
           WHERE id = $1`,
          [user.user_id]
        );

        console.log(
          `[CRON] User ${user.user_id} LOCKED - addon tokens preserved (${user.addon_token_balance})`
        );
        result.locked++;
      } catch (err: any) {
        console.error(`[CRON] Failed to lock user ${user.user_id}:`, err.message);
      }
    }

    // Step 3: Extend grace period for users who renew during grace period
    // (handled in payment webhook when subscription is extended)

  } catch (err: any) {
    console.error("[CRON] Grace period enforcement failed:", err.message);
    throw err;
  }

  console.log(`[CRON] Grace period enforcement completed: ${result.graceEntered} entered grace, ${result.locked} locked`);
  return result;
}

/**
 * Main entry point for CLI usage
 */
async function main() {
  try {
    const arg = process.argv[2];

    if (!arg || arg === "all") {
      console.log("[CRON] Running all token jobs...");
      await resetMonthlyTokens();
      await enforceGracePeriods();
    } else if (arg === "monthly") {
      await resetMonthlyTokens();
    } else if (arg === "daily") {
      await enforceGracePeriods();
    } else {
      console.log("Usage: npx tsx scripts/token-jobs.ts [all|monthly|daily]");
      console.log("  all    - Run both monthly reset and daily grace period checks (default)");
      console.log("  monthly - Run token reset only");
      console.log("  daily  - Run grace period enforcement only");
    }
  } catch (err: any) {
    console.error("[CRON] Token jobs failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Export for programmatic use
export { main as runTokenJobs };

// Run if called directly
if (require.main === module) {
  main();
}
