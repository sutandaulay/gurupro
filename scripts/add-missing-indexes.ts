/**
 * Database Index Migration Script
 * Run: npx tsx scripts/add-missing-indexes.ts
 *
 * Adds performance indexes identified from slow query analysis.
 * All indexes use CREATE INDEX IF NOT EXISTS — safe to re-run.
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const pool = new Pool({ connectionString: DATABASE_URL });

async function addIndex(sql: string, description: string) {
  try {
    await pool.query(sql);
    console.log(`✅ ${description}`);
  } catch (err: any) {
    if (err.code === '42710' || err.message.includes('already exists')) {
      console.log(`⏭️  Already exists: ${description}`);
    } else {
      console.error(`❌ Failed: ${description}`);
      console.error(`   ${err.message}`);
    }
  }
}

async function main() {
  console.log('🔍 Adding missing database indexes...\n');

  // 1. Student attendance — composite index for the dashboard presensi snapshot query
  // Query: student_attendance sa JOIN schedules sch ON sch.id = sa.schedule_id
  //         WHERE sa.student_id = ANY($1) AND sch.class_id = $2
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_student_attendance_student_class
     ON student_attendance (student_id, schedule_id)`,
    'idx_student_attendance_student_class (student_id, schedule_id)'
  );

  // 2. Student attendance — for queries that filter by schedule_id + tanggal
  // Query: student_attendance WHERE schedule_id = $1 AND tanggal = $2
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_student_attendance_schedule_date
     ON student_attendance (schedule_id, tanggal)`,
    'idx_student_attendance_schedule_date (schedule_id, tanggal)'
  );

  // 3. Teacher attendance — for teacher attendance logs lookup
  // Query: teacher_attendance WHERE user_id = $1 AND school_id = $2 ORDER BY tanggal DESC
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_teacher_attendance_user_school_date
     ON teacher_attendance (user_id, school_id, tanggal DESC)`,
    'idx_teacher_attendance_user_school_date (user_id, school_id, tanggal DESC)'
  );

  // 4. Data raport — for dashboard raport status by kelas + periode (LIKE query)
  // Query: data_raport WHERE kelas_id = $1 AND LOWER(periode) LIKE '%...%'
  // Note: leading-wildcard LIKE can't use B-tree. Use a regular index for =
  // The normalizeRaportPeriode function strips prefix, so we need an exact match approach.
  // For now, ensure klas + periode composite exists.
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_data_raport_kelas_periode
     ON data_raport (kelas_id, periode)`,
    'idx_data_raport_kelas_periode (kelas_id, periode)'
  );

  // 5. Data raport nilai mapel — batch lookup by data_raport_id + mapel
  // Query: data_raport_nilai_mapel WHERE data_raport_id = ANY($1) ORDER BY data_raport_id, mapel
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_data_raport_nilai_mapel_raport_mapel
     ON data_raport_nilai_mapel (data_raport_id, mapel_id)`,
    'idx_data_raport_nilai_mapel_raport_mapel (data_raport_id, mapel_id)'
  );

  // 6. Wali kelas assignments — for the my-classes query (Path B)
  // Query: wali_kelas_assignments WHERE wali_kelas_member_id = $1 AND status = 'aktif'
  // Note: partial index on status='aktif' + wali_kelas_member_id already exists for Path B,
  // but make sure it's optimal.
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_wali_kelas_member_status
     ON wali_kelas_assignments (wali_kelas_member_id) WHERE status = 'aktif'`,
    'idx_wali_kelas_member_status (partial: aktif assignments by member)'
  );

  // 7. Subjects — for school-level lookup
  // Query: subjects WHERE school_id = $1 ORDER BY nama_mapel
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_subjects_school_name
     ON subjects (school_id, nama_mapel)`,
    'idx_subjects_school_name (school_id, nama_mapel)'
  );

  // 8. Classes — for school-level lookup + wali_kelas join
  // Query: classes WHERE school_id = $1 ORDER BY nama_kelas
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_classes_school_name
     ON classes (school_id, nama_kelas)`,
    'idx_classes_school_name (school_id, nama_kelas)'
  );

  // 9. Students — for class lookup + ordering
  // Query: students WHERE class_id = $1 ORDER BY nomor_absen, nama_siswa
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_students_class_absen
     ON students (class_id, nomor_absen, nama_siswa)`,
    'idx_students_class_absen (class_id, nomor_absen, nama_siswa)'
  );

  // 10. Guru administrasi — for user-level lookup
  // Query: guru_administrasi WHERE user_id = $1 ORDER BY created_at DESC
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_guru_administrasi_user_date
     ON guru_administrasi (user_id, created_at DESC)`,
    'idx_guru_administrasi_user_date (user_id, created_at DESC)'
  );

  // 11. Transactions — for user payment history
  // Query: transactions WHERE user_id = $1 ORDER BY created_at DESC
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_transactions_user_date
     ON transactions (user_id, created_at DESC)`,
    'idx_transactions_user_date (user_id, created_at DESC)'
  );

  // 12. Teacher journals — composite for common dashboard query
  // Query: teacher_journals WHERE teacher_id = $1 AND school_id = $2 ORDER BY tanggal DESC
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_teacher_journals_teacher_date
     ON teacher_journals (teacher_id, school_id, tanggal DESC)`,
    'idx_teacher_journals_teacher_date (teacher_id, school_id, tanggal DESC)'
  );

  // 13. Assessment lookup by class + subject
  // Query: assessments WHERE class_id = $1 AND subject_id = $2
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_assessments_class_subject
     ON assessments (class_id, subject_id)`,
    'idx_assessments_class_subject (class_id, subject_id)'
  );

  // 14. Student grades — for batch lookup
  // Query: student_grades WHERE assessment_id = $1
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_student_grades_assessment
     ON student_grades (assessment_id, student_id)`,
    'idx_student_grades_assessment (assessment_id, student_id)'
  );

  // 15. Academic calendars — for school date range queries
  // Query: academic_calendars WHERE school_id = $1 AND tanggal_mulai <= $2 AND tanggal_selesai >= $2
  await addIndex(
    `CREATE INDEX IF NOT EXISTS idx_academic_calendars_school_date
     ON academic_calendars (school_id, tanggal_mulai, tanggal_selesai)`,
    'idx_academic_calendars_school_date (school_id, date range)'
  );

  console.log('\n✅ Index migration complete.');
  await pool.end();
}

main().catch(console.error);
