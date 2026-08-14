import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookie } from "@/lib/session-sign";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
    throw new Error("Forbidden");
  }
}

export async function GET() {
  try {
    const config = await query("SELECT value FROM cms_landing WHERE key = 'landing_config'");
    if (config.rows.length === 0) {
      return NextResponse.json({ error: "CMS configuration not found" }, { status: 404 });
    }
    return NextResponse.json(config.rows[0].value);
  } catch (error: any) {
    console.error("GET CMS error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin();
    const body = await req.json();
    
    await query(
      `INSERT INTO cms_landing (key, value, updated_at) 
       VALUES ('landing_config', $1, CURRENT_TIMESTAMP)
       ON CONFLICT (key) 
       DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(body)]
    );

    return NextResponse.json({ success: true, message: "CMS config updated successfully" });
  } catch (error: any) {
    console.error("POST CMS error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
