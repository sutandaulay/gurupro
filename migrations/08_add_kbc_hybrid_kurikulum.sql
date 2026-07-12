-- ==========================================
-- MIGRATION: 08_add_kbc_hybrid_kurikulum
-- Purpose: Add KBC (Kurikulum Berbasis Cinta/Kemenag) and Hybrid kurikulum options
-- Also add Profil Pelajar Rahmatan Lil Alamin (P2RA) for madrasah
-- Date: 2026-07-11
-- ==========================================

BEGIN;

-- ==========================================
-- 1. Update template_raport.kurikulum CHECK constraint
-- Add 'kbc' (Kurikulum Berbasis Cinta - Kemenag) and 'hybrid' options
-- ==========================================
ALTER TABLE template_raport
  DROP CONSTRAINT IF EXISTS template_raport_kurikulum_check;

ALTER TABLE template_raport
  ADD CONSTRAINT template_raport_kurikulum_check
  CHECK (kurikulum IN ('kurikulum_merdeka', 'k13', 'kbc', 'hybrid'));

-- ==========================================
-- 2. Update template_raport.varian_sikap CHECK constraint
-- Add 'profil_rahmatan_lil_alamin' (P2RA) for KBC madrasah
-- ==========================================
ALTER TABLE template_raport
  DROP CONSTRAINT IF EXISTS template_raport_varian_sikap_check;

ALTER TABLE template_raport
  ADD CONSTRAINT template_raport_varian_sikap_check
  CHECK (varian_sikap IN (
    'profil_pelajar_pancasila',
    'dimensi_profil_lulusan_madrasah',
    'profil_rahmatan_lil_alamin'
  ));

-- ==========================================
-- 3. Update jenis_laporan CHECK constraint
-- Add 'kokurikuler_p2ra' for madrasah project-based co-curricular
-- ==========================================
ALTER TABLE template_raport
  DROP CONSTRAINT IF EXISTS template_raport_jenis_laporan_check;

ALTER TABLE template_raport
  ADD CONSTRAINT template_raport_jenis_laporan_check
  CHECK (jenis_laporan IN (
    'tengah_semester',
    'akhir_semester',
    'kokurikuler_p5',
    'kokurikuler_p2ra'
  ));

-- ==========================================
-- 4. Update data_raport.jenis_laporan CHECK constraint
-- ==========================================
ALTER TABLE data_raport
  DROP CONSTRAINT IF EXISTS data_raport_jenis_laporan_check;

ALTER TABLE data_raport
  ADD CONSTRAINT data_raport_jenis_laporan_check
  CHECK (jenis_laporan IN (
    'tengah_semester',
    'akhir_semester',
    'kokurikuler_p5',
    'kokurikuler_p2ra'
  ));

-- ==========================================
-- 5. Update penilaian_sikap.varian CHECK constraint
-- Add 'profil_rahmatan_lil_alamin' for KBC madrasah
-- ==========================================
ALTER TABLE penilaian_sikap
  DROP CONSTRAINT IF EXISTS penilaian_sikap_varian_check;

ALTER TABLE penilaian_sikap
  ADD CONSTRAINT penilaian_sikap_varian_check
  CHECK (varian IN (
    'profil_pelajar_pancasila',
    'dimensi_profil_lulusan_madrasah',
    'profil_rahmatan_lil_alamin'
  ));

COMMIT;
