import 'dotenv/config';
import { Pool } from 'pg';

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
    const fk = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as def, convalidated
      FROM pg_constraint
      WHERE conrelid = 'teacher_library_progress'::regclass AND contype = 'f'
    `);
    console.log('=== FK CONSTRAINT ===');
    console.log(JSON.stringify(fk.rows, null, 2));

    // 2. Orphan count
    const orphan = await pool.query(`
      SELECT count(*) as orphan_count
      FROM teacher_library_progress p
      LEFT JOIN library_items i ON p.item_id = i.id
      WHERE i.id IS NULL
    `);
    console.log('\n=== ORPHAN COUNT ===');
    console.log(orphan.rows);

    // 3. Orphan details
    const orphans = await pool.query(`
      SELECT p.teacher_id, p.item_id, p.updated_at
      FROM teacher_library_progress p
      LEFT JOIN library_items i ON p.item_id = i.id
      WHERE i.id IS NULL
      ORDER BY p.updated_at DESC
      LIMIT 20
    `);
    console.log('\n=== ORPHAN DETAILS ===');
    console.log(JSON.stringify(orphans.rows, null, 2));

    // 4. Cleanup orphan
    const cleanup = await pool.query(`
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
    console.log('Deleted:', cleanup.rowCount);

    // 5. Verify cleanup
    const afterCleanup = await pool.query(`
      SELECT count(*) as orphan_count
      FROM teacher_library_progress p
      LEFT JOIN library_items i ON p.item_id = i.id
      WHERE i.id IS NULL
    `);
    console.log('\n=== AFTER CLEANUP ===');
    console.log(orphan.rows);

    // 6. Table sizes
    const totalProgress = await pool.query(`SELECT count(*) FROM teacher_library_progress`);
    const totalItems = await pool.query(`SELECT count(*) FROM library_items`);
    console.log('\n=== TABLE SIZES ===');
    console.log('teacher_library_progress:', totalProgress.rows[0].count);
    console.log('library_items:', totalItems.rows[0].count);

  } catch (e: any) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
})();
