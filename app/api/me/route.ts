import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { getTokensPerPoin } from "@/src/config/ratio-cache";
import { captureError, errorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const userRes = await query(
      "SELECT id, nama_lengkap, email, photo_url, quota_poin_total, quota_poin_used, addon_poin, addon_poin_used, token_accumulated FROM users WHERE id = $1",
      [session.id]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ user: null }, { status: 404 });
    }

    const user = userRes.rows[0];
    const mainAvailable = Math.max(0, (user.quota_poin_total || 0) - (user.quota_poin_used || 0));
    const addonAvailable = Math.max(0, (user.addon_poin || 0) - (user.addon_poin_used || 0));
    const tokensPerPoin = await getTokensPerPoin();

    return NextResponse.json({
      user: {
        ...user,
        token_limit: mainAvailable + addonAvailable,
        quota_poin_available: mainAvailable,
        addon_poin_available: addonAvailable,
        token_accumulated: user.token_accumulated || 0,
        tokens_per_poin: tokensPerPoin,
      },
    });
  } catch (error: any) {
    captureError(error, { route: '/api/me' });
    return NextResponse.json(errorResponse(error, 'Gagal mengambil data user'));
  }
}
