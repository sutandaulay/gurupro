// Backfill user_id in public.institution_members from payload.cms_users
// Runs once. Run: node scripts/backfill-member-user-id.cjs

const { Client } = require('pg');
const c = new Client({ user: 'postgres', password: 'nus4nt4r4', host: 'localhost', database: 'gurupro_db', port: 5432 });
async function run() {
  await c.connect();
  try {
    // Check if public.institution_members has user_id column
    const cols = await c.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='institution_members'"
    );
    const hasUserId = cols.rows.some(r => r.column_name === 'user_id');
    if (!hasUserId) {
      console.log('Adding user_id column to public.institution_members...');
      await c.query('ALTER TABLE public.institution_members ADD COLUMN user_id INTEGER');
      console.log('Column added.');
    }

    // Check payload.cms_users columns
    const cmsCols = await c.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='payload' AND table_name='cms_users'"
    );
    console.log('cms_users columns:', cmsCols.rows.map(r => r.column_name));

    // Check if cms_users has app_user_id
    const hasAppUserId = cmsCols.rows.some(r => r.column_name === 'app_user_id');
    if (!hasAppUserId) {
      console.log('ERROR: payload.cms_users does not have app_user_id column');
      return;
    }

    // Backfill
    const result = await c.query(`
      UPDATE public.institution_members im
      SET user_id = cu.id::integer
      FROM payload.cms_users cu
      WHERE im.app_user_id = cu.app_user_id
        AND im.user_id IS NULL
      RETURNING im.id, im.app_user_id, cu.id as cms_user_id
    `);
    console.log(`Backfilled ${result.rowCount} rows:`);
    result.rows.forEach(r => console.log(`  member ${r.id} (${r.app_user_id}) -> cms_user_id ${r.cms_user_id}`));

    // Report remaining NULL user_ids
    const nulls = await c.query(
      "SELECT id, app_user_id, user_id FROM public.institution_members WHERE user_id IS NULL"
    );
    if (nulls.rowCount > 0) {
      console.log(`\nWarning: ${nulls.rowCount} members still have NULL user_id (no matching cms_users record):`);
      nulls.rows.forEach(r => console.log(`  member ${r.id} (${r.app_user_id})`));
    }

    console.log('\nDone!');
  } finally {
    await c.end();
  }
}
run().catch(e => console.error('Error:', e.message));
