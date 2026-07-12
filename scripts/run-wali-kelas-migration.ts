/**
 * Script: Run SQL Migration for File 01
 * Usage: npx ts-node scripts/run-migration.ts
 *
 * This script reads and executes the migration SQL file directly.
 * Alternative: The migration is also auto-run via initDb() in lib/db.ts
 */

import { pool } from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('Starting migration for File 01: wali_kelas_assignments...');

  try {
    // Read migration file
    const migrationPath = join(process.cwd(), 'migrations', '03_create_wali_kelas_assignments.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Executing migration SQL...');
    await pool.query(sql);

    console.log('Migration completed successfully!');
  } catch (error: any) {
    if (error.code === '42P07' || error.message.includes('already exists')) {
      console.log('Table already exists, skipping...');
    } else {
      console.error('Migration failed:', error);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
