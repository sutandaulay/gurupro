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
  try {
    const plansResult = await query(
      "SELECT * FROM pricing_plans WHERE is_active = true ORDER BY sort_order ASC"
    );

    if (plansResult.rows.length > 0) {
      const plans = plansResult.rows.map((row) => ({
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
    }

    return NextResponse.json({
      plans: [
        { id: "free", name: "Gratis", package_name: "Gratis", price: 0, duration_days: 30, tokens: 10, popular: false, sort_order: 0, features: ["10 Token Kuota Sekali", "Masa Aktif 30 Hari", "Generator Soal (LOTS C1-C3)", "Dukungan Kurikulum Merdeka"] },
        { id: "three_month", name: "3 Bulan", package_name: "3 Bulan", price: 120000, duration_days: 90, tokens: 500, popular: true, sort_order: 1, features: ["500 Token Kuota Utama", "Masa Aktif 90 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Terpadu"] },
        { id: "six_month", name: "6 Bulan", package_name: "6 Bulan", price: 220000, duration_days: 180, tokens: 1100, popular: false, sort_order: 2, features: ["1100 Token Kuota Utama", "Masa Aktif 180 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Prioritas"] },
        { id: "one_year", name: "1 Tahun", package_name: "1 Tahun", price: 400000, duration_days: 365, tokens: 2500, popular: false, sort_order: 3, features: ["2500 Token Kuota Utama", "Masa Aktif 365 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "CS VIP 24/7 & Backup Riwayat"] },
      ],
    });
  } catch (error: any) {
    console.error("GET /api/pricing error:", error);
    return NextResponse.json({
      plans: [
        { id: "free", name: "Gratis", package_name: "Gratis", price: 0, duration_days: 30, tokens: 10, popular: false, sort_order: 0, features: ["10 Token Kuota Sekali", "Masa Aktif 30 Hari", "Generator Soal (LOTS C1-C3)", "Dukungan Kurikulum Merdeka"] },
        { id: "three_month", name: "3 Bulan", package_name: "3 Bulan", price: 120000, duration_days: 90, tokens: 500, popular: true, sort_order: 1, features: ["500 Token Kuota Utama", "Masa Aktif 90 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Terpadu"] },
        { id: "six_month", name: "6 Bulan", package_name: "6 Bulan", price: 220000, duration_days: 180, tokens: 1100, popular: false, sort_order: 2, features: ["1100 Token Kuota Utama", "Masa Aktif 180 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Prioritas"] },
        { id: "one_year", name: "1 Tahun", package_name: "1 Tahun", price: 400000, duration_days: 365, tokens: 2500, popular: false, sort_order: 3, features: ["2500 Token Kuota Utama", "Masa Aktif 365 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "CS VIP 24/7 & Backup Riwayat"] },
      ],
    });
  }
}