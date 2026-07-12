/**
 * API Route: Token Jobs Cron Handler
 *
 * This endpoint can be called by Vercel Cron or external schedulers.
 * Secured via CRON_SECRET or Vercel's built-in cron authentication.
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/token-jobs",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 *
 * Or call manually:
 *   curl -X POST https://your-app.com/api/cron/token-jobs \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import { NextResponse } from "next/server";
import { resetMonthlyTokens, enforceGracePeriods } from "@/scripts/token-jobs";

// Vercel Cron includes a verification header
const CRON_SECRET = process.env.CRON_SECRET || process.env.CRON_SECRET_TOKEN;

export async function POST(request: Request) {
  try {
    // Verify cron secret
    if (!CRON_SECRET) {
      console.error("[CRON] CRON_SECRET environment variable is not configured.");
      return NextResponse.json({ error: "Cron not configured on server" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token !== CRON_SECRET) {
      console.warn("[CRON] Unauthorized cron request - invalid token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for Vercel's built-in cron header
    const isVercelCron = request.headers.get("x-vercel-cron") === "1";

    const { searchParams } = new URL(request.url);
    const job = searchParams.get("job") || "all";

    console.log(`[CRON] Token jobs started (job=${job}, vercelCron=${isVercelCron})`);

    let result: any = {};

    if (job === "monthly") {
      result = await resetMonthlyTokens();
    } else if (job === "daily") {
      result = await enforceGracePeriods();
    } else {
      // Run all
      const monthlyResult = await resetMonthlyTokens();
      const dailyResult = await enforceGracePeriods();
      result = { monthly: monthlyResult, daily: dailyResult };
    }

    console.log("[CRON] Token jobs completed:", result);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error: any) {
    console.error("[CRON] Token jobs failed:", error);
    return NextResponse.json(
      { error: "Cron job failed", message: error.message },
      { status: 500 }
    );
  }
}

// Also support GET for simple monitoring
export async function GET(request: Request) {
  return NextResponse.json({
    service: "Token Jobs Cron",
    status: "active",
    endpoints: {
      monthly: "/api/cron/token-jobs?job=monthly",
      daily: "/api/cron/token-jobs?job=daily",
      all: "/api/cron/token-jobs?job=all",
    },
    method: "POST",
    documentation: "See script comments for setup instructions",
  });
}
