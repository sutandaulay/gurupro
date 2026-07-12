import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { query } from "@/lib/db";
import { setDefaultSessionCookie } from "@/lib/session";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Tidak ada sesi NextAuth" }, { status: 401 });
    }

    const userRes = await query(
      "SELECT id, role FROM users WHERE email = $1",
      [session.user.email.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    const user = userRes.rows[0];

    await setDefaultSessionCookie({
      id: user.id,
      role: user.role || "guru",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Sync session error:", err);
    return NextResponse.json({ error: "Gagal sync session" }, { status: 500 });
  }
}
