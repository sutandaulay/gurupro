import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const results: string[] = [];

    // Create cms_features table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS cms_features (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          icon VARCHAR(100),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          "order" INTEGER DEFAULT 0,
          "isActive" BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      results.push("✅ cms_features table created");
    } catch (e) {
      results.push(`⚠️ cms_features: ${(e as Error).message}`);
    }

    // Create why_points table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS why_points (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          point VARCHAR(500) NOT NULL,
          "order" INTEGER DEFAULT 0,
          "isActive" BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      results.push("✅ why_points table created");
    } catch (e) {
      results.push(`⚠️ why_points: ${(e as Error).message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Database tables initialized",
      results,
    });
  } catch (error: any) {
    console.error("DB init error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize tables" },
      { status: 500 }
    );
  }
}
