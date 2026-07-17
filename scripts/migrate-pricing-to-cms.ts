/**
 * Migrate Pricing Plans to Payload CMS
 * Run: npx tsx scripts/migrate-pricing-to-cms.ts
 *
 * This script migrates pricing plans from public.pricing_plans to Payload CMS
 */

import { pool } from "../lib/db";

async function migratePricingToCMS() {
  console.log('=== MIGRATE PRICING PLANS TO CMS ===\n');

  try {
    // 1. Check if Payload CMS pricing-plans collection exists
    console.log('1. Checking Payload CMS collection...');
    try {
      await pool.query(`
        SELECT 1 FROM payload.pricing_plans LIMIT 1
      `);
      console.log('   ✅ pricing-plans collection exists\n');
    } catch (e) {
      console.log('   ❌ pricing-plans collection does not exist');
      console.log('   Please run: npx payload push\n');
      await pool.end();
      return;
    }

    // 2. Get existing plans from public.pricing_plans
    console.log('2. Reading from public.pricing_plans...');
    const existingPlans = await pool.query(`
      SELECT id, package_name, price, tokens, duration_days, features,
             popular, is_active, sort_order
      FROM pricing_plans
      WHERE is_active = true
      ORDER BY sort_order ASC
    `);

    console.log(`   Found ${existingPlans.rows.length} active plans\n`);

    // 3. Check if CMS already has plans
    const cmsPlans = await pool.query(`
      SELECT COUNT(*) as count FROM payload.pricing_plans WHERE "isActive" = true
    `);
    const cmsCount = parseInt(cmsPlans.rows[0]?.count || '0');
    console.log(`3. CMS already has ${cmsCount} active plans\n`);

    if (cmsCount > 0 && existingPlans.rows.length > 0) {
      console.log('   ⚠️  CMS has existing plans. Options:');
      console.log('      - Press Ctrl+C to abort');
      console.log('      - Or this will UPDATE existing plans by slug\n');
    }

    // 4. Migrate each plan
    console.log('4. Migrating plans...\n');

    for (const plan of existingPlans.rows) {
      const slug = plan.package_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const features = typeof plan.features === 'string'
        ? JSON.parse(plan.features)
        : plan.features || [];

      const featuresArray = Array.isArray(features)
        ? features
        : [];

      try {
        // Check if plan exists in CMS
        const existingCms = await pool.query(`
          SELECT id FROM payload.pricing_plans WHERE slug = $1
        `, [slug]);

        if (existingCms.rows.length > 0) {
          // Update existing
          await pool.query(`
            UPDATE payload.pricing_plans SET
              "packageName" = $1,
              price = $2,
              tokens = $3,
              "durationDays" = $4,
              features = $5::jsonb,
              "isActive" = $6,
              "isPopular" = $7,
              "sortOrder" = $8,
              "updatedAt" = NOW()
            WHERE slug = $9
          `, [
            plan.package_name,
            plan.price,
            plan.tokens,
            plan.duration_days,
            JSON.stringify(featuresArray),
            plan.is_active,
            plan.popular || false,
            plan.sort_order || 0,
            slug
          ]);
          console.log(`   ✅ UPDATED: ${plan.package_name} (${slug})`);
        } else {
          // Insert new
          await pool.query(`
            INSERT INTO payload.pricing_plans (
              "packageName", slug, price, tokens, "durationDays",
              features, "isActive", "isPopular", "sortOrder",
              "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, NOW(), NOW())
          `, [
            plan.package_name,
            slug,
            plan.price,
            plan.tokens,
            plan.duration_days,
            JSON.stringify(featuresArray),
            plan.is_active,
            plan.popular || false,
            plan.sort_order || 0
          ]);
          console.log(`   ✅ INSERTED: ${plan.package_name} (${slug})`);
        }
      } catch (insertError) {
        console.log(`   ❌ Failed: ${plan.package_name} - ${insertError.message}`);
      }
    }

    // 5. Verify migration
    console.log('\n5. Verification...\n');
    const verifyPlans = await pool.query(`
      SELECT "packageName", slug, price, tokens, "durationDays", "isPopular", "sortOrder"
      FROM payload.pricing_plans
      WHERE "isActive" = true
      ORDER BY "sortOrder" ASC
    `);

    console.log('   Current CMS Pricing Plans:');
    for (const p of verifyPlans.rows) {
      const badge = p.isPopular ? '🔥 POPULAR' : '';
      console.log(`   - ${p.packageName} | Rp ${Number(p.price).toLocaleString()} | ${p.tokens} tokens | ${p.durationDays} hari ${badge}`);
    }

    console.log('\n=== MIGRATION COMPLETE ===');

  } catch (e) {
    console.error('Migration failed:', e);
  }

  await pool.end();
}

migratePricingToCMS().catch(e => {
  console.error(e);
  process.exit(1);
});
