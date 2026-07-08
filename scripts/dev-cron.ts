/**
 * Dev Cron Script
 *
 * Runs token cron jobs alongside npm run dev
 * For testing purposes only - DO NOT use in production
 *
 * Usage:
 *   npm run dev:cron
 *   npm run dev:cron:once   (run cron once then exit)
 */

import { pool } from "../lib/db";
import { resetMonthlyTokens, enforceGracePeriods } from "./token-jobs";
import { runScheduledNotifications } from "./notification-jobs";

const args = process.argv.slice(2);
const mode = args[0] || "watch";

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  gray: "\x1b[90m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
  console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors[color]}${message}${colors.reset}`);
}

// Parse cron expression: "0 0 * * *" = midnight every day
// For dev, we run every 60 seconds
const DEV_INTERVAL_MS = 60 * 1000; // 1 minute for testing

async function runOnce() {
  log("Running token cron jobs (once mode)...", "blue");

  try {
    log("Starting monthly token reset...", "yellow");
    const monthlyResult = await resetMonthlyTokens();
    log(`Monthly reset completed: ${monthlyResult.processed} processed, ${monthlyResult.errors} errors`, "green");

    log("Starting grace period enforcement...", "yellow");
    const graceResult = await enforceGracePeriods();
    log(`Grace period enforcement: ${graceResult.graceEntered} entered grace, ${graceResult.locked} locked`, "green");

    log("Starting scheduled notifications...", "yellow");
    const notifyResult = await runScheduledNotifications();
    log(`Scheduled notifications: ${notifyResult.sent} sent, ${notifyResult.skipped} skipped, ${notifyResult.errors} errors`, "green");

    log("All cron jobs completed successfully!", "green");
  } catch (error: any) {
    log(`Cron job failed: ${error.message}`, "red");
    console.error(error);
  } finally {
    await pool.end();
  }
}

async function runWatch() {
  log("Starting DEV cron watcher...", "blue");
  log(`Interval: every ${DEV_INTERVAL_MS / 1000} seconds (configurable for testing)`, "gray");
  log("Press Ctrl+C to stop", "gray");
  console.log();

  // Run immediately on start
  await runOnce();

  // Then run on interval
  setInterval(async () => {
    log("--- Tick ---", "gray");
    await runOnce();
  }, DEV_INTERVAL_MS);
}

// Special dev mode: Simulate specific scenarios
async function runScenario(scenario: string) {
  log(`Running dev scenario: ${scenario}`, "blue");

  const { query } = await import("../lib/db");

  switch (scenario) {
    case "expire-subscription":
      // Expire a test user's subscription
      const userId = args[1];
      if (!userId) {
        log("Usage: npm run dev:cron:scenario expire-subscription <user-id>", "yellow");
        process.exit(1);
      }
      await query(`
        UPDATE users
        SET subscription_end = NOW() - INTERVAL '1 day',
            subscription_status = 'active'
        WHERE id = $1
      `, [userId]);
      log(`Expired subscription for user ${userId}`, "green");
      break;

    case "expire-grace":
      // Expire grace period for a test user
      const graceUserId = args[1];
      if (!graceUserId) {
        log("Usage: npm run dev:cron:scenario expire-grace <user-id>", "yellow");
        process.exit(1);
      }
      await query(`
        UPDATE users
        SET subscription_status = 'grace_period',
            grace_period_ends_at = NOW() - INTERVAL '1 hour',
            addon_token_balance = 50
        WHERE id = $1
      `, [graceUserId]);
      log(`Set user ${graceUserId} to grace period (will be locked by cron)`, "green");
      break;

    case "reset-tokens":
      // Force reset tokens for a test user
      const resetUserId = args[1];
      if (!resetUserId) {
        log("Usage: npm run dev:cron:scenario reset-tokens <user-id>", "yellow");
        process.exit(1);
      }
      await query(`
        UPDATE users
        SET token_limit = 0,
            main_token_reset_date = NOW() - INTERVAL '31 days'
        WHERE id = $1
      `, [resetUserId]);
      log(`Set user ${resetUserId} for token reset on next cron run`, "green");
      break;

    case "status":
      // Show current status of all test scenarios
      const users = await query(`
        SELECT id, nama_lengkap, status_langganan, subscription_status,
               subscription_end, grace_period_ends_at,
               token_limit, addon_token_balance, main_token_reset_date
        FROM users
        WHERE role = 'guru'
        LIMIT 10
      `);
      console.log("\n📊 User Token Status:");
      console.table(users.rows.map((u: any) => ({
        id: u.id?.slice(0, 8) + "...",
        name: u.nama_lengkap?.slice(0, 15),
        status: u.subscription_status,
        subEnd: u.subscription_end ? new Date(u.subscription_end).toISOString().split("T")[0] : "null",
        graceEnd: u.grace_period_ends_at ? new Date(u.grace_period_ends_at).toISOString().split("T")[0] : "null",
        mainTokens: u.token_limit,
        addonTokens: u.addon_token_balance,
        resetDate: u.main_token_reset_date ? new Date(u.main_token_reset_date).toISOString().split("T")[0] : "null",
      })));
      break;

    default:
      log(`Unknown scenario: ${scenario}`, "red");
      log("Available scenarios:", "yellow");
      log("  expire-subscription <user-id>  - Set subscription to expired", "gray");
      log("  expire-grace <user-id>         - Set to grace period (will expire)", "gray");
      log("  reset-tokens <user-id>         - Set tokens for monthly reset", "gray");
      log("  status                         - Show current user statuses", "gray");
  }

  await pool.end();
}

// Main entry
async function main() {
  if (mode === "once" || mode === "--once") {
    await runOnce();
  } else if (mode === "scenario" || mode === "--scenario") {
    const scenario = args[1];
    if (!scenario) {
      log("Please specify a scenario. Run with --help for usage.", "yellow");
      process.exit(1);
    }
    await runScenario(scenario);
  } else if (mode === "--help" || mode === "-h") {
    console.log(`
${colors.bright}GuruPRO Dev Cron Script${colors.reset}

${colors.bright}Usage:${colors.reset}
  npm run dev:cron              Watch mode - run cron every minute
  npm run dev:cron:once         Run cron jobs once and exit
  npm run dev:cron:scenario     Run a specific test scenario

${colors.bright}Scenarios:${colors.reset}
  npm run dev:cron:scenario status
    - Show current status of all users

  npm run dev:cron:scenario expire-subscription <user-id>
    - Set a user's subscription to expired (for testing grace period entry)

  npm run dev:cron:scenario expire-grace <user-id>
    - Set a user to grace period with expired grace (for testing lock)

  npm run dev:cron:scenario reset-tokens <user-id>
    - Force a user to need token reset on next cron run

${colors.bright}For development:${colors.reset}
  1. Run: npm run dev:cron
  2. Use scenarios to set up test data
  3. Watch the cron process logs
  4. Press Ctrl+C to stop

${colors.bright}Note:${colors.reset}
  This is for development only. In production, use proper cron setup.
    `);
  } else {
    await runWatch();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
