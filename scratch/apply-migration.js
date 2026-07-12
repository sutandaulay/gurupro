const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db'
});

async function main() {
  await client.connect();
  console.log("Connected to database.");

  const sqlPath = path.resolve(__dirname, 'migration.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  console.log("Applying migration SQL...");
  await client.query(sqlContent);
  console.log("Migration applied successfully!");

  await client.end();
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
