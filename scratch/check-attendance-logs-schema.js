const { Client } = require('pg');

async function checkAttendanceLogsSchema() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'nus4nt4r4',
    database: 'gurupro_db',
  });

  try {
    await client.connect();

    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'attendance_logs'
      ORDER BY ordinal_position
    `);
    console.log('attendance_logs columns:', cols.rows);

    const sample = await client.query(`
      SELECT * FROM attendance_logs
      LIMIT 3
    `);
    console.log('attendance_logs sample:', sample.rows);
  } catch (err) {
    console.error('Check failed:', err.message);
  } finally {
    await client.end();
  }
}

checkAttendanceLogsSchema();
