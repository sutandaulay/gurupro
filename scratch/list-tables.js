const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db'
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log("=== TABLES IN DATABASE ===");
  console.log(res.rows.map(r => r.table_name));
  await client.end();
}

main().catch(console.error);
