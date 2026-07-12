/**
 * Migration: Add grace_period_days field to pricing_plans
 *
 * Run: npx tsx scripts/migrate-add-grace-period.ts
 *
 * Description:
 * - Adds grace_period_days column to pricing_plans table
 * - Sets default value of 7 days for all existing plans
 * - This allows per-tier grace period configuration
 */

import { pool } from "@/lib/db";

async function migrate() {
  console.log("Starting migration: Add grace_period_days to pricing_plans...");

  try {
    // 1. Add column if not exists
    await pool.query(`
      ALTER TABLE pricing_plans
      ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 7
    `);
    console.log("✓ Column grace_period_days added/verified");

    // 2. Update existing plans with default 7 days if they have NULL
    const updateResult = await pool.query(`
      UPDATE pricing_plans
      SET grace_period_days = 7
      WHERE grace_period_days IS NULL
    `);
    console.log(`✓ Updated ${updateResult.rowCount} plans with default grace period (7 days)`);

    // 3. Create index for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pricing_plans_grace_period
      ON pricing_plans (grace_period_days)
      WHERE grace_period_days IS NOT NULL
    `);
    console.log("✓ Index created/verified");

    // 4. Verify
    const verifyResult = await pool.query(`
      SELECT id, package_name, grace_period_days
      FROM pricing_plans
      ORDER BY sort_order
    `);
    console.log("\n📋 Current pricing plans:");
    verifyResult.rows.forEach((row: any) => {
      console.log(`  - ${row.package_name}: ${row.grace_period_days} days grace period`);
    });

    console.log("\n✅ Migration completed successfully!");
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
