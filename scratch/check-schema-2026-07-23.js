const { Client } = require('pg');

async function checkSchema() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'nus4nt4r4',
    database: 'gurupro_db',
  });

  try {
    await client.connect();

    // Check attendance_logs institution_id type
    const logsCol = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'attendance_logs' AND column_name = 'institution_id'
    `);
    console.log('attendance_logs.institution_id:', logsCol.rows);

    // Check attendance_summary institution_id type
    const summaryCol = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'attendance_summary' AND column_name = 'institution_id'
    `);
    console.log('attendance_summary.institution_id:', summaryCol.rows);

    // Check schools id type
    const schoolsId = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'schools' AND column_name = 'id'
    `);
    console.log('schools.id:', schoolsId.rows);

    // Check a sample school record
    const schoolSample = await client.query(`
      SELECT id, nama_sekolah, location_latitude, location_longitude, attendance_radius_meters
      FROM schools
      LIMIT 1
    `);
    console.log('school sample:', schoolSample.rows);
  } catch (err) {
    console.error('Schema check failed:', err.message);
  } finally {
    await client.end();
  }
}

checkSchema();
