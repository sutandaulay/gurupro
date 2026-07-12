-- Migration: Create wali_kelas_assignments table
-- Purpose: Manage homeroom teacher (wali kelas) assignments per class per academic period
-- Created: 2026-07-10

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- Table: wali_kelas_assignments
-- =====================================================
CREATE TABLE IF NOT EXISTS wali_kelas_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  wali_kelas_member_id UUID NOT NULL, -- references institution-members.id (Payload), validated at application layer
  tahun_ajaran VARCHAR(9) NOT NULL, -- format "2025/2026"
  semester VARCHAR(6) NOT NULL CHECK (semester IN ('ganjil', 'genap')),
  status VARCHAR(10) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  ditugaskan_pada TIMESTAMP NOT NULL DEFAULT now(),
  ditugaskan_oleh UUID, -- cms-users.id of admin who assigned
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- =====================================================
-- Indexes for common query patterns
-- =====================================================

-- Index for querying active assignments by class and period
CREATE INDEX IF NOT EXISTS idx_wali_kelas_kelas_periode
  ON wali_kelas_assignments (kelas_id, tahun_ajaran, semester)
  WHERE status = 'aktif';

-- Index for querying assignments by teacher
CREATE INDEX IF NOT EXISTS idx_wali_kelas_guru
  ON wali_kelas_assignments (wali_kelas_member_id, tahun_ajaran, semester)
  WHERE status = 'aktif';

-- Index for listing all assignments by period
CREATE INDEX IF NOT EXISTS idx_wali_kelas_periode
  ON wali_kelas_assignments (tahun_ajaran, semester)
  WHERE status = 'aktif';

-- =====================================================
-- Constraints
-- =====================================================

-- Unique constraint: only 1 active assignment per class per period
-- This ensures a class can't have multiple active homeroom teachers simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wali_kelas_aktif
  ON wali_kelas_assignments (kelas_id, tahun_ajaran, semester)
  WHERE status = 'aktif';

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE wali_kelas_assignments IS 'Relasi wali kelas ke kelas per periode ajaran';
COMMENT ON COLUMN wali_kelas_assignments.kelas_id IS 'Foreign key ke tabel classes (app-side PostgreSQL)';
COMMENT ON COLUMN wali_kelas_assignments.wali_kelas_member_id IS 'Foreign key ke institution-members.id (Payload collection), divalidasi di application layer';
COMMENT ON COLUMN wali_kelas_assignments.tahun_ajaran IS 'Format: YYYY/YYYY, contoh: 2025/2026';
COMMENT ON COLUMN wali_kelas_assignments.semester IS 'Nilai: ganjil atau genap';
COMMENT ON COLUMN wali_kelas_assignments.status IS 'Status assignment: aktif (saat ini mengajar) atau nonaktif (historikal)';
COMMENT ON COLUMN wali_kelas_assignments.ditugaskan_pada IS 'Timestamp kapan assignment dibuat';
COMMENT ON COLUMN wali_kelas_assignments.ditugaskan_oleh IS 'ID user yang menugaskan (cms-users), untuk audit trail';

-- =====================================================
-- Function: Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_wali_kelas_assignments_updated_at ON wali_kelas_assignments;
CREATE TRIGGER update_wali_kelas_assignments_updated_at
  BEFORE UPDATE ON wali_kelas_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
