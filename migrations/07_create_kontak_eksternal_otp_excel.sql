-- ==========================================
-- MIGRATION: 07_create_kontak_eksternal_otp_excel
-- Purpose: Kontak Eksternal + OTP-Link, Ekspor PDF & Excel
-- Reuse token/OTP dari Fase 3
-- Date: 2026-07-10
-- ==========================================

BEGIN;

-- ==========================================
-- 1. TABLE: kontak_eksternal_raport
-- Kontak eksternal (wali kelas belum pakai GuruPRO) untuk kirim raport
-- ==========================================
CREATE TABLE IF NOT EXISTS kontak_eksternal_raport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_mapel_member_id UUID NOT NULL,
  nama_kontak VARCHAR(255) NOT NULL,
  kontak_wa VARCHAR(20),
  kontak_email VARCHAR(255),
  kelas_id UUID NOT NULL REFERENCES classes(id),
  link_token VARCHAR(255) NOT NULL UNIQUE,
  otp_expired_at TIMESTAMP NOT NULL,
  status_klaim VARCHAR(15) NOT NULL DEFAULT 'belum_klaim' CHECK (status_klaim IN ('belum_klaim', 'sudah_klaim')),
  claimed_by_member_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_raport_link_token
  ON kontak_eksternal_raport (link_token);

CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_raport_guru_mapel
  ON kontak_eksternal_raport (guru_mapel_member_id);

CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_raport_kelas
  ON kontak_eksternal_raport (kelas_id);

-- Partial index with now() requires IMMUTABLE function; omit predicate
-- Use application-level filtering instead
CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_raport_otp_expired
  ON kontak_eksternal_raport (otp_expired_at);

COMMENT ON TABLE kontak_eksternal_raport IS 'Kontak eksternal wali kelas yang belum pakai GuruPRO, untuk kirim raport via link OTP';
COMMENT ON COLUMN kontak_eksternal_raport.guru_mapel_member_id IS 'FK ke institution-members.id - guru mapel yang membuat kontak';
COMMENT ON COLUMN kontak_eksternal_raport.link_token IS 'Unique token untuk akses link (reuse generateShareToken Fase 3)';
COMMENT ON COLUMN kontak_eksternal_raport.otp_expired_at IS 'Masa berlaku link (48-72 jam) - lebih pendek dari Fase 3 karena data anak lebih sensitif';
COMMENT ON COLUMN kontak_eksternal_raport.claimed_by_member_id IS 'FK ke institution-members.id - jika kontak ini kemudian daftar GuruPRO';

-- ==========================================
-- 2. TABLE: kontak_eksternal_akses_log
-- Log akses ke link kontak eksternal
-- ==========================================
CREATE TABLE IF NOT EXISTS kontak_eksternal_akses_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kontak_eksternal_id UUID NOT NULL REFERENCES kontak_eksternal_raport(id),
  accessed_at TIMESTAMP NOT NULL DEFAULT now(),
  ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_akses_log_kontak
  ON kontak_eksternal_akses_log (kontak_eksternal_id);

CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_akses_log_accessed
  ON kontak_eksternal_akses_log (accessed_at);

COMMENT ON TABLE kontak_eksternal_akses_log IS 'Log akses ke link kontak eksternal raport';

-- ==========================================
-- 3. TABLE: pemetaan_kolom_profile
-- Konfigurasi urutan siswa & kolom untuk ekspor Excel
-- ==========================================
CREATE TABLE IF NOT EXISTS pemetaan_kolom_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sekolah_id UUID NOT NULL,
  jalur_regulasi VARCHAR(20) NOT NULL CHECK (jalur_regulasi IN ('kemendikdasmen', 'kemenag')),
  urutan_siswa VARCHAR(20) NOT NULL CHECK (urutan_siswa IN ('abjad_nama', 'nomor_absen', 'nisn')),
  urutan_kolom JSONB NOT NULL,
  system_version_catatan VARCHAR(100),
  last_validated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (sekolah_id, jalur_regulasi)
);

CREATE INDEX IF NOT EXISTS idx_pemetaan_kolom_profile_sekolah
  ON pemetaan_kolom_profile (sekolah_id);

COMMENT ON TABLE pemetaan_kolom_profile IS 'Profil pemetaan kolom untuk ekspor Excel raport';
COMMENT ON COLUMN pemetaan_kolom_profile.urutan_kolom IS 'Array of nilai_angka | deskripsi | predikat | kkm';
COMMENT ON COLUMN pemetaan_kolom_profile.last_validated_at IS 'Waktu validasi terakhir - reminder jika > 1 tahun';

COMMIT;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
--   AND table_name IN ('kontak_eksternal_raport', 'kontak_eksternal_akses_log', 'pemetaan_kolom_profile');
