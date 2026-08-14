import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookie } from "@/lib/session-sign";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) throw new Error("Unauthorized");
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) throw new Error("Forbidden");
}

export async function GET() {
  try {
    // Try database first (fast)
    try {
      const cacheRes = await query(
        "SELECT key, value FROM system_settings WHERE key = 'landing_footer'"
      );

      if (cacheRes.rows.length > 0) {
        try {
          const val = cacheRes.rows[0].value;
          return NextResponse.json(typeof val === "string" ? JSON.parse(val) : val);
        } catch {
          return NextResponse.json({});
        }
      }

      return NextResponse.json({});
    } catch {
      return NextResponse.json({});
    }
  } catch (error: any) {
    console.error("GET footer error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await verifyAdmin();
    const body = await req.json();

    // Save to database
    await query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('landing_footer', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(body)]
    );

    return NextResponse.json({ success: true, savedTo: "database" });
  } catch (error: any) {
    console.error("PUT footer error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
