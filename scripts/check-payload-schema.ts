/**
 * Direct Payload Schema Check via Database
 * Run: npx tsx scripts/check-payload-schema.ts
 */

import { pool, query } from "../lib/db";

async function checkPayloadSchema() {
  console.log('=== PAYLOAD SCHEMA CHECK ===\n');

  try {
    // Check payload schema exists
    const schemaExists = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.schemata
        WHERE schema_name = 'payload'
      ) as exists
    `);
    console.log(`Payload schema: ${schemaExists.rows[0].exists ? '✅ EXISTS' : '❌ MISSING'}`);

    if (!schemaExists.rows[0].exists) {
      console.log('\n❌ Payload schema does not exist!');
      console.log('Need to run: npx payload push');
      console.log('\nAlternative: Start dev server which auto-pushes schema on first run.');
      await pool.end();
      return;
    }

    // List all tables in payload schema
    console.log('\n📊 Tables in payload schema:');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'payload'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    if (tables.rows.length === 0) {
      console.log('  ⚠️ No tables found in payload schema');
      console.log('\n  Need to run: npx payload push');
    } else {
      console.log(`  Found ${tables.rows.length} tables:\n`);
      for (const t of tables.rows) {
        const count = await pool.query(`SELECT COUNT(*) FROM payload."${t.table_name}"`);
        console.log(`    - ${t.table_name}: ${count.rows[0].count} rows`);
      }
    }

    // Check for expected collections
    console.log('\n📋 Expected Collections:');
    const expectedCollections = [
      'cms_users',
      'institutions',
      'institution_members',
      'modul_ajar',
      'bahan_ajar',
      'silabus',
      'lkpd',
      'media',
      'features',
      'why_points',
      'categories',
      'posts',
      'landing_page',
      'footer_content',
      'chatbot_config',
      'leader_contacts',
      'performance_share_links',
      'document_access_grants',
      'otp_verifications',
      'invitations',
      'teacher_institution_assignments',
      'attendance_devices',
      'attendance_logs',
      'attendance_summary',
      'leave_requests',
    ];

    const existingTables = tables.rows.map(t => t.table_name);

    for (const coll of expectedCollections) {
      const exists = existingTables.includes(coll);
      console.log(`  ${exists ? '✅' : '❌'} ${coll}`);
    }

    console.log('\n=== CHECK COMPLETE ===');

  } catch (e) {
    console.error('Error:', e);
  }

  await pool.end();
}

checkPayloadSchema().catch((e) => {
  console.error(e);
  process.exit(1);
});
