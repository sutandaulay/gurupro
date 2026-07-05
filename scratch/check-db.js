const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db"
});

async function check() {
  await client.connect();
  
  const docs = await client.query("SELECT * FROM dokumen_bukti ORDER BY created_at DESC LIMIT 5");
  console.log("=== DOKUMEN BUKTI ===");
  console.log(docs.rows);

  const pelatihans = await client.query("SELECT * FROM pelatihan_guru ORDER BY updated_at DESC LIMIT 5");
  console.log("=== PELATIHAN GURU ===");
  console.log(pelatihans.rows);

  const users = await client.query("SELECT id, name, email, role FROM users LIMIT 10");
  console.log("=== USERS ===");
  console.log(users.rows);

  await client.end();
}

check().catch(console.error);
