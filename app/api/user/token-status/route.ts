/**
 * API: /api/user/token-status
 *
 * Returns current token balance and subscription status for the authenticated user.
 * Used by token guard components and UI indicators.
 */

import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getTokensPerPoin } from "@/src/config/ratio-cache";

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
        quota_poin_total,
        quota_poin_used,
        addon_poin,
        addon_poin_used,
        addon_poin_grace_period_ends,
        subscription_start,
        subscription_end,
        subscription_status,
        grace_period_ends_at,
        token_accumulated
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

    // Hitung Poin yang tersedia dari sistem baru
    const mainTotal = user.quota_poin_total || 0;
    const mainUsed = user.quota_poin_used || 0;
    const mainAvailable = Math.max(0, mainTotal - mainUsed);

    const addonTotal = user.addon_poin || 0;
    const addonUsed = user.addon_poin_used || 0;

    // Cek grace period addon
    const gracePeriodEnds = user.addon_poin_grace_period_ends
      ? new Date(user.addon_poin_grace_period_ends).getTime()
      : null;
    const isAddonGraceActive = gracePeriodEnds && gracePeriodEnds > Date.now();
    const addonAvailable = isAddonGraceActive ? Math.max(0, addonTotal - addonUsed) : 0;

    const totalAvailable = mainAvailable + addonAvailable;

    // Check subscription status
    const now = new Date();
    const subscriptionEnd = user.subscription_end
      ? new Date(user.subscription_end)
      : null;
    const isExpired = subscriptionEnd ? subscriptionEnd.getTime() < now.getTime() : false;

    const gracePeriodEndsAt = user.grace_period_ends_at
      ? new Date(user.grace_period_ends_at)
      : null;
    const isGracePeriodExpired =
      gracePeriodEndsAt && gracePeriodEndsAt.getTime() < now.getTime();

    // Determine actual status
    let effectiveStatus = user.subscription_status || "active";

    if (effectiveStatus === "active" && isExpired) {
      effectiveStatus = "grace_period"; // Will be updated by cron job
    }

    if (effectiveStatus === "grace_period" && isGracePeriodExpired) {
      effectiveStatus = "locked";
    }

    const tokensPerPoin = await getTokensPerPoin();

    return NextResponse.json({
      id: user.id,
      email: user.email,
      nama_lengkap: user.nama_lengkap,
      role: user.role,
      status_langganan: user.status_langganan,
      subscription_status: effectiveStatus,
      subscription_end: user.subscription_end,
      grace_period_ends_at: gracePeriodEndsAt
        ? gracePeriodEndsAt.toISOString()
        : null,

      // Poin info (sistem baru)
      quota_poin_total: mainTotal,
      quota_poin_used: mainUsed,
      quota_poin_available: mainAvailable,
      addon_poin_total: addonTotal,
      addon_poin_used: addonUsed,
      addon_poin_available: addonAvailable,

      // Token accumulation info
      token_accumulated: user.token_accumulated || 0,
      tokens_per_poin: tokensPerPoin,
      tokens_until_next_poin: tokensPerPoin - (user.token_accumulated || 0),

      // Backward compat
      token_limit: mainAvailable + addonAvailable,
      addon_token_balance: addonAvailable,
      total_token_balance: totalAvailable,

      // Computed
      hasAccess: totalAvailable > 0 && effectiveStatus !== "locked",
      reason:
        effectiveStatus === "locked"
          ? "Akun terkunci"
          : isExpired
          ? "Langganan berakhir"
          : totalAvailable <= 0
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
