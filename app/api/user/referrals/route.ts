import { query } from "@/lib/db";
import { parseSessionCookie } from "@/lib/session-sign";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.id;

    // Fetch referrals
    const referrals = await query(
      `SELECT r.created_at, u.nama_lengkap AS referee_name, u.email AS referee_email, 
              r.reward_tokens, r.cashback_amount
       FROM referrals r 
       JOIN users u ON r.referee_id = u.id 
       WHERE r.referrer_id = $1 
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return NextResponse.json(referrals.rows);
  } catch (error: any) {
    console.error("GET referrals error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
