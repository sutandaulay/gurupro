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
export async function enforceGracePeriods(): Promise<{ graceEntered: number; locked: number }> {
  console.log("[CRON] Starting grace period enforcement...");

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
