-- ==========================================
-- GURUPRO MULTI-SCHOOL DEEP LEARNING MIGRATION
-- Run this SQL manually on your database
-- ==========================================
-- Date: 2026-07-04
-- Features: Multi-School Multi-Tenancy + Deep Learning (Kerangka 8334)
-- ==========================================

BEGIN;

-- ==========================================
-- 1. JUNCTION TABLES: User ↔ School
-- ==========================================
CREATE TABLE IF NOT EXISTS user_school_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId           UUID NOT NULL,
  schoolId         UUID NOT NULL,
  tahunAjaranId    UUID,
  isWaliKelas      BOOLEAN DEFAULT false,
  createdAt        TIMESTAMP DEFAULT NOW(),
  UNIQUE(userId, schoolId, tahunAjaranId)
);
CREATE INDEX IF NOT EXISTS idx_usa_user ON user_school_assignments(userId);
CREATE INDEX IF NOT EXISTS idx_usa_school ON user_school_assignments(schoolId);

-- ==========================================
-- 2. JUNCTION TABLES: Teacher ↔ Subject
-- ==========================================
CREATE TABLE IF NOT EXISTS teacher_subject_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId           UUID NOT NULL,
  schoolId         UUID NOT NULL,
  subjectId        UUID NOT NULL,
  tahunAjaranId    UUID,
  createdAt        TIMESTAMP DEFAULT NOW(),
  UNIQUE(userId, schoolId, subjectId, tahunAjaranId)
);
CREATE INDEX IF NOT EXISTS idx_tsa_user ON teacher_subject_assignments(userId);
CREATE INDEX IF NOT EXISTS idx_tsa_school ON teacher_subject_assignments(schoolId);
CREATE INDEX IF NOT EXISTS idx_tsa_subject ON teacher_subject_assignments(subjectId);

-- ==========================================
-- 3. JUNCTION TABLES: Teacher ↔ Class
-- ==========================================
CREATE TABLE IF NOT EXISTS teacher_class_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId           UUID NOT NULL,
  schoolId         UUID NOT NULL,
  classId          UUID NOT NULL,
  tahunAjaranId    UUID,
  isWaliKelas      BOOLEAN DEFAULT false,
  createdAt        TIMESTAMP DEFAULT NOW(),
  UNIQUE(userId, schoolId, classId, tahunAjaranId)
);
CREATE INDEX IF NOT EXISTS idx_tca_user ON teacher_class_assignments(userId);
CREATE INDEX IF NOT EXISTS idx_tca_school ON teacher_class_assignments(schoolId);
CREATE INDEX IF NOT EXISTS idx_tca_class ON teacher_class_assignments(classId);

-- ==========================================
-- 4. ENRICH: guru_administrasi with FK columns
-- ==========================================
ALTER TABLE guru_administrasi
  ADD COLUMN IF NOT EXISTS school_id UUID,
  ADD COLUMN IF NOT EXISTS class_id UUID,
  ADD COLUMN IF NOT EXISTS subject_id UUID,
  ADD COLUMN IF NOT EXISTS tahun_ajaran_id UUID,
  ADD COLUMN IF NOT EXISTS semester VARCHAR(20),
  ADD COLUMN IF NOT EXISTS kurikulum VARCHAR(50),
  ADD COLUMN IF NOT EXISTS jenjang VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fase VARCHAR(10),
  ADD COLUMN IF NOT EXISTS dimensi8 TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tiga_pengalaman BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pai_mode VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_ga_school ON guru_administrasi(school_id);
CREATE INDEX IF NOT EXISTS idx_ga_class ON guru_administrasi(class_id);
CREATE INDEX IF NOT EXISTS idx_ga_subject ON guru_administrasi(subject_id);
CREATE INDEX IF NOT EXISTS idx_ga_tipe ON guru_administrasi(tipe_dokumen);
CREATE INDEX IF NOT EXISTS idx_ga_kurikulum ON guru_administrasi(kurikulum);
CREATE INDEX IF NOT EXISTS idx_ga_dimensi8 ON guru_administrasi USING GIN(dimensi8);

-- ==========================================
-- 5. ENRICH: question_banks with FK columns
-- ==========================================
ALTER TABLE question_banks
  ADD COLUMN IF NOT EXISTS school_id UUID,
  ADD COLUMN IF NOT EXISTS subject_id UUID,
  ADD COLUMN IF NOT EXISTS jenjang VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_qb_school ON question_banks(school_id);
CREATE INDEX IF NOT EXISTS idx_qb_subject ON question_banks(subject_id);
CREATE INDEX IF NOT EXISTS idx_qb_kurikulum ON question_banks(kurikulum);

-- ==========================================
-- 6. INSERT SAMPLE DATA (for testing)
-- Optional: Insert existing user-school assignments
-- Uncomment and modify as needed
-- ==========================================
/*
-- Example: Assign all existing users to their schools
INSERT INTO user_school_assignments (userId, schoolId, tahunAjaranId, isWaliKelas)
SELECT u.id, s.id, NULL, false
FROM users u
JOIN schools s ON s.nama_sekolah = u.nama_sekolah
WHERE u.nama_sekolah IS NOT NULL
ON CONFLICT (userId, schoolId, tahunAjaranId) DO NOTHING;
*/

-- ==========================================
-- 7. BACKUP: Create function to get user's schools
-- ==========================================
CREATE OR REPLACE FUNCTION get_user_schools(p_user_id UUID)
RETURNS TABLE (
  school_id UUID,
  school_name VARCHAR,
  school_npsn VARCHAR,
  school_address TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS school_id,
    s.nama_sekolah,
    s.npsn,
    s.alamat
  FROM schools s
  INNER JOIN user_school_assignments usa ON usa.schoolId = s.id
  WHERE usa.userId = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 8. BACKUP: Create function to get user's subjects
-- ==========================================
CREATE OR REPLACE FUNCTION get_user_subjects(p_user_id UUID, p_school_id UUID)
RETURNS TABLE (
  subject_id UUID,
  subject_name VARCHAR,
  school_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sub.id AS subject_id,
    sub.nama_mapel,
    s.nama_sekolah
  FROM subjects sub
  INNER JOIN teacher_subject_assignments tsa ON tsa.subjectId = sub.id
  INNER JOIN schools s ON s.id = sub.school_id
  WHERE tsa.userId = p_user_id
    AND (p_school_id IS NULL OR tsa.schoolId = p_school_id);
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
-- Run these to verify migration:

-- Check new tables:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%assignment%';

-- Check new columns in guru_administrasi:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'guru_administrasi' AND column_name IN ('school_id', 'dimensi8', 'tiga_pengalaman', 'pai_mode');

-- ==========================================
-- NOTES:
-- 1. Backup your database before running!
-- 2. The schema.prisma in the codebase is already updated
-- 3. After running this SQL, run: npx prisma generate
-- 4. Restart your dev server
-- ==========================================
