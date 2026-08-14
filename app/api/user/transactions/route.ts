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

    const result = await query(
      `SELECT id, external_id, amount, status, created_at, notes, plan_id
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return NextResponse.json({ transactions: result.rows });
  } catch (error: any) {
    console.error("[API] User transactions error:", error);
    return NextResponse.json({ error: "Gagal mengambil riwayat" }, { status: 500 });
  }
}
