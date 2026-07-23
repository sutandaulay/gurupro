/**
 * Create Pricing Plans Collection Table in Payload CMS
 * Run: npx tsx scripts/create-pricing-cms-table.ts
 */

import { pool } from "../lib/db";

async function createPricingTable() {
  console.log('=== CREATE PRICING PLANS TABLE IN PAYLOAD CMS ===\n');

  try {
    // 1. Check if payload schema exists
    console.log('1. Checking payload schema...');
    const schemaCheck = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'payload'
      ) as exists
    `);
    console.log(`   Payload schema: ${schemaCheck.rows[0].exists ? '✅ EXISTS' : '❌ MISSING'}\n`);

    if (!schemaCheck.rows[0].exists) {
      console.log('❌ Payload schema does not exist!');
      console.log('   Run "npx payload push" first.\n');
      await pool.end();
      return;
    }

    // 2. Create pricing_plans table
    console.log('2. Creating pricing_plans table...');
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS payload.pricing_plans (
          id SERIAL PRIMARY KEY,
          "packageName" VARCHAR(255) NOT NULL,
          slug VARCHAR(100) UNIQUE NOT NULL,
          price NUMERIC(12,2) NOT NULL DEFAULT 0,
          tokens INTEGER NOT NULL DEFAULT 0,
          "durationDays" INTEGER NOT NULL DEFAULT 30,
          features JSONB DEFAULT '[]'::jsonb,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "isPopular" BOOLEAN NOT NULL DEFAULT false,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "gracePeriodDays" INTEGER DEFAULT 7,
          description TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('   ✅ Table created\n');
    } catch (createError: any) {
      if (createError.message.includes('already exists')) {
        console.log('   ℹ️  Table already exists\n');
      } else {
        throw createError;
      }
    }

    // 3. Create indexes
    console.log('3. Creating indexes...');
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_pricing_plans_active
        ON payload.pricing_plans ("isActive") WHERE "isActive" = true
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_pricing_plans_sort
        ON payload.pricing_plans ("sortOrder")
      `);
      console.log('   ✅ Indexes created\n');
    } catch (indexError: any) {
      console.log(`   ⚠️  Index error: ${indexError.message}\n`);
    }

    // 4. Seed default plans
    console.log('4. Seeding pricing plans...\n');

    const plans = [
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
        features: JSON.stringify([
          { feature: "10 Poin Kuota Sekali" },
          { feature: "Masa Aktif 30 Hari" },
          { feature: "Generator Soal (LOTS C1-C3)" },
          { feature: "Dukungan Kurikulum Merdeka" }
        ])
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
        features: JSON.stringify([
          { feature: "500 Poin Kuota Utama" },
          { feature: "Masa Aktif 90 Hari" },
          { feature: "Generator Soal HOTS (C4-C6)" },
          { feature: "Cetak Lembar Jawaban Resmi" },
          { feature: "Server Prioritas & CS Terpadu" }
        ])
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
        features: JSON.stringify([
          { feature: "1100 Poin Kuota Utama" },
          { feature: "Masa Aktif 180 Hari" },
          { feature: "Generator Soal HOTS (C4-C6)" },
          { feature: "Cetak Lembar Jawaban Resmi" },
          { feature: "Server Prioritas & CS Prioritas" }
        ])
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
        features: JSON.stringify([
          { feature: "2500 Poin Kuota Utama" },
          { feature: "Masa Aktif 365 Hari" },
          { feature: "Generator Soal HOTS (C4-C6)" },
          { feature: "Cetak Lembar Jawaban Resmi" },
          { feature: "CS VIP 24/7 & Backup Riwayat" }
        ])
      }
    ];

    for (const plan of plans) {
      try {
        await pool.query(`
          INSERT INTO payload.pricing_plans (
            "packageName", slug, price, tokens, "durationDays",
            features, "isActive", "isPopular", "sortOrder",
            "gracePeriodDays", description, "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, NOW(), NOW())
          ON CONFLICT (slug) DO UPDATE SET
            "packageName" = EXCLUDED."packageName",
            price = EXCLUDED.price,
            tokens = EXCLUDED.tokens,
            "durationDays" = EXCLUDED."durationDays",
            features = EXCLUDED.features,
            "isActive" = EXCLUDED."isActive",
            "isPopular" = EXCLUDED."isPopular",
            "sortOrder" = EXCLUDED."sortOrder",
            "gracePeriodDays" = EXCLUDED."gracePeriodDays",
            description = EXCLUDED.description,
            "updatedAt" = NOW()
        `, [
          plan.packageName, plan.slug, plan.price, plan.tokens, plan.durationDays,
          plan.features, plan.isActive, plan.isPopular, plan.sortOrder,
          plan.gracePeriodDays, plan.description
        ]);
        const badge = plan.isPopular ? ' 🔥 POPULAR' : '';
        console.log(`   ✅ ${plan.packageName} | Rp ${plan.price.toLocaleString()} | ${plan.tokens} tokens${badge}`);
      } catch (insertError: any) {
        console.log(`   ❌ ${plan.packageName}: ${insertError.message}`);
      }
    }

    // 5. Verify
    console.log('\n5. Verification...');
    const verify = await pool.query(`
      SELECT id, "packageName", slug, price, tokens, "isPopular", "sortOrder"
      FROM payload.pricing_plans
      WHERE "isActive" = true
      ORDER BY "sortOrder" ASC
    `);

    console.log('\n   ╔════════════════════════════════════════════════════════════════╗');
    console.log('   ║           CMS PRICING PLANS                             ║');
    console.log('   ╠════════════════════════════════════════════════════════════════╣');
    console.log('   ║ # │ Package          │ Price        │ Tokens │ Badge      ║');
    console.log('   ╠════════════════════════════════════════════════════════════════╣');
    for (const p of verify.rows) {
      const badge = p.isPopular ? '🔥 POPULAR' : '          ';
      console.log(`   ║ ${(verify.rows.indexOf(p) + 1)} │ ${p.packageName.padEnd(15)} │ Rp ${String(Number(p.price).toLocaleString()).padStart(9)} │ ${String(p.tokens).padStart(5)} │ ${badge}`);
    }
    console.log('   ╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n   Total: ${verify.rows.length} packages\n`);

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ TABLE CREATED & SEEDED                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n📝 Next: Manage in Payload Admin at:');
    console.log('   http://localhost:3000/admin/pricing-plans\n');

  } catch (e: any) {
    console.error('❌ Error:', e.message);
  }

  await pool.end();
}

createPricingTable().catch(e => {
  console.error(e);
  process.exit(1);
});
