import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get pricing plans from database
    const plansResult = await query(
      "SELECT * FROM pricing_plans WHERE is_active = true ORDER BY sort_order ASC"
    );

    if (plansResult.rows.length > 0) {
      const plans = plansResult.rows.map((row) => ({
        id: row.id,
        name: row.package_name,
        price: row.price,
        duration_days: row.duration_days,
        tokens: row.tokens || 0,
        features: typeof row.features === "string" ? JSON.parse(row.features) : row.features || [],
        popular: row.popular || false,
      }));

      return NextResponse.json({ plans });
    }

    // Fallback to default pricing
    return NextResponse.json({
      plans: [
        { id: 1, name: "Gratis", price: 0, duration_days: 30, tokens: 10, popular: false, features: ["10 Token Kuota Sekali", "Masa Aktif 30 Hari", "Generator Soal (LOTS C1-C3)", "Dukungan Kurikulum Merdeka"] },
        { id: 2, name: "3 Bulan", price: 120000, duration_days: 90, tokens: 500, popular: true, features: ["500 Token Kuota Utama", "Masa Aktif 90 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Terpadu"] },
        { id: 3, name: "6 Bulan", price: 220000, duration_days: 180, tokens: 1100, popular: false, features: ["1100 Token Kuota Utama", "Masa Aktif 180 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Prioritas"] },
        { id: 4, name: "1 Tahun", price: 400000, duration_days: 365, tokens: 2500, popular: false, features: ["2500 Token Kuota Utama", "Masa Aktif 365 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "CS VIP 24/7 & Backup Riwayat"] },
      ],
    });
  } catch (error: any) {
    console.error("GET /api/pricing error:", error);
    // Return default pricing if database fails
    return NextResponse.json({
      plans: [
        { id: 1, name: "Gratis", price: 0, duration_days: 30, tokens: 10, popular: false, features: ["10 Token Kuota Sekali", "Masa Aktif 30 Hari", "Generator Soal (LOTS C1-C3)", "Dukungan Kurikulum Merdeka"] },
        { id: 2, name: "3 Bulan", price: 120000, duration_days: 90, tokens: 500, popular: true, features: ["500 Token Kuota Utama", "Masa Aktif 90 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Terpadu"] },
        { id: 3, name: "6 Bulan", price: 220000, duration_days: 180, tokens: 1100, popular: false, features: ["1100 Token Kuota Utama", "Masa Aktif 180 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Prioritas"] },
        { id: 4, name: "1 Tahun", price: 400000, duration_days: 365, tokens: 2500, popular: false, features: ["2500 Token Kuota Utama", "Masa Aktif 365 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "CS VIP 24/7 & Backup Riwayat"] },
      ],
    });
  }
}
