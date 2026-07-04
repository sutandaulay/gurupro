import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await query("SELECT * FROM addon_token_packages WHERE is_active = true ORDER BY sort_order ASC, created_at ASC");
    return NextResponse.json({ packages: result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      token_amount: Number(row.token_amount || 0),
      price: Number(row.price || 0),
      description: row.description || "",
    })) });
  } catch (error: any) {
    console.error("GET /api/token-packages error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
