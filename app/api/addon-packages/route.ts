import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const res = await query(
      "SELECT id, name, poin_amount, price, is_active, sort_order FROM addon_token_packages WHERE is_active = true ORDER BY sort_order ASC, created_at ASC"
    );
    const packages = res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      poinAmount: r.poin_amount,
      price: Number(r.price),
      isActive: r.is_active,
    }));
    return NextResponse.json({ packages });
  } catch (err: any) {
    console.error("Failed to fetch addon packages:", err);
    return NextResponse.json({ error: err.message || "Failed to list addon packages" }, { status: 500 });
  }
}
