require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const {Pool} = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'gurupro_db',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

(async () => {
  try {
    // 1. FK Constraint check
    const r = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as def, convalidated
      FROM pg_constraint
      WHERE conrelid = 'teacher_library_progress'::regclass AND contype = 'f'
    `);
    console.log('=== FK CONSTRAINT ===');
    console.log(JSON.stringify(r.rows, null, 2));

    // 2. Orphan count
    const o = await pool.query(`
      SELECT count(*)::int as cnt
      FROM teacher_library_progress p
      LEFT JOIN library_items i ON p.item_id = i.id
      WHERE i.id IS NULL
    `);
    console.log('\n=== ORPHAN COUNT ===');
    console.log(o.rows[0]);

    // 3. Orphan details
    if (o.rows[0].cnt > 0) {
      const od = await pool.query(`
        SELECT p.teacher_id, p.item_id, p.updated_at
        FROM teacher_library_progress p
        LEFT JOIN library_items i ON p.item_id = i.id
        WHERE i.id IS NULL
        ORDER BY p.updated_at DESC
        LIMIT 20
      `);
      console.log('\n=== ORPHAN DETAILS ===');
      console.log(JSON.stringify(od.rows, null, 2));
    }

    // 4. Cleanup orphan
    const cl = await pool.query(`
      DELETE FROM teacher_library_progress
      WHERE id IN (
        SELECT p.id
        FROM teacher_library_progress p
        LEFT JOIN library_items i ON p.item_id = i.id
        WHERE i.id IS NULL
        LIMIT 500
      )
    `);
    console.log('\n=== CLEANUP RESULT ===');
    console.log('Deleted:', cl.rowCount);

    // 5. Verify cleanup
    const a = await pool.query(`
      SELECT count(*)::int as cnt
      FROM teacher_library_progress p
      LEFT JOIN library_items i ON p.item_id = i.id
      WHERE i.id IS NULL
    `);
    console.log('\n=== AFTER CLEANUP ===');
    console.log(a.rows[0]);

    // 6. Table sizes
    const t = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM teacher_library_progress) as progress_count,
        (SELECT count(*)::int FROM library_items) as items_count
    `);
    console.log('\n=== TABLE SIZES ===');
    console.log(JSON.stringify(t.rows[0], null, 2));

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
})();
