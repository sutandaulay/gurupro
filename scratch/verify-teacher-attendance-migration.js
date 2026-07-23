const { Client } = require('pg');

async function verifyTeacherAttendanceMigration() {
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
      WHERE table_name = 'teacher_attendance'
      ORDER BY ordinal_position
    `);
    console.log('teacher_attendance columns:', cols.rows);
  } catch (err) {
    console.error('Verification failed:', err.message);
  } finally {
    await client.end();
  }
}

verifyTeacherAttendanceMigration();
