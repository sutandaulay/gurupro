const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';

// Tables to KEEP (not user/school/student data)
const KEEP_TABLES = new Set([
  'public.system_settings',
  'public.cms_landing',
  'public.landing_page_settings',
  'public.hero_sections',
  'public.features',
  'public.pricing_plans',
  'public.addon_token_packages',
  'public.tahun_ajaran',
  'public.indikator_kinerja_config',
]);

const client = new Client({
  connectionString: DATABASE_URL,
});

async function main() {
  await client.connect();
  console.log('Connected to database.');

  // Fetch all tables
  const allTables = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'payload')
      AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
  `);

  const tablesToTruncate = [];
  for (const row of allTables.rows) {
    const fullName = `${row.table_schema}.${row.table_name}`;
    if (!KEEP_TABLES.has(fullName)) {
      tablesToTruncate.push(fullName);
    }
  }

  console.log(`Tables to truncate (${tablesToTruncate.length}):`);
  tablesToTruncate.forEach(t => console.log(`  - ${t}`));

  // Delete non-admin users first (keep admin/superadmin)
  console.log('\nDeleting non-admin users...');
  await client.query(`DELETE FROM public.users WHERE role NOT IN ('admin', 'superadmin')`);
  const { rows: userCount } = await client.query(`SELECT COUNT(*) as cnt FROM public.users`);
  console.log(`Remaining users: ${userCount[0].cnt} (admins kept)`);

  // Truncate schools (all of them — admins kept via users table)
  console.log('\nTruncating schools...');
  await client.query('TRUNCATE TABLE public.schools CASCADE');
  console.log('TRUNCATED: public.schools');

  // Disable FK checks, truncate rest, re-enable
  await client.query('SET session_replication_role = replica');
  console.log('FK checks disabled.');

  for (const table of tablesToTruncate) {
    // Skip users & schools — already handled above
    if (table === 'public.users' || table === 'public.schools') continue;
    try {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`TRUNCATED: ${table}`);
    } catch (e) {
      // Skip "table does not exist" errors
      if (e.code === '42P01') {
        console.log(`SKIPPED (not exists): ${table}`);
      } else {
        console.error(`ERROR: ${table} — ${e.message}`);
      }
    }
  }

  await client.query('SET session_replication_role = DEFAULT');
  console.log('FK checks re-enabled.');

  // Verification
  console.log('\n--- Verification ---');
  for (const row of allTables.rows) {
    const fullName = `${row.table_schema}.${row.table_name}`;
    const { rows } = await client.query(`SELECT COUNT(*) as cnt FROM ${fullName}`);
    const cnt = rows[0].cnt;
    const kept = KEEP_TABLES.has(fullName) ? ' [KEPT]' : '';
    console.log(`  ${fullName}: ${cnt} rows${kept}`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
