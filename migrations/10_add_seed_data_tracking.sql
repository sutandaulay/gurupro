-- Migration: Add seed data tracking columns
-- Purpose: Flag rows created by manual-testing seed scripts
-- Date: 2026-08-06
-- Author: Claude (seed-data generation)

BEGIN;

-- Add is_seed_data and seed_batch to core tables
-- These are pure housekeeping — never displayed in UI

-- users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- subjects table
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- schedules table
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- assessments table
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- student_grades table
ALTER TABLE student_grades ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE student_grades ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- template_raport table
ALTER TABLE template_raport ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE template_raport ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- data_raport table
ALTER TABLE data_raport ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE data_raport ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- data_raport_nilai_mapel table
ALTER TABLE data_raport_nilai_mapel ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE data_raport_nilai_mapel ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- ekstrakurikuler table
ALTER TABLE ekstrakurikuler ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ekstrakurikuler ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- penilaian_ekstrakurikuler table
ALTER TABLE penilaian_ekstrakurikuler ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE penilaian_ekstrakurikuler ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- penilaian_sikap table
ALTER TABLE penilaian_sikap ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE penilaian_sikap ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- catatan_wali_kelas table
ALTER TABLE catatan_wali_kelas ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE catatan_wali_kelas ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- wali_kelas_assignments table
ALTER TABLE wali_kelas_assignments ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE wali_kelas_assignments ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- academic_calendars table
ALTER TABLE academic_calendars ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE academic_calendars ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- tahun_ajaran table
ALTER TABLE tahun_ajaran ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tahun_ajaran ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- teacher_attendance table
ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- student_attendance table
ALTER TABLE student_attendance ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE student_attendance ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- transactions table (poin)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- teacher_journals table
ALTER TABLE teacher_journals ADD COLUMN IF NOT EXISTS is_seed_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE teacher_journals ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

-- rapiin indexes untuk seed tracking
CREATE INDEX IF NOT EXISTS idx_users_seed ON users(seed_batch) WHERE seed_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schools_seed ON schools(seed_batch) WHERE seed_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_seed ON students(seed_batch) WHERE seed_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classes_seed ON classes(seed_batch) WHERE seed_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_seed ON schedules(seed_batch) WHERE seed_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_data_raport_seed ON data_raport(seed_batch) WHERE seed_batch IS NOT NULL;

-- Payload tables (infrastructure tables managed by Payload CMS)
ALTER TABLE payload.institutions ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);
ALTER TABLE payload.cms_users ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);
ALTER TABLE payload.institution_members ADD COLUMN IF NOT EXISTS seed_batch VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_payload_institutions_seed ON payload.institutions(seed_batch) WHERE seed_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payload_cms_users_seed ON payload.cms_users(seed_batch) WHERE seed_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payload_institution_members_seed ON payload.institution_members(seed_batch) WHERE seed_batch IS NOT NULL;

COMMIT;

-- Cleanup query (run separately when needed):
-- UPDATE users SET is_seed_data = false, seed_batch = NULL WHERE seed_batch = 'manual-testing-20260806';
-- Then verify counts with:
-- SELECT 'users' as tbl, count(*) FROM users WHERE seed_batch = 'manual-testing-20260806'
-- UNION ALL SELECT 'schools', count(*) FROM schools WHERE seed_batch = 'manual-testing-20260806'
-- UNION ALL SELECT 'students', count(*) FROM students WHERE seed_batch = 'manual-testing-20260806'
-- ... etc
