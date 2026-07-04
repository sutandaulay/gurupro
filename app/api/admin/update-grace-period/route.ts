/**
 * Admin API: Update Grace Period Days for pricing plans
 *
 * Run: GET /api/admin/update-grace-period
 * Purpose: Set grace_period_days = 14 for all pricing plans that have NULL value
 *
 * Security: This is a simple admin helper - in production, add proper auth check
 */

import { query, pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // First, ensure the column exists
    await pool.query(`
      ALTER TABLE pricing_plans
      ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 14
    `);

    // Update all plans with NULL grace_period_days to 14
    const updateRes = await pool.query(`
      UPDATE pricing_plans
      SET grace_period_days = 14
      WHERE grace_period_days IS NULL
      RETURNING id, package_name, grace_period_days
    `);

    // Get all plans
    const allPlans = await query(`
      SELECT id, package_name, grace_period_days, tokens, price
      FROM pricing_plans
      ORDER BY sort_order
    `);

    return NextResponse.json({
      success: true,
      message: `Updated ${updateRes.rowCount} pricing plans with grace_period_days = 14`,
      updated: updateRes.rows,
      allPlans: allPlans.rows,
    });
  } catch (error: any) {
    console.error("[Admin] Update grace period error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update grace period" },
      { status: 500 }
    );
  }
}
