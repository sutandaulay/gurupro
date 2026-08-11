/**
 * Migration: Add sub-role fields to institution_members
 *
 * Adds:
 * - sub_role: sub-role tambahan (wali_kelas, pembina_ekskul)
 * - wali_kelas_of: nama kelas untuk Wali Kelas
 * - ekskul_name: nama ekskul untuk Pembina Ekskul
 *
 * Also adds new role options: wali_kelas, pembina_ekskul
 *
 * Payload CMS auto-syncs collection fields on startup.
 * This migration is a fallback for direct SQL access.
 *
 * Run: npx tsx migrations/20260720_add_sub_role_fields.ts
 */

import { query } from '@/lib/db'

async function up() {
  // Add sub_role column
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'institution_members' AND column_name = 'sub_role') THEN
        ALTER TABLE institution_members ADD COLUMN sub_role VARCHAR(50);
      END IF;
    END $$;
  `)

  // Add wali_kelas_of column
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'institution_members' AND column_name = 'wali_kelas_of') THEN
        ALTER TABLE institution_members ADD COLUMN wali_kelas_of VARCHAR(100);
      END IF;
    END $$;
  `)

  // Add ekskul_name column
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'institution_members' AND column_name = 'ekskul_name') THEN
        ALTER TABLE institution_members ADD COLUMN ekskul_name VARCHAR(200);
      END IF;
    END $$;
  `)

  console.log('Migration complete: sub_role, wali_kelas_of, ekskul_name added to institution_members')
}

async function down() {
  await query(`ALTER TABLE institution_members DROP COLUMN IF EXISTS sub_role`)
  await query(`ALTER TABLE institution_members DROP COLUMN IF EXISTS wali_kelas_of`)
  await query(`ALTER TABLE institution_members DROP COLUMN IF EXISTS ekskul_name`)
  console.log('Rollback complete: sub_role fields removed from institution_members')
}

const action = process.argv[2] || 'up'
if (action === 'up') {
  up().catch(console.error)
} else if (action === 'down') {
  down().catch(console.error)
} else {
  console.log('Usage: tsx migrations/20260720_add_sub_role_fields.ts [up|down]')
}
