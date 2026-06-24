import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await query(
      "SELECT id, username, email, nama_lengkap, role FROM users ORDER BY nama_lengkap ASC"
    );
    return NextResponse.json(users.rows);
  } catch (error: any) {
    console.error("Users list GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
