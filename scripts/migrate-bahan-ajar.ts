/**
 * Migration script for BahanAjar collection
 * Run with: npx tsx scripts/migrate-bahan-ajar.ts
 *
 * This creates the bahan_ajar table with required fields for the AI teaching materials generator.
 *
 * Note:
 * - Uses integer FK to cms_users (matching Payload's default id type)
 * - modul_ajar_id is nullable until ModulAjar collection is created
 */

import pg from 'pg'

const { Pool } = pg

async function migrate() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db",
  })

  try {
    console.log('Checking if modul_ajar table exists...')

    // Check if modul_ajar exists
    const modulAjarCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'payload'
        AND table_name = 'modul_ajar'
      );
    `)

    const modulAjarExists = modulAjarCheck.rows[0]?.exists || false

    if (!modulAjarExists) {
      console.log('WARNING: modul_ajar table does not exist. Creating bahan_ajar with nullable modul_ajar_id...')

      await pool.query(`
        CREATE TABLE IF NOT EXISTS "payload".bahan_ajar (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          modul_ajar_id INTEGER,
          guru_id INTEGER NOT NULL REFERENCES "payload".cms_users(id) ON DELETE CASCADE,
          jenis_kurikulum VARCHAR(50) NOT NULL DEFAULT 'kurikulum_merdeka',
          standar_acuan_version TEXT DEFAULT 'Permendikdasmen No. 1/2026',
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          slides_outline JSONB,
          lkpd JSONB,
          handout JSONB,
          compliance_checklist JSONB,
          token_cost INTEGER,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `)
    } else {
      console.log('Creating bahan_ajar table with modul_ajar FK...')

      await pool.query(`
        CREATE TABLE IF NOT EXISTS "payload".bahan_ajar (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          modul_ajar_id INTEGER NOT NULL REFERENCES "payload".modul_ajar(id) ON DELETE CASCADE,
          guru_id INTEGER NOT NULL REFERENCES "payload".cms_users(id) ON DELETE CASCADE,
          jenis_kurikulum VARCHAR(50) NOT NULL DEFAULT 'kurikulum_merdeka',
          standar_acuan_version TEXT DEFAULT 'Permendikdasmen No. 1/2026',
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          slides_outline JSONB,
          lkpd JSONB,
          handout JSONB,
          compliance_checklist JSONB,
          token_cost INTEGER,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `)
    }

    // Create indexes
    console.log('Creating indexes...')
    await pool.query(`
      CREATE INDEX IF NOT EXISTS bahan_ajar_guru_id_idx ON "payload".bahan_ajar(guru_id);
      CREATE INDEX IF NOT EXISTS bahan_ajar_modul_ajar_id_idx ON "payload".bahan_ajar(modul_ajar_id);
      CREATE INDEX IF NOT EXISTS bahan_ajar_status_idx ON "payload".bahan_ajar(status);
      CREATE INDEX IF NOT EXISTS bahan_ajar_created_at_idx ON "payload".bahan_ajar(created_at);
    `)

    console.log('BahanAjar table migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
