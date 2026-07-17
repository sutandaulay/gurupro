-- ==========================================
-- MIGRATION: 09_add_siswa_id_to_kontak_eksternal
-- Purpose: Tambah siswa_id ke kontak_eksternal_raport
-- agar orang tua hanya melihat data anaknya sendiri
-- Date: 2026-07-16
-- ==========================================

BEGIN;

ALTER TABLE kontak_eksternal_raport
  ADD COLUMN IF NOT EXISTS siswa_id UUID REFERENCES students(id);

CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_raport_siswa
  ON kontak_eksternal_raport (siswa_id);

COMMENT ON COLUMN kontak_eksternal_raport.siswa_id
  IS 'Siswa yang raportnya dibagikan ke kontak eksternal ini';

COMMIT;
