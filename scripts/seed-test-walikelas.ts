/**
 * Seed Script: Test Data for Wali Kelas + Guru Mapel Flow
 *
 * Creates:
 * - Subject MATEMATIKA
 * - Test teacher user with 10.000 poin subscription
 * - Assessments & grades for class X.1 SMA IDEA 1
 * - Rapor with nilai_mapel, status = 'dikirim_ke_wali_kelas'
 *
 * Usage: npx tsx scripts/seed-test-walikelas.ts
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const pool = new Pool({ connectionString: DATABASE_URL });
const SALT_ROUNDS = 10;

// ============================================
// KNOWN IDs (SMA IDEA 1 - ElHanum, M.Pd)
// ============================================
const WALI_KELAS_USER_ID = '50e096cc-9dc2-4403-b731-5506088ddc32';
const SCHOOL_ID = '8606e992-1379-41ef-8834-e834e9312dee';
const CLASS_ID = 'a70db632-5e6a-4654-8eeb-90646814500d';
const PAYLOAD_INSTITUTION_ID = 7;
const EXISTING_SUBJECT_BIND = 'a4715dcc-c46f-4ee6-9ee8-71bc734084b6';

const STUDENTS = [
  { id: '5beed45d-6e0b-4023-b244-c337450985cf', nama: 'Siswono', nisn: '77226633' },
  { id: 'c7e6f4a7-f9e2-45ce-a46e-831bdb4fab16', nama: 'Lestari', nisn: '221133' },
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  console.log('=== SEED TEST WALI KELAS ===\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ============================================
    // 1. ADD MATEMATIKA SUBJECT
    // ============================================
    console.log('1. Adding MATEMATIKA subject...');
    const mathSubject = await client.query(
      `INSERT INTO subjects (school_id, nama_mapel)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [SCHOOL_ID, 'MATEMATIKA']
    );
    const MATH_SUBJECT_ID = mathSubject.rows.length > 0
      ? mathSubject.rows[0].id
      : (await client.query(`SELECT id FROM subjects WHERE school_id = $1 AND nama_mapel = 'MATEMATIKA'`, [SCHOOL_ID])).rows[0].id;
    console.log(`   MATEMATIKA ID: ${MATH_SUBJECT_ID}`);

    // ============================================
    // 2. CREATE TEST TEACHER USER
    // ============================================
    console.log('\n2. Creating test teacher user...');
    const hashedPassword = await hashPassword('test123');
    const newUser = await client.query(
      `INSERT INTO users (email, whatsapp, nama_lengkap, password_hash, role, is_active, phone_verified, email_verified)
       VALUES ($1, $2, $3, $4, 'guru', true, true, true)
       RETURNING id`,
      ['guru.test@idea1.sch.id', '+6281111111113', 'Guru Test Mapel', hashedPassword]
    );
    const GURU_TEST_USER_ID = newUser.rows[0].id;
    console.log(`   User ID: ${GURU_TEST_USER_ID}`);

    // Give 10.000 poin subscription
    await client.query(
      `UPDATE users SET
         quota_poin_total = 10000,
         quota_poin_used = 0,
         status_langganan = 'active',
         subscription_status = 'active',
         subscription_start = NOW(),
         subscription_end = NOW() + INTERVAL '365 days'
       WHERE id = $1`,
      [GURU_TEST_USER_ID]
    );
    console.log('   Subscription: 10.000 poin granted');

    // ============================================
    // 3. CREATE CMS USER (Payload)
    // ============================================
    console.log('\n3. Creating Payload CMS user...');
    const cmsUser = await client.query(
      `INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at)
       VALUES ('Guru Test Mapel', 'guru.test@idea1.sch.id', 'admin', '', '', true, '1.0', NOW())
       RETURNING id`
    );
    const CMS_USER_ID = cmsUser.rows[0].id;
    console.log(`   CMS User ID: ${CMS_USER_ID}`);

    // ============================================
    // 4. CREATE INSTITUTION MEMBER (Payload)
    // ============================================
    console.log('\n4. Creating institution member...');
    const member = await client.query(
      `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at)
       VALUES ($1, $2, $3, 'active', NOW())
       RETURNING id`,
      [CMS_USER_ID, GURU_TEST_USER_ID, PAYLOAD_INSTITUTION_ID]
    );
    const GURU_MEMBER_ID = member.rows[0].id;
    console.log(`   Institution Member ID: ${GURU_MEMBER_ID}`);

    // Add guru role
    await client.query(
      `INSERT INTO payload.institution_members_role ("order", parent_id, value)
       VALUES (1, $1, 'guru')`,
      [GURU_MEMBER_ID]
    );
    console.log('   Role: guru');

    // ============================================
    // 5. CREATE ASSESSMENTS
    // ============================================
    console.log('\n5. Creating assessments...');
    const PERIODE = '2026/2027-Ganjil';

    // Matematika assessments
    const mathMateri1 = await client.query(
      `INSERT INTO assessments (school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkm, is_akhir_semester)
       VALUES ($1, $2, $3, 'Sumatif Materi 1', 'Sumatif', 70, false)
       RETURNING id`,
      [SCHOOL_ID, CLASS_ID, MATH_SUBJECT_ID]
    );
    const mathAkhir = await client.query(
      `INSERT INTO assessments (school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkm, is_akhir_semester)
       VALUES ($1, $2, $3, 'Sumatif Akhir Semester', 'Sumatif', 70, true)
       RETURNING id`,
      [SCHOOL_ID, CLASS_ID, MATH_SUBJECT_ID]
    );

    // BAHASA INDONESIA assessments
    const bindMateri1 = await client.query(
      `INSERT INTO assessments (school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkm, is_akhir_semester)
       VALUES ($1, $2, $3, 'Sumatif Materi 1', 'Sumatif', 70, false)
       RETURNING id`,
      [SCHOOL_ID, CLASS_ID, EXISTING_SUBJECT_BIND]
    );
    const bindAkhir = await client.query(
      `INSERT INTO assessments (school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkm, is_akhir_semester)
       VALUES ($1, $2, $3, 'Sumatif Akhir Semester', 'Sumatif', 70, true)
       RETURNING id`,
      [SCHOOL_ID, CLASS_ID, EXISTING_SUBJECT_BIND]
    );
    console.log('   Assessments created for both subjects');

    // ============================================
    // 6. INPUT STUDENT GRADES
    // ============================================
    console.log('\n6. Inputting student grades...');
    const gradeData = [
      // Siswono: Math 80 (materi) + 85 (akhir), BIND 78 (materi) + 82 (akhir)
      { studentId: STUDENTS[0].id, assessmentId: mathMateri1.rows[0].id, nilai: 80 },
      { studentId: STUDENTS[0].id, assessmentId: mathAkhir.rows[0].id, nilai: 85 },
      { studentId: STUDENTS[0].id, assessmentId: bindMateri1.rows[0].id, nilai: 78 },
      { studentId: STUDENTS[0].id, assessmentId: bindAkhir.rows[0].id, nilai: 82 },
      // Lestari: Math 90 (materi) + 88 (akhir), BIND 85 (materi) + 90 (akhir)
      { studentId: STUDENTS[1].id, assessmentId: mathMateri1.rows[0].id, nilai: 90 },
      { studentId: STUDENTS[1].id, assessmentId: mathAkhir.rows[0].id, nilai: 88 },
      { studentId: STUDENTS[1].id, assessmentId: bindMateri1.rows[0].id, nilai: 85 },
      { studentId: STUDENTS[1].id, assessmentId: bindAkhir.rows[0].id, nilai: 90 },
    ];

    for (const g of gradeData) {
      await client.query(
        `INSERT INTO student_grades (assessment_id, student_id, nilai_awal, nilai_remedial, nilai_akhir, status_remedial)
         VALUES ($1, $2, $3, NULL, $3, 'Lulus')`,
        [g.assessmentId, g.studentId, g.nilai]
      );
    }
    console.log('   Student grades entered');

    // ============================================
    // 7. CREATE TEMPLATE RAPORT (if not exists)
    // ============================================
    console.log('\n7. Creating template raport...');
    const template = await client.query(
      `INSERT INTO template_raport (sekolah_id, nama_template, jalur_regulasi, jenjang, kurikulum, jenis_laporan, mode_nilai_akademik, varian_sikap, basis_deskripsi, sections, is_default)
       VALUES ($1, 'Template SMA Kurikulum Merdeka', 'kemendikdasmen', 'sma_ma', 'kurikulum_merdeka', 'akhir_semester', 'angka_kkm', 'profil_pelajar_pancasila', 'capaian_pembelajaran',
         $2::jsonb, true)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [SCHOOL_ID, JSON.stringify([
        { sectionType: 'header', order: 1, wajib: true },
        { sectionType: 'identitas', order: 2, wajib: true },
        { sectionType: 'sikap', order: 3, wajib: true },
        { sectionType: 'nilai_mapel', order: 4, wajib: true },
        { sectionType: 'ekskul', order: 5, wajib: true },
        { sectionType: 'catatan_wali_kelas', order: 6, wajib: true },
        { sectionType: 'footer', order: 7, wajib: true },
      ])]
    );
    let TEMPLATE_ID = template.rows.length > 0
      ? template.rows[0].id
      : (await client.query(`SELECT id FROM template_raport WHERE sekolah_id = $1 LIMIT 1`, [SCHOOL_ID])).rows[0]?.id;

    if (!TEMPLATE_ID) {
      // Force insert if ON CONFLICT didn't return
      const forced = await client.query(
        `INSERT INTO template_raport (sekolah_id, nama_template, jalur_regulasi, jenjang, kurikulum, jenis_laporan, mode_nilai_akademik, varian_sikap, basis_deskripsi, sections, is_default)
         VALUES ($1, 'Template SMA Kurikulum Merdeka', 'kemendikdasmen', 'sma_ma', 'kurikulum_merdeka', 'akhir_semester', 'angka_kkm', 'profil_pelajar_pancasila', 'capaian_pembelajaran',
           $2::jsonb, true)
         RETURNING id`,
        [SCHOOL_ID, JSON.stringify([])]
      );
      TEMPLATE_ID = forced.rows[0].id;
    }
    console.log(`   Template ID: ${TEMPLATE_ID}`);

    // ============================================
    // 8. CREATE DATA RAPORT & NILAI MAPEL
    // ============================================
    console.log('\n8. Creating raport data...');
    const subjectMapel = [
      { mapelId: MATH_SUBJECT_ID, nama: 'MATEMATIKA', nilai: [82.5, 89] },
      { mapelId: EXISTING_SUBJECT_BIND, nama: 'BAHASA INDONESIA', nilai: [80, 87.5] },
    ];

    for (let si = 0; si < STUDENTS.length; si++) {
      const s = STUDENTS[si];

      // Create data_raport
      const raport = await client.query(
        `INSERT INTO data_raport (siswa_id, nisn, nis_lokal, kelas_id, template_raport_id, periode, jenis_laporan, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'akhir_semester', 'draft')
         RETURNING id`,
        [s.id, s.nisn, `NL00${si + 1}`, CLASS_ID, TEMPLATE_ID, PERIODE]
      );
      const RAPORT_ID = raport.rows[0].id;
      console.log(`   Raport ${s.nama}: ${RAPORT_ID}`);

      // Record status history
      await client.query(
        `INSERT INTO data_raport_status_history (data_raport_id, status, changed_by, changed_by_role)
         VALUES ($1, 'draft', $2, 'system')`,
        [RAPORT_ID, GURU_TEST_USER_ID]
      );

      // Create nilai_mapel entries
      for (const m of subjectMapel) {
        const nilaiAkhir = m.nilai[si];
        await client.query(
          `INSERT INTO data_raport_nilai_mapel (data_raport_id, mapel_id, guru_mapel_member_id, nilai_akhir, kkm, deskripsi_capaian, dikonfirmasi_guru, deskripsi_sumber_ai, deskripsi_dibuka_untuk_review)
           VALUES ($1, $2, $3, $4, 70, $5, false, false, true)`,
          [
            RAPORT_ID,
            m.mapelId,
            GURU_TEST_USER_ID,
            nilaiAkhir,
            `Siswa menunjukkan pemahaman yang baik pada ${m.nama}`
          ]
        );
      }
    }
    console.log('   Raport & nilai mapel created');

    // ============================================
    // 9. SET STATUS → dikirim_ke_wali_kelas
    // ============================================
    console.log('\n9. Confirming grades & sending to wali kelas...');
    const raports = await client.query(
      `SELECT id FROM data_raport WHERE kelas_id = $1 AND periode = $2`,
      [CLASS_ID, PERIODE]
    );

    for (const r of raports.rows) {
      // Confirm all nilai_mapel
      await client.query(
        `UPDATE data_raport_nilai_mapel SET dikonfirmasi_guru = true WHERE data_raport_id = $1`,
        [r.id]
      );

      // Set status: draft → dikirim_ke_wali_kelas
      await client.query(
        `UPDATE data_raport SET status = 'dikirim_ke_wali_kelas', updated_at = NOW() WHERE id = $1`,
        [r.id]
      );

      await client.query(
        `INSERT INTO data_raport_status_history (data_raport_id, status, changed_by, changed_by_role)
         VALUES ($1, 'dikirim_ke_wali_kelas', $2, 'guru_mapel')`,
        [r.id, GURU_TEST_USER_ID]
      );
    }
    console.log('   Status → dikirim_ke_wali_kelas');

    await client.query('COMMIT');

    console.log('\n=== SEED COMPLETE ===');
    console.log('\nTest Teacher Login:');
    console.log('   Email: guru.test@idea1.sch.id');
    console.log('   Password: test123');
    console.log('   Poin: 10.000');
    console.log('\nWhat to check:');
    console.log('   1. Login as guru.test@idea1.sch.id (password: test123)');
    console.log('   2. Should see sidebar menu muncul');
    console.log('   3. Bisa input nilai assessment');
    console.log('\n   4. Login as ElHanum (wali kelas)');
    console.log('   5. Buka menu Raport → Status Raport → pilih kelas X.1');
    console.log('   6. Status siswa harus "Dikirim ke Wali Kelas"');
    console.log('   7. Buka menu Raport → Review Nilai Raport');
    console.log('   8. Lihat & konfirmasi nilai dari Guru Test Mapel');
    console.log('   9. Dashboard Wali Kelas juga harus muncul dengan kelas X.1\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
