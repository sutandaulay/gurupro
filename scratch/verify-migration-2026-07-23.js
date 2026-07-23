const { Client } = require('pg');

async function verifyMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'nus4nt4r4',
    database: 'gurupro_db',
  });

  try {
    await client.connect();

    // Check schools columns
    const schoolsCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'schools'
        AND column_name IN ('location_latitude', 'location_longitude', 'attendance_radius_meters')
    `);
    console.log('Schools columns:', schoolsCols.rows);

    // Check duty_assignments table
    const dutyTable = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'duty_assignments'
      ORDER BY ordinal_position
    `);
    console.log('Duty assignments columns:', dutyTable.rows);

    // Check indexes
    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('schools', 'duty_assignments')
    `);
    console.log('Indexes:', indexes.rows);
  } catch (err) {
    console.error('Verification failed:', err.message);
  } finally {
    await client.end();
  }
}

verifyMigration();
