import { pool } from './lib/db';

async function checkPayloadTables() {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'payload'
      ORDER BY table_name
    `);
    console.log('Tables in payload schema:');
    result.rows.forEach((t: any) => console.log(' -', t.table_name));
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

checkPayloadTables();
