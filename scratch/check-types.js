const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'gurupro_db',
  password: 'nus4nt4r4',
  port: 5432,
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT table_schema, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'institution_members' AND column_name = 'id'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
