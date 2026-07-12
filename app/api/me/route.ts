import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const userRes = await query(
      "SELECT id, nama_lengkap, email, photo_url FROM users WHERE id = $1",
      [session.id]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ user: null }, { status: 404 });
    }

    return NextResponse.json({ user: userRes.rows[0] });
  } catch (error: any) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
