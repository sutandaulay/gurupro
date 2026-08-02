-- ============================================================
-- Migration: Performance Indexes — FASE 1 Quick Wins
-- Applied: 2026-07-26
-- Deskripsi: Menambahkan 12 index yang hilang berdasarkan audit
--   performa. Gunakan CREATE INDEX IF NOT EXISTS agar aman
--   dijalankan berulang.
-- ============================================================

-- 1. institution_members: composite (app_user_id, institution_id)
--    Dipakai di 46+ query auth untuk multi-tenant isolation.
CREATE INDEX IF NOT EXISTS idx_inst_members_user_inst
  ON institution_members ("app_user_id", "institution_id");

-- 2. institution_members: (status)
--    Filter status='active' di 30+ query.
CREATE INDEX IF NOT EXISTS idx_inst_members_status
  ON institution_members (status);

-- 3. teacher_attendance: composite (user_id, school_id, tanggal)
--    Dipakai di api/attendance untuk WHERE + ORDER BY tanggal.
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_user_school_tgl
  ON teacher_attendance (user_id, school_id, tanggal);

-- 4. teacher_journals: (teacher_id) standalone
--    Dipakai di streaks, analytics tanpa filter school_id.
CREATE INDEX IF NOT EXISTS idx_teacher_journals_teacher_id
  ON teacher_journals (teacher_id);

-- 5. teacher_journals: (tanggal)
--    Dipakai DISTINCT tanggal di endpoint streaks.
CREATE INDEX IF NOT EXISTS idx_teacher_journals_tanggal
  ON teacher_journals (tanggal);

-- 6. guru_administrasi: (user_id)
--    Semua query administrasi by user — kolom FK tanpa index.
CREATE INDEX IF NOT EXISTS idx_ga_user_id
  ON guru_administrasi (user_id);

-- 7. guru_administrasi: (approval_status)
--    Filter dokumen pending approval di supervision.
CREATE INDEX IF NOT EXISTS idx_ga_approval_status
  ON guru_administrasi (approval_status);

-- 8. guru_administrasi: (institution_id)
--    Dipakai admin supervision queries.
CREATE INDEX IF NOT EXISTS idx_ga_institution_id
  ON guru_administrasi (institution_id);

-- 9. journal_schemas: (school_id)
--    Semua query journal schemas by school.
CREATE INDEX IF NOT EXISTS idx_journal_schemas_school_id
  ON journal_schemas (school_id);

-- 10. academic_calendars: (school_id)
--     Semua query academic calendar by school.
CREATE INDEX IF NOT EXISTS idx_academic_calendars_school_id
  ON academic_calendars (school_id);

-- 11. data_raport_nilai_mapel: composite (data_raport_id, mapel_id)
--     Upsert pattern di nilai-mapel endpoint.
CREATE INDEX IF NOT EXISTS idx_data_raport_nilai_mapel_lookup
  ON data_raport_nilai_mapel (data_raport_id, mapel_id);

-- 12. user_school_assignments: composite ("userId", "schoolId")
--     Dipakai requireSchoolAccess() di 25+ endpoint.
CREATE INDEX IF NOT EXISTS idx_usa_user_school
  ON user_school_assignments ("userId", "schoolId");
