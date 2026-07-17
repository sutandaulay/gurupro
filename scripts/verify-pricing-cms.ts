/**
 * Verify Pricing Plans CMS Integration
 * Run: npx tsx scripts/verify-pricing-cms.ts
 */

import { pool } from "../lib/db";

async function verifyPricingCMS() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        PRICING PLANS CMS INTEGRATION VERIFICATION      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let allPassed = true;

  // 1. Check Payload CMS table
  console.log('📋 1. Payload CMS Table\n');
  try {
    const check = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'payload' AND table_name = 'pricing_plans'
    `);
    const cols = check.rows.map(r => r.column_name);
    console.log(`   ✅ Table exists with ${cols.length} columns`);
    console.log(`   Columns: ${cols.join(', ')}`);
  } catch (e: any) {
    console.log(`   ❌ Table not found: ${e.message}`);
    allPassed = false;
  }

  // 2. Check data in CMS
  console.log('\n📋 2. CMS Pricing Plans Data\n');
  try {
    const plans = await pool.query(`
      SELECT "packageName", slug, price, tokens, "isPopular", "sortOrder"
      FROM payload.pricing_plans
      WHERE "isActive" = true
      ORDER BY "sortOrder" ASC
    `);

    if (plans.rows.length === 0) {
      console.log('   ⚠️  No active plans in CMS');
    } else {
      console.log(`   ✅ ${plans.rows.length} active plans:\n`);
      for (const p of plans.rows) {
        const badge = p.isPopular ? ' 🔥 POPULAR' : '';
        console.log(`      • ${p.packageName}: Rp ${Number(p.price).toLocaleString()} | ${p.tokens} tokens${badge}`);
      }
    }
  } catch (e: any) {
    console.log(`   ❌ Query failed: ${e.message}`);
    allPassed = false;
  }

  // 3. Check public pricing_plans (fallback)
  console.log('\n📋 3. Public pricing_plans (Fallback)\n');
  try {
    const publicPlans = await pool.query(`
      SELECT package_name, price, tokens, popular
      FROM pricing_plans
      WHERE is_active = true
      ORDER BY sort_order ASC
    `);
    console.log(`   ℹ️  ${publicPlans.rows.length} plans in public table (fallback)`);
  } catch (e: any) {
    console.log(`   ⚠️  Public table error: ${e.message}`);
  }

  // 4. Check code changes
  console.log('\n📋 4. Code Integration\n');

  const fs = await import('fs');
  const path = await import('path');

  // Check landing page
  const landingPage = fs.readFileSync(
    path.join(process.cwd(), 'app/(app)/(landing)/page.tsx'),
    'utf-8'
  );
  const hasPayloadImport = landingPage.includes("getPayload");
  const hasPricingPlans = landingPage.includes('pricing-plans');

  console.log(`   ${hasPayloadImport ? '✅' : '❌'} Landing page imports Payload`);
  console.log(`   ${hasPricingPlans ? '✅' : '❌'} Landing page queries pricing-plans collection`);

  if (!hasPayloadImport || !hasPricingPlans) allPassed = false;

  // Check API
  const pricingApi = fs.readFileSync(
    path.join(process.cwd(), 'app/api/pricing/route.ts'),
    'utf-8'
  );
  const apiHasPayload = pricingApi.includes("getPayload");
  const apiHasCms = pricingApi.includes('pricing-plans');

  console.log(`   ${apiHasPayload ? '✅' : '❌'} Pricing API imports Payload`);
  console.log(`   ${apiHasCms ? '✅' : '❌'} Pricing API queries pricing-plans collection`);

  if (!apiHasPayload || !apiHasCms) allPassed = false;

  // Check collection file
  const collectionExists = fs.existsSync(
    path.join(process.cwd(), 'collections/PricingPlans.ts')
  );
  console.log(`   ${collectionExists ? '✅' : '❌'} PricingPlans collection defined`);

  if (!collectionExists) allPassed = false;

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        SUMMARY                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (allPassed) {
    console.log('  ✅ ALL CHECKS PASSED');
    console.log('\n  Pricing Plans source of truth:');
    console.log('  1. Payload CMS → payload.pricing_plans');
    console.log('  2. Fallback → public.pricing_plans');
    console.log('  3. Hardcoded defaults');
    console.log('\n  Admin URL: http://localhost:3000/admin/pricing-plans');
  } else {
    console.log('  ⚠️  SOME CHECKS FAILED');
  }

  console.log('\n');

  await pool.end();
}

verifyPricingCMS().catch(e => {
  console.error(e);
  process.exit(1);
});
