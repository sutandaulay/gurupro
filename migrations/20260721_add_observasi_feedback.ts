/**
 * Migration: guru_observasi + ks_feedback
 *
 * Tambah 2 tabel untuk Tahap 5 (Review Proses Mengajar Guru):
 * - guru_observasi: observasi kelas oleh KS/Wakasek ke guru
 * - ks_feedback: catatan/feedback KS ke guru per aspek
 *
 * Run: npx tsx migrations/20260721_add_observasi_feedback.ts up
 */

import { query } from '@/lib/db'

async function up() {
  // guru_observasi
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'guru_observasi') THEN
        CREATE TABLE guru_observasi (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          institution_id INTEGER NOT NULL,
          guru_id VARCHAR(255) NOT NULL,
          guru_nama VARCHAR(255),
          observer_id VARCHAR(255) NOT NULL,
          observer VARCHAR(255),
          tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
          skor DECIMAL(5,2) CHECK (skor >= 0 AND skor <= 100),
          aspek VARCHAR(100) DEFAULT 'kelas',
          catatan TEXT,
          status VARCHAR(50) DEFAULT 'done',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX idx_guru_observasi_institution ON guru_observasi(institution_id);
        CREATE INDEX idx_guru_observasi_guru ON guru_observasi(guru_id);
        CREATE INDEX idx_guru_observasi_tanggal ON guru_observasi(tanggal DESC);
      END IF;
    END $$;
  `)

  // ks_feedback
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'ks_feedback') THEN
        CREATE TABLE ks_feedback (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          institution_id INTEGER NOT NULL,
          guru_id VARCHAR(255) NOT NULL,
          guru_nama VARCHAR(255),
          ks_id VARCHAR(255) NOT NULL,
          ks_nama VARCHAR(255),
          tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
          jenis VARCHAR(50) DEFAULT 'proses',
          judul VARCHAR(255),
          isi TEXT,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX idx_ks_feedback_institution ON ks_feedback(institution_id);
        CREATE INDEX idx_ks_feedback_guru ON ks_feedback(guru_id);
        CREATE INDEX idx_ks_feedback_ks ON ks_feedback(ks_id);
      END IF;
    END $$;
  `)

  console.log('Migration complete: guru_observasi + ks_feedback tables created')
}

async function down() {
  await query(`DROP TABLE IF EXISTS guru_observasi`)
  await query(`DROP TABLE IF EXISTS ks_feedback`)
  console.log('Rollback complete: guru_observasi + ks_feedback tables dropped')
}

const action = process.argv[2] || 'up'
if (action === 'up') {
  up().catch(console.error)
} else if (action === 'down') {
  down().catch(console.error)
} else {
  console.log('Usage: tsx migrations/20260721_add_observasi_feedback.ts up|down')
}
