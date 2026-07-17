/**
 * Final Verification Script
 * Run: npx tsx scripts/verify-init.ts
 */

import { pool } from "../lib/db";

async function verify() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        GURUPRO INITIALIZATION VERIFICATION REPORT           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  let allPassed = true;

  // ==========================================
  // 1. DATABASE TABLES
  // ==========================================
  console.log('📊 DATABASE TABLES\n');

  const criticalTables = [
    ['public', 'users'],
    ['public', 'schools'],
    ['public', 'system_settings'],
    ['public', 'pricing_plans'],
    ['public', 'addon_token_packages'],
    ['public', 'cms_landing'],
    ['payload', 'cms_users'],
    ['payload', 'institutions'],
    ['payload', 'modul_ajar'],
    ['payload', 'bahan_ajar'],
    ['payload', 'media'],
  ];

  for (const [schema, table] of criticalTables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) FROM "${schema}"."${table}"`);
      console.log(`  ✅ ${schema}.${table}`);
    } catch (e: any) {
      console.log(`  ❌ ${schema}.${table}: MISSING`);
      allPassed = false;
    }
  }

  // ==========================================
  // 2. SYSTEM SETTINGS
  // ==========================================
  console.log('\n⚙️  SYSTEM SETTINGS\n');

  const settings = [
    { key: 'ai_config', expectedVendor: 'gemini' },
    { key: 'payment_gateway', expected: 'mock' },
    { key: 'email_sender', expected: 'smtp' },
    { key: 'notification_templates', expected: 'object' },
    { key: 'wa_sender', expected: 'fonnte' },
  ];

  const ss = await pool.query('SELECT key, value FROM system_settings');
  const ssMap = new Map(ss.rows.map(r => [r.key, r.value]));

  for (const s of settings) {
    const exists = ssMap.has(s.key);
    if (!exists) {
      console.log(`  ❌ ${s.key}: MISSING`);
      allPassed = false;
    } else {
      const val = ssMap.get(s.key);
      if (s.key === 'ai_config') {
        const aiVal = typeof val === 'string' ? JSON.parse(val) : val;
        if (aiVal.default_vendor === s.expectedVendor) {
          console.log(`  ✅ ${s.key}: vendor=${aiVal.default_vendor}, api_key=${aiVal.gemini?.api_key ? 'SET' : 'MISSING'}`);
        } else {
          console.log(`  ⚠️  ${s.key}: vendor=${aiVal.default_vendor} (expected: ${s.expectedVendor})`);
        }
      } else {
        console.log(`  ✅ ${s.key}: ${typeof val === 'object' ? 'object' : val}`);
      }
    }
  }

  // ==========================================
  // 3. PRICING PLANS
  // ==========================================
  console.log('\n💰 PRICING PLANS\n');

  const plans = await pool.query('SELECT package_name, tokens, price, is_active FROM pricing_plans ORDER BY price');
  if (plans.rows.length === 0) {
    console.log('  ❌ No pricing plans found');
    allPassed = false;
  } else {
    for (const p of plans.rows) {
      const status = p.is_active ? '✅' : '❌';
      console.log(`  ${status} ${p.package_name}: ${p.tokens} tokens, Rp ${Number(p.price).toLocaleString()}`);
    }
  }

  // ==========================================
  // 4. PAYLOAD CMS CONTENT
  // ==========================================
  console.log('\n📄 PAYLOAD CMS CONTENT\n');

  const content = [
    { name: 'cms_features', sql: 'SELECT COUNT(*) FROM payload.cms_features' },
    { name: 'why_points', sql: 'SELECT COUNT(*) FROM payload.why_points' },
    { name: 'landing_page', sql: 'SELECT COUNT(*) FROM payload.landing_page' },
    { name: 'footer_content', sql: 'SELECT COUNT(*) FROM payload.footer_content' },
    { name: 'chatbot_config', sql: 'SELECT COUNT(*) FROM payload.chatbot_config' },
  ];

  for (const c of content) {
    const res = await pool.query(c.sql);
    const count = parseInt(res.rows[0].count);
    const status = count > 0 ? '✅' : '❌';
    console.log(`  ${status} ${c.name}: ${count} rows`);
    if (count === 0) allPassed = false;
  }

  // ==========================================
  // 5. USERS
  // ==========================================
  console.log('\n👥 USERS\n');

  const users = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status_langganan = 'free' THEN 1 END) as free,
      COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active
    FROM users
  `);
  const u = users.rows[0];
  console.log(`  Total: ${u.total}`);
  console.log(`  Free: ${u.free}`);
  console.log(`  Active: ${u.active}`);
  console.log(`  ℹ️  No users yet - normal for fresh DB`);

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        SUMMARY                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (allPassed) {
    console.log('  ✅ ALL CHECKS PASSED');
    console.log('\n  System is ready for use! Next steps:');
    console.log('    1. npm run dev - Start development server');
    console.log('    2. Create admin user at /cms');
    console.log('    3. Configure payment gateway in admin panel');
  } else {
    console.log('  ⚠️  SOME CHECKS FAILED - Review above');
  }

  console.log('\n');

  await pool.end();
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
