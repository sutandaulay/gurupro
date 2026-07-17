import { pool } from "../lib/db";

async function runMigration() {
  console.log("🚀 Memulai migrasi tabel pricing_plans...");

  try {
    // 1. Tambah kolom tokens jika belum ada
    console.log("Adding column 'tokens' if not exists...");
    await pool.query(`
      ALTER TABLE pricing_plans 
      ADD COLUMN IF NOT EXISTS tokens INTEGER DEFAULT 0
    `);

    // 2. Tambah kolom popular jika belum ada
    console.log("Adding column 'popular' if not exists...");
    await pool.query(`
      ALTER TABLE pricing_plans 
      ADD COLUMN IF NOT EXISTS popular BOOLEAN DEFAULT FALSE
    `);

    // 3. Tambah kolom grace_period_days jika belum ada
    console.log("Adding column 'grace_period_days' if not exists...");
    await pool.query(`
      ALTER TABLE pricing_plans 
      ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 7
    `);

    console.log("✓ Kolom tabel pricing_plans berhasil diperbarui/diverifikasi!");

    // 4. Periksa apakah tabel kosong
    const countRes = await pool.query("SELECT COUNT(*) FROM pricing_plans");
    const count = parseInt(countRes.rows[0].count);
    console.log(`Jumlah data paket saat ini: ${count}`);

    if (count === 0) {
      console.log("🌱 Tabel pricing_plans kosong. Memulai seeding data paket default...");

      const defaultPlans = [
        {
          package_name: "Gratis",
          price: 0,
          duration_days: 30,
          tokens: 10,
          popular: false,
          sort_order: 1,
          features: [
            "10 Token Kuota Sekali",
            "Masa Aktif 30 Hari",
            "Generator Soal (LOTS C1-C3)",
            "Dukungan Kurikulum Merdeka"
          ]
        },
        {
          package_name: "3 Bulan",
          price: 120000,
          duration_days: 90,
          tokens: 500,
          popular: true,
          sort_order: 2,
          features: [
            "500 Token Kuota Utama",
            "Masa Aktif 90 Hari",
            "Generator Soal HOTS (C4-C6)",
            "Cetak Lembar Jawaban Resmi",
            "Server Prioritas & CS Terpadu"
          ]
        },
        {
          package_name: "6 Bulan",
          price: 220000,
          duration_days: 180,
          tokens: 1100,
          popular: false,
          sort_order: 3,
          features: [
            "1100 Token Kuota Utama",
            "Masa Aktif 180 Hari",
            "Generator Soal HOTS (C4-C6)",
            "Cetak Lembar Jawaban Resmi",
            "Server Prioritas & CS Prioritas"
          ]
        },
        {
          package_name: "1 Tahun",
          price: 400000,
          duration_days: 365,
          tokens: 2500,
          popular: false,
          sort_order: 4,
          features: [
            "2500 Token Kuota Utama",
            "Masa Aktif 365 Hari",
            "Generator Soal HOTS (C4-C6)",
            "Cetak Lembar Jawaban Resmi",
            "CS VIP 24/7 & Backup Riwayat"
          ]
        }
      ];

      for (const plan of defaultPlans) {
        await pool.query(
          `INSERT INTO pricing_plans (package_name, price, duration_days, tokens, features, is_active, popular, sort_order, grace_period_days)
           VALUES ($1, $2, $3, $4, $5::jsonb, TRUE, $6, $7, 7)`,
          [
            plan.package_name,
            plan.price,
            plan.duration_days,
            plan.tokens,
            JSON.stringify(plan.features),
            plan.popular,
            plan.sort_order
          ]
        );
        console.log(`✓ Berhasil seeding paket: ${plan.package_name}`);
      }
      console.log("✅ Seeding data selesai!");
    } else {
      console.log("ℹ️ Tabel pricing_plans sudah memiliki data. Seeding dilewati.");
    }
  } catch (err) {
    console.error("❌ Terjadi kesalahan saat migrasi/seeding:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
