import { pool } from "../lib/db";

async function testSave() {
  console.log("🧪 Menguji penyimpanan paket baru...");

  try {
    const testPackage = {
      package_name: "Paket Tes AI",
      price: 150000,
      duration_days: 60,
      tokens: 300,
      features: JSON.stringify(["Fitur Tes 1", "Fitur Tes 2"]),
      is_active: true,
      popular: true,
      sort_order: 10,
    };

    const res = await pool.query(
      `INSERT INTO pricing_plans (package_name, price, duration_days, tokens, features, is_active, popular, sort_order)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       RETURNING *`,
      [
        testPackage.package_name,
        testPackage.price,
        testPackage.duration_days,
        testPackage.tokens,
        testPackage.features,
        testPackage.is_active,
        testPackage.popular,
        testPackage.sort_order,
      ]
    );

    console.log("✅ Berhasil menyimpan paket baru ke database!");
    console.log("Data yang disimpan:", res.rows[0]);

    // Hapus data tes setelah pengujian
    await pool.query("DELETE FROM pricing_plans WHERE package_name = $1", [testPackage.package_name]);
    console.log("🧹 Data tes berhasil dibersihkan.");
  } catch (err) {
    console.error("❌ Gagal menyimpan paket baru:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testSave();
