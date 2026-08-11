-- ============================================================
-- CLEANUP: Hapus semua data halaman GURU dan INSTITUSI
-- Production: backup dulu sebelum dijalankan!
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 0: Tables dengan FK (RESTRICT/NO ACTION) ke
--           students, classes, schools, users, tahun_ajaran
--           Hapus duluan agar tidak block delete master
-- ============================================================

-- Tahun ajaran (RESTRICT/NO ACTION FKs — teacher/guru related)
DELETE FROM tahun_ajaran;

-- Leave requests (NO ACTION: teacher_id, approved_by, school_id)
DELETE FROM leave_requests;

-- Audit trails (NO ACTION: user_id)
DELETE FROM audit_trails;

-- Classes FKs dari luar (NO ACTION / RESTRICT — tidak cascade)
DELETE FROM wali_kelas_assignments;    -- FK: classes(RESTRICT)
DELETE FROM kontak_eksternal_raport;  -- FK: classes(NO ACTION)

-- ekstrakurikuler FK ke classes(NO ACTION) + users(owner,pembina)(NO ACTION)
-- Hapus sebelum classes & users
DELETE FROM ekstrakurikuler;

-- Penilaian ekstrakurikuler FK ke ekstrakurikuler(NO ACTION) + students(NO ACTION)
DELETE FROM penilaian_ekstrakurikuler;

-- Penilaian (NO ACTION: siswa_id, kelas_id)
DELETE FROM penilaian_sikap;

-- Catatan wali kelas (NO ACTION: siswa_id, kelas_id)
DELETE FROM catatan_wali_kelas;

-- Raport tables — urutan KRUSAL karena RESTRICT chain:
--   data_raport_nilai_mapel → data_raport → template_raport → schools
DELETE FROM data_raport_nilai_mapel;   -- FK: data_raport (CASCADE)
DELETE FROM data_raport_status_history;
DELETE FROM data_raport;               -- FK: students(NO ACTION)+template_raport(RESTRICT)+classes(RESTRICT)
DELETE FROM layout_raport;             -- FK: schools (RESTRICT)
DELETE FROM template_raport;           -- FK: schools (RESTRICT) — schools masih ada, tapi template_raport kosong sekarang

-- SKP (RESTRICT: users+schools)
DELETE FROM observasi_indikator;       -- FK: indikator_kinerja_config (NO ACTION)
DELETE FROM skp_indikator;            -- FK: indikator_kinerja_config (NO ACTION)
DELETE FROM skp_tahunan;              -- FK: users+schools (RESTRICT)

-- Library guru (NO ACTION: users FK)
DELETE FROM teacher_library_progress;
DELETE FROM teacher_library_score;

-- POIN ledger (NO ACTION: users FK)
DELETE FROM poin_ratio_audit;
DELETE FROM poin_ledger;
DELETE FROM poin_transactions;

-- User engagement (NO ACTION: users FK)
DELETE FROM morning_briefings;
DELETE FROM weekly_recaps;
DELETE FROM well_being_checkins;
DELETE FROM well_being_weekly_summary;
DELETE FROM attendance_insights;
DELETE FROM attendance_summary;
DELETE FROM attendance_logs;
DELETE FROM attendance_devices;
DELETE FROM user_face_enrollment;
DELETE FROM push_subscriptions;
DELETE FROM notification_preferences;
DELETE FROM voice_briefing_logs;
DELETE FROM tpg_cross_institution_cache;

-- Forum (NO ACTION: users FK)
DELETE FROM forum_replies;
DELETE FROM forum_topics;

-- Connection requests (NO ACTION: school_id)
DELETE FROM connection_requests;

-- ============================================================
-- PHASE 1: Delete guru users
-- Cascade: user_school_assignments, teaching_sessions,
-- ai_chat_logs, guru_administrasi, journal_supervisions,
-- laporan_kinerjas, lesson_memories, observasi_kinerja,
-- payout_requests, pelatihan_gurus, question_banks,
-- referrals, transactions, evidence_log, dokumen_bukti,
-- in_app_notifications, teacher_institution_assignments,
-- user_folders, user_files, admin_tasks, ekstrakurikuler(owner FK),
-- absent_alerts(user FK), poin_transactions, morning_briefings, dll
-- ============================================================
DELETE FROM users WHERE role = 'guru';

-- ============================================================
-- PHASE 2: Orphan cleanup — rows yang FK-nya hilang setelah phase 1
-- ============================================================

-- User engagement orphan
DELETE FROM in_app_notifications;
DELETE FROM user_folders;
DELETE FROM user_files;
DELETE FROM user_school_assignments;
DELETE FROM teacher_institution_assignments;
DELETE FROM teacher_streaks;

-- Library items (orphan — school FK cascade dari schools)
DELETE FROM library_items;
DELETE FROM library_categories;

-- raport_cache orphan (students+assessments cascade)
DELETE FROM raport_cache;

-- ============================================================
-- PHASE 3: Classes FK wali_kelas ke users — NO ACTION
-- Set NULL sebelum delete schools
-- ============================================================
UPDATE classes SET wali_kelas = NULL;

-- ============================================================
-- PHASE 4: Hapus schools (CASCADE ke institusi tables)
-- Cascade: academic_calendars, assessments, classes, journal_schemas,
-- schedules, subjects, teacher_journals, teacher_attendance,
-- school_teaching_sessions, connection_requests(via school FK),
-- ekstrakurikuler(owner FK cascade), duty_assignments,
-- pemetaan_kolom_profile, executive_dashboard_cache
-- Classes cascade: students
-- Students cascade: student_attendance, student_grades, absent_alerts
-- ============================================================
DELETE FROM schools;

-- ============================================================
-- PHASE 5: Final orphan cleanup
-- ============================================================
DELETE FROM indikator_kinerja_config;

COMMIT;
