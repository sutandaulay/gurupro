const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'nus4nt4r4',
    database: 'gurupro_db',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const sqlPath = 'D:\\gurupro\\prisma\\migrations\\2026_07_23_add_schools_coordinates_and_duty_assignments\\migration.sql';
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
