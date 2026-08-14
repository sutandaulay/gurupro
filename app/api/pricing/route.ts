import { query } from "@/lib/db";
import { NextResponse } from "next/server";

function parsePrice(val: any): number {
  if (typeof val === "string") return parseFloat(val) || 0;
  return Number(val) || 0;
}

function parseFeatures(val: any): string[] {
  if (!val) return [];
  if (typeof val === "string") try { return JSON.parse(val); } catch { return []; }
  if (Array.isArray(val)) return val;
  return [];
}

export async function GET() {
  // ============================================
  // SOURCE: CMS Landing Page (public.pricing_plans)
  // Dikelola via Dashboard Admin > CMS Landing > Paket.
  // Satu-satunya sumber harga yang dipakai app.
  // ============================================
  try {
    const plansResult = await query(
      "SELECT * FROM pricing_plans WHERE is_active = true ORDER BY sort_order ASC"
    );

    const plans = plansResult.rows.map((row: any) => ({
      id: row.id,
      name: row.package_name,
      package_name: row.package_name,
      price: parsePrice(row.price),
      duration_days: row.duration_days,
      tokens: typeof row.tokens === "string" ? parseInt(row.tokens) || 0 : row.tokens || 0,
      features: parseFeatures(row.features),
      popular: row.popular || false,
      sort_order: row.sort_order || 0,
    }));

    return NextResponse.json({ plans });
  } catch (dbError) {
    console.error("[API/Pricing] Database error:", dbError);
    return NextResponse.json(
      { error: "Gagal memuat paket", plans: [] },
      { status: 500 }
    );
  }
}
