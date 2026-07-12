-- ==========================================
-- MIGRATION: 04_create_raport_tables
-- Purpose: Template Raport, Data Raport & Agregator Buku Nilai
-- Date: 2026-07-10
-- ==========================================

BEGIN;

-- ==========================================
-- 1. ADD KOLOM: nis_lokal ke students
-- ==========================================
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS nis_lokal VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_students_nis_lokal ON students(nis_lokal);

-- ==========================================
-- 2. ADD KOLOM: is_akhir_semester ke assessments
-- Untuk membedakan sumatif materi vs sumatif akhir semester
-- ==========================================
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS is_akhir_semester BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_assessments_akhir_semester
  ON assessments(class_id, subject_id)
  WHERE is_akhir_semester = true;

-- ==========================================
-- 3. TABLE: template_raport
-- Template konfigurasi raport per sekolah
-- ==========================================
CREATE TABLE IF NOT EXISTS template_raport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sekolah_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  nama_template VARCHAR(255) NOT NULL,
  jalur_regulasi VARCHAR(20) NOT NULL CHECK (jalur_regulasi IN ('kemendikdasmen', 'kemenag')),
  jenjang VARCHAR(20) NOT NULL CHECK (jenjang IN ('paud', 'sd_mi', 'smp_mts', 'sma_ma', 'smk_mak')),
  kurikulum VARCHAR(20) NOT NULL CHECK (kurikulum IN ('kurikulum_merdeka', 'k13')),
  jenis_laporan VARCHAR(20) NOT NULL CHECK (jenis_laporan IN ('tengah_semester', 'akhir_semester', 'kokurikuler_p5')),
  mode_nilai_akademik VARCHAR(20) NOT NULL CHECK (mode_nilai_akademik IN ('angka_kkm', 'angka_deskripsi', 'naratif_saja')),
  varian_sikap VARCHAR(30) CHECK (varian_sikap IN ('profil_pelajar_pancasila', 'dimensi_profil_lulusan_madrasah')),
  basis_deskripsi VARCHAR(30) NOT NULL CHECK (basis_deskripsi IN ('capaian_pembelajaran', 'alur_tujuan_pembelajaran', 'poin_materi')),
  sections JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_raport_sekolah
  ON template_raport (sekolah_id, jalur_regulasi, jenjang, kurikulum, jenis_laporan);

COMMENT ON TABLE template_raport IS 'Template konfigurasi raport per sekolah, jalur regulasi, jenjang, dan kurikulum';
COMMENT ON COLUMN template_raport.sekolah_id IS 'FK ke schools.id - relasi institution_id di Payload';
COMMENT ON COLUMN template_raport.sections IS 'Array of { sectionType, order, wajib, config }';

-- ==========================================
-- 4. TABLE: data_raport
-- Data raport per siswa per periode
-- ==========================================
CREATE TABLE IF NOT EXISTS data_raport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  nisn VARCHAR(10) NOT NULL,
  nis_lokal VARCHAR(50) NOT NULL,
  kelas_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  template_raport_id UUID NOT NULL REFERENCES template_raport(id) ON DELETE RESTRICT,
  periode VARCHAR(30) NOT NULL,
  jenis_laporan VARCHAR(20) NOT NULL CHECK (jenis_laporan IN ('tengah_semester', 'akhir_semester', 'kokurikuler_p5')),
  status VARCHAR(25) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'dikirim_ke_wali_kelas', 'dikonfirmasi', 'difinalisasi', 'siap_print')),
  sikap_id UUID,
  catatan_wali_kelas TEXT,
  presensi_snapshot JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (siswa_id, template_raport_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_data_raport_siswa ON data_raport (siswa_id);
CREATE INDEX IF NOT EXISTS idx_data_raport_kelas ON data_raport (kelas_id);
CREATE INDEX IF NOT EXISTS idx_data_raport_status ON data_raport (status);
CREATE INDEX IF NOT EXISTS idx_data_raport_periode ON data_raport (periode);

COMMENT ON TABLE data_raport IS 'Data raport per siswa per periode';
COMMENT ON COLUMN data_raport.periode IS 'Format: TS-2025/2026-Ganjil (Tengah Semester) / AS-2025/2026-Ganjil (Akhir Semester)';
COMMENT ON COLUMN data_raport.presensi_snapshot IS '{ sakit, izin, alpa } - snapshot saat difinalisasi';

-- ==========================================
-- 5. TABLE: data_raport_nilai_mapel
-- Nilai mapel per raport
-- ==========================================
CREATE TABLE IF NOT EXISTS data_raport_nilai_mapel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_raport_id UUID NOT NULL REFERENCES data_raport(id) ON DELETE CASCADE,
  mapel_id UUID NOT NULL,
  guru_mapel_member_id UUID NOT NULL,
  nilai_akhir NUMERIC(5,1),
  kkm NUMERIC(5,1),
  deskripsi_capaian TEXT NOT NULL DEFAULT '',
  deskripsi_sumber_ai BOOLEAN NOT NULL DEFAULT false,
  deskripsi_dibuka_untuk_review BOOLEAN NOT NULL DEFAULT false,
  dikonfirmasi_guru BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (data_raport_id, mapel_id)
);

CREATE INDEX IF NOT EXISTS idx_data_raport_nilai_mapel_raport ON data_raport_nilai_mapel (data_raport_id);
CREATE INDEX IF NOT EXISTS idx_data_raport_nilai_mapel_guru ON data_raport_nilai_mapel (guru_mapel_member_id);

COMMENT ON TABLE data_raport_nilai_mapel IS 'Nilai per mapel dalam satu raport';
COMMENT ON COLUMN data_raport_nilai_mapel.guru_mapel_member_id IS 'FK ke institution-members.id - role guru, divalidasi di application layer';
COMMENT ON COLUMN data_raport_nilai_mapel.deskripsi_dibuka_untuk_review IS 'True jika siswa/wali sudah bisa review deskripsi';

-- ==========================================
-- 6. TABLE: data_raport_status_history
-- History perubahan status raport
-- ==========================================
CREATE TABLE IF NOT EXISTS data_raport_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_raport_id UUID NOT NULL REFERENCES data_raport(id) ON DELETE CASCADE,
  status VARCHAR(25) NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT now(),
  changed_by UUID NOT NULL,
  changed_by_role VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_data_raport_status_history_raport ON data_raport_status_history (data_raport_id);
CREATE INDEX IF NOT EXISTS idx_data_raport_status_history_changed_by ON data_raport_status_history (changed_by);

COMMENT ON TABLE data_raport_status_history IS 'Audit trail perubahan status raport';
COMMENT ON COLUMN data_raport_status_history.changed_by_role IS 'Role: guru_mapel, wali_kelas, kepala_sekolah, admin';

-- ==========================================
-- 7. AUTO-UPDATE TIMESTAMPS
-- ==========================================
CREATE OR REPLACE FUNCTION update_raport_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_template_raport_updated_at ON template_raport;
CREATE TRIGGER update_template_raport_updated_at
  BEFORE UPDATE ON template_raport
  FOR EACH ROW EXECUTE FUNCTION update_raport_updated_at();

DROP TRIGGER IF EXISTS update_data_raport_updated_at ON data_raport;
CREATE TRIGGER update_data_raport_updated_at
  BEFORE UPDATE ON data_raport
  FOR EACH ROW EXECUTE FUNCTION update_raport_updated_at();

DROP TRIGGER IF EXISTS update_data_raport_nilai_mapel_updated_at ON data_raport_nilai_mapel;
CREATE TRIGGER update_data_raport_nilai_mapel_updated_at
  BEFORE UPDATE ON data_raport_nilai_mapel
  FOR EACH ROW EXECUTE FUNCTION update_raport_updated_at();

-- ==========================================
-- 8. VALIDATION FUNCTION: Cek role guru
-- ==========================================
CREATE OR REPLACE FUNCTION validate_guru_mapel_member(p_member_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR(20);
BEGIN
   SELECT imr.value INTO v_role
   FROM institution_members im
   JOIN institution_members_role imr ON imr.parent_id = im.id
   WHERE im.app_user_id = p_member_id
     AND imr.value = 'guru'
   LIMIT 1;

  RETURN v_role IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_guru_mapel_member IS 'Validasi bahwa institution-member memiliki role guru';

-- ==========================================
-- 9. INSERT TEMPLATE DEFAULT
-- Template default untuk SD Kurikulum Merdeka Kemendikdasmen
-- ==========================================
INSERT INTO template_raport (
  sekolah_id,
  nama_template,
  jalur_regulasi,
  jenjang,
  kurikulum,
  jenis_laporan,
  mode_nilai_akademik,
  varian_sikap,
  basis_deskripsi,
  sections,
  is_default
) VALUES (
  gen_random_uuid(),
  'Template Default SD - Kurikulum Merdeka',
  'kemendikdasmen',
  'sd_mi',
  'kurikulum_merdeka',
  'akhir_semester',
  'angka_kkm',
  'profil_pelajar_pancasila',
  'capaian_pembelajaran',
  '[
    {"sectionType": "header", "order": 1, "wajib": true, "config": {"showLogo": true, "showTandaTangan": true}},
    {"sectionType": "identitas", "order": 2, "wajib": true, "config": {"fields": ["nama", "nisn", "nis_lokal", "kelas", "semester", "tahun_ajaran"]}},
    {"sectionType": "sikap", "order": 3, "wajib": true, "config": {"jenis": "profil_pelajar_pancasila", "elemen": ["imtak", "gotong_royong"]}},
    {"sectionType": "ekskul", "order": 4, "wajib": true, "config": {}},
    {"sectionType": "catatan_wali_kelas", "order": 5, "wajib": true, "config": {}},
    {"sectionType": "footer", "order": 6, "wajib": true, "config": {"showTtdWaliKelas": true, "showTtdKepsek": true}}
  ]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

COMMIT;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%raport%';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'students' AND column_name IN ('nis_lokal');
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'is_akhir_semester';
