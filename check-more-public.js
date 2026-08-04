const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
c.connect().then(async () => {
  const tables = ['attendance_devices', 'attendance_logs', 'attendance_logs_flag_reasons', 'attendance_summary', 'teacher_attendance', 'teacher_institution_assignments', 'leave_requests', 'absent_alerts', 'school_teaching_sessions', 'teaching_sessions', 'payout_requests', 'transactions', 'pelatihan_guru', 'skp_tahunan', 'skp_indikator', 'tahun_ajaran', 'observasi_kinerja', 'observasi_indikator', 'indikator_kinerja_config', 'journal_supervisions', 'journal_schemas', 'guru_administrasi', 'pemetaan_kolom_profile'];
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
