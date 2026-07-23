/**
 * Seed Pricing Plans directly to Payload CMS
 * Run: npx tsx scripts/seed-pricing-cms.ts
 *
 * Seeds pricing plans directly to payload.pricing_plans table
 */

import { pool } from "../lib/db";

const PRICING_PLANS = [
  {
    packageName: "Gratis",
    slug: "gratis",
    price: 0,
    tokens: 10,
    durationDays: 30,
    isActive: true,
    isPopular: false,
    sortOrder: 0,
    gracePeriodDays: 0,
    description: "Uji coba awal fitur GuruPRO",
    features: [
      "10 Poin Kuota Sekali",
      "Masa Aktif 30 Hari",
      "Generator Soal (LOTS C1-C3)",
      "Dukungan Kurikulum Merdeka"
    ]
  },
  {
    packageName: "3 Bulan",
    slug: "three_month",
    price: 120000,
    tokens: 500,
    durationDays: 90,
    isActive: true,
    isPopular: true,
    sortOrder: 1,
    gracePeriodDays: 7,
    description: "Pendamping mengajar 1 triwulan",
    features: [
      "500 Poin Kuota Utama",
      "Masa Aktif 90 Hari",
      "Generator Soal HOTS (C4-C6)",
      "Cetak Lembar Jawaban Resmi",
      "Server Prioritas & CS Terpadu"
    ]
  },
  {
    packageName: "6 Bulan",
    slug: "six_month",
    price: 220000,
    tokens: 1100,
    durationDays: 180,
    isActive: true,
    isPopular: false,
    sortOrder: 2,
    gracePeriodDays: 14,
    description: "Persiapan matang untuk 2 semester",
    features: [
      "1100 Poin Kuota Utama",
      "Masa Aktif 180 Hari",
      "Generator Soal HOTS (C4-C6)",
      "Cetak Lembar Jawaban Resmi",
      "Server Prioritas & CS Prioritas"
    ]
  },
  {
    packageName: "1 Tahun",
    slug: "one_year",
    price: 400000,
    tokens: 2500,
    durationDays: 365,
    isActive: true,
    isPopular: false,
    sortOrder: 3,
    gracePeriodDays: 14,
    description: "Efisiensi maksimal jangka panjang",
    features: [
      "2500 Poin Kuota Utama",
      "Masa Aktif 365 Hari",
      "Generator Soal HOTS (C4-C6)",
      "Cetak Lembar Jawaban Resmi",
      "CS VIP 24/7 & Backup Riwayat"
    ]
  }
];

async function seedPricingPlans() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          SEED PRICING PLANS TO PAYLOAD CMS              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Check if collection table exists
    console.log('1. Checking payload.pricing_plans table...');
    try {
      await pool.query(`SELECT 1 FROM payload.pricing_plans LIMIT 1`);
      console.log('   ✅ Table exists\n');
    } catch (e: any) {
      console.log('   ❌ Table does not exist');
      console.log('   Error:', e.message);
      console.log('\n   ⚠️  You need to run "npx payload push" first to create the collection.\n');
      await pool.end();
      return;
    }

    // 2. Check column names
    console.log('2. Checking column names...');
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'payload' AND table_name = 'pricing_plans'
    `);
    const colNames = cols.rows.map(r => r.column_name);
    console.log(`   Found columns: ${colNames.join(', ')}\n`);

    // 3. Clear existing plans (optional - comment out if you want to preserve)
    console.log('3. Clearing existing plans...');
    await pool.query(`DELETE FROM payload.pricing_plans`);
    console.log('   ✅ Cleared\n');

    // 4. Insert plans
    console.log('4. Inserting pricing plans...\n');

    for (const plan of PRICING_PLANS) {
      // Map features to array format
      const featuresJson = JSON.stringify(
        plan.features.map(f => ({ feature: f }))
      );

      // Check which columns exist
      const hasGracePeriod = colNames.includes('gracePeriodDays');
      const hasDescription = colNames.includes('description');
      const hasIsPopular = colNames.includes('isPopular');
      const hasIsActive = colNames.includes('isActive');

      let columns = [
        '"packageName"', 'slug', 'price', 'tokens', '"durationDays"',
        'features', '"isActive"', '"isPopular"', '"sortOrder"',
        '"createdAt"', '"updatedAt"'
      ];
      let values = [
        '$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8', '$9', 'NOW()', 'NOW()'
      ];
      let params: any[] = [
        plan.packageName, plan.slug, plan.price, plan.tokens, plan.durationDays,
        featuresJson, plan.isActive, plan.isPopular, plan.sortOrder
      ];

      if (hasGracePeriod) {
        columns.push('"gracePeriodDays"');
        values.push(`$${params.length + 1}`);
        params.push(plan.gracePeriodDays);
      }
      if (hasDescription) {
        columns.push('description');
        values.push(`$${params.length + 1}`);
        params.push(plan.description);
      }

      const sql = `
        INSERT INTO payload.pricing_plans (${columns.join(', ')})
        VALUES (${values.join(', ')}
      `;

      try {
        await pool.query(sql, params);
        const badge = plan.isPopular ? '🔥 POPULAR' : '';
        console.log(`   ✅ ${plan.packageName} | Rp ${plan.price.toLocaleString()} | ${plan.tokens} tokens ${badge}`);
      } catch (insertError: any) {
        console.log(`   ❌ ${plan.packageName}: ${insertError.message}`);
      }
    }

    // 5. Verify
    console.log('\n5. Verification...\n');
    const verify = await pool.query(`
      SELECT "packageName", slug, price, tokens, "isPopular", "sortOrder"
      FROM payload.pricing_plans
      ORDER BY "sortOrder" ASC
    `);

    console.log('   Current CMS Pricing Plans:');
    console.log('   ──────────────────────────────────────────────────');
    for (const p of verify.rows) {
      const badge = p.isPopular ? ' 🔥' : '';
      console.log(`   ${p.sortOrder + 1}. ${p.packageName.padEnd(15)} Rp ${Number(p.price).toLocaleString().padStart(8)} | ${String(p.tokens).padStart(4)} tokens${badge}`);
    }
    console.log('   ──────────────────────────────────────────────────');
    console.log(`   Total: ${verify.rows.length} packages`);

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ SEEDING COMPLETE                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n📝 Note: Manage pricing plans in Payload Admin:');
    console.log('   http://localhost:3000/admin/cms-pricing-plans\n');

  } catch (e: any) {
    console.error('Seeding failed:', e.message);
  }

  await pool.end();
}

seedPricingPlans().catch(e => {
  console.error(e);
  process.exit(1);
});
