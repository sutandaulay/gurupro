import { pool } from './lib/db';

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('Tables found:');
    result.rows.forEach((t: any) => console.log(' -', t.table_name));
    console.log('\nTotal:', result.rows.length);
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

checkTables();
