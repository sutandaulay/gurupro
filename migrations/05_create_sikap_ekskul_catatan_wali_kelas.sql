-- Migration: 05_create_sikap_ekskul_catatan_wali_kelas.sql
-- Module: Sikap, Ekstrakurikuler, Catatan Wali Kelas
-- Created: 2026-07-10

-- =====================================================
-- Table: penilaian_sikap
-- Stores attitude/character assessment per student per class per period
-- =====================================================
CREATE TABLE IF NOT EXISTS penilaian_sikap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id UUID NOT NULL REFERENCES students(id),
  kelas_id UUID NOT NULL REFERENCES classes(id),
  periode VARCHAR(30) NOT NULL,
  varian VARCHAR(30) NOT NULL CHECK (varian IN ('profil_pelajar_pancasila', 'dimensi_profil_lulusan_madrasah')),
  penilaian_per_dimensi JSONB NOT NULL, -- array of { dimensi, predikat }
  deskripsi_umum TEXT NOT NULL,
  dinilai_oleh UUID NOT NULL, -- institution-members.id, harus wali kelas aktif kelas ini
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (siswa_id, kelas_id, periode)
);

CREATE INDEX idx_penilaian_sikap_siswa ON penilaian_sikap(siswa_id);
CREATE INDEX idx_penilaian_sikap_kelas ON penilaian_sikap(kelas_id);
CREATE INDEX idx_penilaian_sikap_periode ON penilaian_sikap(periode);
CREATE INDEX idx_penilaian_sikap_dinilai_oleh ON penilaian_sikap(dinilai_oleh);

-- =====================================================
-- Table: ekstrakurikuler
-- Stores extracurricular activity definitions per class
-- =====================================================
CREATE TABLE IF NOT EXISTS ekstrakurikuler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_ekskul VARCHAR(255) NOT NULL,
  kelas_id UUID NOT NULL REFERENCES classes(id),
  pembina_member_id UUID NOT NULL, -- institution-members.id, role guru
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_ekstrakurikuler_kelas ON ekstrakurikuler(kelas_id);
CREATE INDEX idx_ekstrakurikuler_pembina ON ekstrakurikuler(pembina_member_id);

-- =====================================================
-- Table: penilaian_ekstrakurikuler
-- Stores extracurricular assessment per student per ekskul per period
-- =====================================================
CREATE TABLE IF NOT EXISTS penilaian_ekstrakurikuler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id UUID NOT NULL REFERENCES students(id),
  ekstrakurikuler_id UUID NOT NULL REFERENCES ekstrakurikuler(id),
  periode VARCHAR(30) NOT NULL,
  predikat VARCHAR(20) NOT NULL CHECK (predikat IN ('sangat_baik', 'baik', 'cukup', 'perlu_bimbingan')),
  deskripsi TEXT NOT NULL,
  dinilai_oleh UUID NOT NULL, -- institution-members.id, harus = pembina_member_id ekskul terkait
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (siswa_id, ekstrakurikuler_id, periode)
);

CREATE INDEX idx_penilaian_ekskul_siswa ON penilaian_ekstrakurikuler(siswa_id);
CREATE INDEX idx_penilaian_ekskul_ekskul ON penilaian_ekstrakurikuler(ekstrakurikuler_id);
CREATE INDEX idx_penilaian_ekskul_periode ON penilaian_ekstrakurikuler(periode);
CREATE INDEX idx_penilaian_ekskul_dinilai_oleh ON penilaian_ekstrakurikuler(dinilai_oleh);

-- =====================================================
-- Table: catatan_wali_kelas
-- Stores homeroom teacher notes per student per class per period
-- =====================================================
CREATE TABLE IF NOT EXISTS catatan_wali_kelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id UUID NOT NULL REFERENCES students(id),
  kelas_id UUID NOT NULL REFERENCES classes(id),
  periode VARCHAR(30) NOT NULL,
  catatan TEXT NOT NULL,
  ditulis_oleh UUID NOT NULL, -- institution-members.id, harus wali kelas aktif kelas ini
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (siswa_id, kelas_id, periode)
);

CREATE INDEX idx_catatan_wali_kelas_siswa ON catatan_wali_kelas(siswa_id);
CREATE INDEX idx_catatan_wali_kelas_kelas ON catatan_wali_kelas(kelas_id);
CREATE INDEX idx_catatan_wali_kelas_periode ON catatan_wali_kelas(periode);
CREATE INDEX idx_catatan_wali_kelas_ditulis_oleh ON catatan_wali_kelas(ditulis_oleh);

-- =====================================================
-- Trigger: Auto-update updated_at for ekstrakurikuler
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ekstrakurikuler_updated_at
  BEFORE UPDATE ON ekstrakurikuler
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_catatan_wali_kelas_updated_at
  BEFORE UPDATE ON catatan_wali_kelas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
