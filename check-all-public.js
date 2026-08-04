const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
c.connect().then(async () => {
  const tables = ['library_categories', 'library_items', 'admin_tasks', 'lesson_memories', 'evidence_log', 'dokumen_bukti', 'in_app_notifications', 'notification_preferences', 'push_subscriptions', 'morning_briefings', 'weekly_recaps', 'well_being_checkins', 'well_being_weekly_summary', 'voice_briefing_logs', 'poin_ledger', 'poin_transactions', 'poin_ratio_audit', 'tpg_cross_institution_cache', 'executive_dashboard_cache', 'raport_cache', 'template_raport', 'layout_raport', 'data_raport', 'data_raport_nilai_mapel', 'data_raport_status_history', 'catatan_wali_kelas', 'penilaian_sikap', 'penilaian_ekstrakurikuler', 'ekstrakurikuler', 'wali_kelas_assignments', 'teacher_library_progress', 'teacher_library_score', 'teacher_streaks', 'user_files', 'user_folders', 'user_face_enrollment', 'connection_requests', 'school_registrations', 'kontak_eksternal_raport', 'kontak_eksternal_akses_log', 'v_users_token_backup', 'GeminiCache', 'TokenUsage', 'attendance_insights'];
  for (const t of tables) {
    try {
      const r = await c.query('SELECT COUNT(*) as cnt FROM public.' + t);
      console.log(t + ': ' + r.rows[0].cnt + ' rows');
    } catch(e) {
      console.log(t + ': ERROR - ' + e.message);
    }
  }
  await c.end();
}).catch(e => console.error(e.message));
