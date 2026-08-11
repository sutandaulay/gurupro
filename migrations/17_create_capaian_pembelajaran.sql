-- ==========================================
-- MIGRATION: 17_create_capaian_pembelajaran
-- Purpose: Source-of-truth table for structured Capaian Pembelajaran (CP) data
-- References: Kepka BSKAP 046/2025, Kepka BKPDM 020/2026, Kep Dirjen Pendis 9941/2025
-- Date: 2026-08-06
-- ==========================================

BEGIN;

-- ==========================================
-- 1. TABLE: capaian_pembelajaran
-- Source-of-truth for CP elements per mapel/fase/jenjang
-- ==========================================
CREATE TABLE IF NOT EXISTS capaian_pembelajaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versi VARCHAR(50) NOT NULL DEFAULT '046/2025',
  versi_tanggal DATE NOT NULL DEFAULT '2025-07-16',
  sumber_regulasi VARCHAR(100) NOT NULL,
  lampiran VARCHAR(10),

  jalur VARCHAR(20) NOT NULL CHECK (jalur IN ('kemendikdasmen', 'kneelmenag')),
  jenjang VARCHAR(20) NOT NULL,
  tipe_pendidikan VARCHAR(20) DEFAULT 'reguler' CHECK (tipe_pendidikan IN ('reguler', 'khusus')),

  mapel_kode VARCHAR(50),
  mapel_nama VARCHAR(200) NOT NULL,
  fase VARCHAR(20),

  kelas_umum VARCHAR(50),
  usia_mental VARCHAR(50),

  -- Elemen dan CP dalam JSONB untuk fleksibilitas
  elemen JSONB NOT NULL DEFAULT '[]',

  -- Metadata Madrasah (hanya untuk jalur=kemenag)
  status_madrasah JSONB,

  -- Reference info
  halaman_perkiraan INTEGER,
  kode_romawi VARCHAR(20),

  -- Versioning
  deprecated BOOLEAN NOT NULL DEFAULT false,
  deprecated_at TIMESTAMP,
  deprecated_ganti_id UUID REFERENCES capaian_pembelajaran(id),

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (sumber_regulasi, jalur, jenjang, tipe_pendidikan, mapel_kode, fase)
);

CREATE INDEX IF NOT EXISTS idx_cp_jalur_jenjang ON capaian_pembelajaran (jalur, jenjang, tipe_pendidikan);
CREATE INDEX IF NOT EXISTS idx_cp_mapel ON capaian_pembelajaran (mapel_nama);
CREATE INDEX IF NOT EXISTS idx_cp_fase ON capaian_pembelajaran (fase);
CREATE INDEX IF NOT EXISTS idx_cp_not_deprecated ON capaian_pembelajaran (deprecated) WHERE deprecated = false;

COMMENT ON TABLE capaian_pembelajaran IS 'Source-of-truth Capaian Pembelajaran per mapel/fase/jenjang/jalur';
COMMENT ON COLUMN capaian_pembelajaran.sumber_regulasi IS 'Kepka BSKAP 046/H/KR/2025 | Kepka BKPDM 020/2026 | Kep Dirjen Pendis 9941/2025 | KMA 1503/2025';
COMMENT ON COLUMN capaian_pembelajaran.jalur IS 'kemendikdasmen = sekolah umum; kneelmenag = madrasah/pesantren';
COMMENT ON COLUMN capaian_pembelajaran.jenjang IS 'PAUD | SD | SMP | SMA | SMK | Paket A | Paket B | Paket C | TKLB | SDLB | SMPLB | SMALB';
COMMENT ON COLUMN capaian_pembelajaran.elemen IS 'Array of { nama_elemen, deskripsi, capaian_pembelajaran }';
COMMENT ON COLUMN capaian_pembelajaran.status_madrasah IS '{ wajib_atau_pilihan, mulai_berlaku_wajib_ta, catatan } - null untuk jalur kemendikdasmen';

-- ==========================================
-- 2. TABLE: jp_allocation
-- Alokasi Jam Pelajaran (JP) per mapel per jenjang/kelas
-- Source: KMA 1503/2025 (for madrasah)
-- ==========================================
CREATE TABLE IF NOT EXISTS jp_allocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sumber VARCHAR(100) NOT NULL DEFAULT 'KMA 1503/2025',
  jalur VARCHAR(20) NOT NULL DEFAULT 'kemenag',

  jenjang VARCHAR(20) NOT NULL,
  kelas VARCHAR(10) NOT NULL,
  mapel_nama VARCHAR(200) NOT NULL,

  total_jp_per_tahun INTEGER NOT NULL,
  catatan VARCHAR(500),

  deprecated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),

  UNIQUE (sumber, jalur, jenjang, kelas, mapel_nama)
);

CREATE INDEX IF NOT EXISTS idx_jp_jenjang ON jp_allocation (jenjang, kelas);

-- ==========================================
-- 3. TABLE: ketentuan_peralihan
-- Timeline implementasi bertahap (Madrasah)
-- Source: KMA 1503/2025 sheet Ketentuan Peralihan
-- ==========================================
CREATE TABLE IF NOT EXISTS ketentuan_peralihan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sumber VARCHAR(100) NOT NULL DEFAULT 'KMA 1503/2025',

  kategori VARCHAR(100) NOT NULL,
  ketentuan TEXT NOT NULL,
  ta_mulai DATE,
  ta_deadline DATE,
  daerah_kategori VARCHAR(50),

  deprecated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kp_kategori ON ketentuan_peralihan (kategori);
CREATE INDEX IF NOT EXISTS idx_kp_ta ON ketentuan_peralihan (ta_mulai, ta_deadline);

COMMIT;
