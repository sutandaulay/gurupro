import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await query("SELECT key, LEFT(value::text, 200) as value_preview FROM system_settings ORDER BY key");
    return NextResponse.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error: any) {
    console.error("DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
