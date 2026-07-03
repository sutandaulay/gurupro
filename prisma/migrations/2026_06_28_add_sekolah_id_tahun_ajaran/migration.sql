-- Add missing columns to tahun_ajaran if not exists
-- Migration: add_sekolah_id_tahun_ajaran

ALTER TABLE tahun_ajaran
  ADD COLUMN IF NOT EXISTS sekolah_id UUID;

ALTER TABLE tahun_ajaran
  ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE tahun_ajaran
  ADD COLUMN IF NOT EXISTS semester_type VARCHAR(20) DEFAULT 'full';

ALTER TABLE tahun_ajaran
  ADD COLUMN IF NOT EXISTS semester VARCHAR(20);

-- Add index for faster lookups by school
CREATE INDEX IF NOT EXISTS idx_tahun_ajaran_sekolah_id ON tahun_ajaran(sekolah_id);
