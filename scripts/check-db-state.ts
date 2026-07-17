/**
 * Database State Checker
 * Run: npx tsx scripts/check-db-state.ts
 */

import { pool } from "../lib/db";

async function checkDb() {
  console.log('=== GURUPRO DATABASE STATE CHECK ===\n');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Tables to check (schema, table name)
  const tables = [
    // Public schema
    ['public', 'users'],
    ['public', 'schools'],
    ['public', 'classes'],
    ['public', 'subjects'],
    ['public', 'schedules'],
    ['public', 'students'],
    ['public', 'system_settings'],
    ['public', 'pricing_plans'],
    ['public', 'addon_token_packages'],
    ['public', 'cms_landing'],
    ['public', 'teacher_journals'],
    ['public', 'assessments'],
    ['public', 'student_grades'],
    ['public', 'referrals'],
    ['public', 'teacher_attendance'],
    ['public', 'student_attendance'],
    ['public', 'academic_calendars'],
    ['public', 'wali_kelas_assignments'],
    ['public', 'penilaian_sikap'],
    ['public', 'ekstrakurikuler'],
    ['public', 'template_raport'],
    ['public', 'data_raport'],
    ['public', 'user_face_enrollment'],
    ['public', 'in_app_notifications'],
    ['public', 'audit_trails'],
    ['public', 'transactions'],
    ['public', 'payout_requests'],
    ['public', 'tahun_ajaran'],
    ['public', 'guru_administrasi'],
    // Payload schema
    ['payload', 'cms_users'],
    ['payload', 'institutions'],
    ['payload', 'institution_members'],
    ['payload', 'modul_ajar'],
    ['payload', 'bahan_ajar'],
    ['payload', 'media'],
  ];

  console.log('📊 TABLE STATUS:\n');

  let tablesOk = 0;
  let tablesMissing = 0;

  for (const [schema, table] of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) FROM "${schema}"."${table}"`);
      const count = res.rows[0]?.count ?? '?';
      console.log(`  ✓ ${schema}.${table}: ${count} rows`);
      tablesOk++;
    } catch (e: any) {
      if (e.message.includes('does not exist')) {
        console.log(`  ✗ ${schema}.${table}: TABLE MISSING`);
        tablesMissing++;
      } else {
        console.log(`  ? ${schema}.${table}: ERROR - ${e.message.substring(0, 60)}`);
      }
    }
  }

  console.log(`\n📈 Summary: ${tablesOk} OK, ${tablesMissing} MISSING\n`);

  // Check system_settings content
  console.log('=== SYSTEM SETTINGS ===');
  try {
    const ss = await pool.query('SELECT key FROM system_settings ORDER BY key');
    if (ss.rows.length === 0) {
      console.log('  ⚠️  No system_settings found - NEEDS INITIALIZATION!');
    } else {
      console.log(`  Found ${ss.rows.length} settings:`);
      for (const row of ss.rows) {
        console.log(`    - ${row.key}`);
      }
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // Check pricing_plans
  console.log('\n=== PRICING PLANS ===');
  try {
    const pp = await pool.query('SELECT package_name, tokens, price, is_active FROM pricing_plans');
    if (pp.rows.length === 0) {
      console.log('  ⚠️  No pricing plans - NEEDS SEEDING!');
    } else {
      console.log(`  Found ${pp.rows.length} plans:`);
      for (const row of pp.rows) {
        const status = row.is_active ? '✅' : '❌';
        console.log(`    ${status} ${row.package_name}: ${row.tokens} tokens, Rp ${row.price}`);
      }
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // Check AI config
  console.log('\n=== AI CONFIG ===');
  try {
    const ai = await pool.query("SELECT value FROM system_settings WHERE key = 'ai_config'");
    if (ai.rows.length === 0) {
      console.log('  ⚠️  No AI config - NEEDS SETUP!');
    } else {
      const val = typeof ai.rows[0].value === 'string'
        ? JSON.parse(ai.rows[0].value)
        : ai.rows[0].value;
      console.log(`  Default Vendor: ${val.default_vendor}`);
      console.log(`  Gemini API Key: ${val.gemini?.api_key ? '✅ Set' : '❌ Missing'}`);
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // Check users status
  console.log('\n=== USERS STATUS ===');
  try {
    const users = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN subscription_status = 'grace_period' THEN 1 END) as grace,
        COUNT(CASE WHEN subscription_status = 'locked' THEN 1 END) as locked,
        COUNT(CASE WHEN token_limit IS NULL OR token_limit = 0 THEN 1 END) as no_tokens
      FROM users
    `);
    const r = users.rows[0];
    console.log(`  Total: ${r.total}`);
    console.log(`  Active: ${r.active}, Grace: ${r.grace}, Locked: ${r.locked}`);
    console.log(`  No tokens: ${r.no_tokens}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  console.log('\n=== CHECK COMPLETE ===');

  await pool.end();
}

checkDb().catch((e) => {
  console.error('Check failed:', e);
  pool.end();
  process.exit(1);
});
