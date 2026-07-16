const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'gurupro_db',
    user: 'postgres',
    password: 'nus4nt4r4',
  });

  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('Connected!');

    console.log('Dropping schema "public" with CASCADE to delete all tables...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    console.log('Schema "public" dropped.');

    console.log('Re-creating schema "public"...');
    await client.query('CREATE SCHEMA public;');
    console.log('Schema "public" re-created.');

    console.log('Granting permissions...');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');

    console.log('Creating extension "uuid-ossp"...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;');
    console.log('Extension "uuid-ossp" created/verified successfully!');

    console.log('Creating extension "pgcrypto" (for gen_random_uuid)...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;');
    console.log('Extension "pgcrypto" created/verified successfully!');

    console.log('Database reset to clean slate with extensions enabled!');
  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await client.end();
  }
}

run();
