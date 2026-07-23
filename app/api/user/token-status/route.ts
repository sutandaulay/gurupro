/**
 * API: /api/user/token-status
 *
 * Returns current token balance and subscription status for the authenticated user.
 * Used by token guard components and UI indicators.
 */

import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Sesi tidak aktif", reason: "no_session" },
        { status: 401 }
      );
    }

    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const userRes = await query(
      `SELECT
        id,
        email,
        nama_lengkap,
        role,
        status_langganan,
        token_limit,
        addon_token_balance,
        main_token_reset_date,
        subscription_start,
        subscription_end,
        subscription_status,
        grace_period_ends_at
      FROM users
      WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: "User tidak ditemukan", reason: "not_found" },
        { status: 404 }
      );
    }

    const user = userRes.rows[0];

    // Calculate remaining tokens
    const mainTokens = Number(user.token_limit || 0);
    const addonTokens = Number(user.addon_token_balance || 0);
    const totalTokens = mainTokens + addonTokens;

    // Check subscription status
    const now = new Date();
    const subscriptionEnd = user.subscription_end
      ? new Date(user.subscription_end)
      : null;
    const isExpired = subscriptionEnd ? subscriptionEnd.getTime() < now.getTime() : false;

    const gracePeriodEnds = user.grace_period_ends_at
      ? new Date(user.grace_period_ends_at)
      : null;
    const isGracePeriodExpired =
      gracePeriodEnds && gracePeriodEnds.getTime() < now.getTime();

    // Determine actual status
    let effectiveStatus = user.subscription_status || "active";

    if (effectiveStatus === "active" && isExpired) {
      effectiveStatus = "grace_period"; // Will be updated by cron job
    }

    if (effectiveStatus === "grace_period" && isGracePeriodExpired) {
      effectiveStatus = "locked";
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      nama_lengkap: user.nama_lengkap,
      role: user.role,
      status_langganan: user.status_langganan,
      subscription_status: effectiveStatus,
      subscription_end: user.subscription_end,
      grace_period_ends_at: gracePeriodEnds
        ? gracePeriodEnds.toISOString()
        : null,

      // Token info
      token_limit: mainTokens,
      addon_token_balance: addonTokens,
      total_token_balance: totalTokens,
      main_token_reset_date: user.main_token_reset_date,

      // Computed
      hasAccess: totalTokens > 0 && effectiveStatus !== "locked",
      reason:
        effectiveStatus === "locked"
          ? "Akun terkunci"
          : isExpired
          ? "Langganan berakhir"
          : totalTokens <= 0
          ? "Poin habis"
          : "active",
    });
  } catch (error: any) {
    console.error("[API] Token status error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengambil status token" },
      { status: 500 }
    );
  }
}
