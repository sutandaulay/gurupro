/**
 * Test Data Seed Script
 *
 * PURPOSE: Create dummy data for E2E testing
 * ENVIRONMENT: Local/Test only - NEVER run against production
 *
 * Usage:
 *   npx tsx scripts/seed-test-data.ts [--reset] [--cleanup]
 *
 * Options:
 *   --reset    Drop and recreate all test data
 *   --cleanup  Clean up test data only
 */

import { Pool } from 'pg';

// ============================================
// CONFIGURATION
// ============================================

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const TEST_PREFIX = 'TEST_';
const TEST_EMAIL_PATTERN = `${TEST_PREFIX}%@test.gurupro.id`;

const pool = new Pool({ connectionString: DATABASE_URL });

// ============================================
// TYPES
// ============================================

interface TestUser {
  id: string;
  email: string;
  whatsapp: string;
  namaLengkap: string;
  cmsUserId?: string;
}

interface TestInstitution {
  id: number;
  name: string;
  npsn: string;
}

interface TestSchool {
  id: string;
  namaSekolah: string;
  npsn: string;
}

interface TestClass {
  id: string;
  namaKelas: string;
}

interface TestStudent {
  id: string;
  namaSiswa: string;
  nisn: string;
}

interface TestSubject {
  id: string;
  namaMapel: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generatePhoneNumber(): string {
  const prefixes = ['812', '813', '814', '815', '816', '817', '818', '819'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return `+628${prefix}${number}`;
}

function generateNPSN(): string {
  return `${TEST_PREFIX}${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
}

// ============================================
// CLEANUP FUNCTIONS
// ============================================

async function cleanupExistingTestData(): Promise<void> {
  console.log('🧹 Cleaning up existing test data...');

  const client = await pool.connect();

  try {
    // Delete in correct order to avoid FK constraint violations
    await client.query(`
      DELETE FROM in_app_notifications
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM raport_cache
      WHERE student_id IN (
        SELECT s.id FROM students s
        JOIN classes c ON s.class_id = c.id
        JOIN schools sch ON c.school_id = sch.id
        WHERE sch.npsn LIKE $1
      )
    `, [`${TEST_PREFIX}%`]);

    await client.query(`
      DELETE FROM student_grades
      WHERE assessment_id IN (
        SELECT a.id FROM assessments a
        JOIN classes c ON a.class_id = c.id
        JOIN schools sch ON c.school_id = sch.id
        WHERE sch.npsn LIKE $1
      )
    `, [`${TEST_PREFIX}%`]);

    await client.query(`
      DELETE FROM student_attendance
      WHERE student_id IN (
        SELECT s.id FROM students s
        JOIN classes c ON s.class_id = c.id
        JOIN schools sch ON c.school_id = sch.id
        WHERE sch.npsn LIKE $1
      )
    `, [`${TEST_PREFIX}%`]);

    await client.query(`
      DELETE FROM absent_alerts
      WHERE student_id IN (
        SELECT s.id FROM students s
        JOIN classes c ON s.class_id = c.id
        JOIN schools sch ON c.school_id = sch.id
        WHERE sch.npsn LIKE $1
      )
    `, [`${TEST_PREFIX}%`]);

    await client.query(`
      DELETE FROM documents_bukti
      WHERE guru_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM evidence_log
      WHERE guru_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM lesson_memories
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM teaching_sessions
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM laporan_kinerja
      WHERE guru_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM jurnal_supervisi
      WHERE journal_id IN (
        SELECT tj.id FROM teacher_journals tj
        WHERE tj.teacher_id IN (SELECT id FROM users WHERE email LIKE $1)
      )
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM teacher_journals
      WHERE teacher_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM guru_administrasi
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM question_banks
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM ai_chat_logs
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM admin_tasks
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    // Delete payload CMS related data
    await client.query(`
      DELETE FROM payload.otp_verifications
      WHERE user_id IN (SELECT id::text FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM payload.institution_members_role
      WHERE parent_id IN (
        SELECT im.id FROM payload.institution_members im
        JOIN users u ON im.app_user_id = u.id
        WHERE u.email LIKE $1
      )
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM payload.institution_members_assigned_mapel
      WHERE _parent_id IN (
        SELECT im.id FROM payload.institution_members im
        JOIN users u ON im.app_user_id = u.id
        WHERE u.email LIKE $1
      )
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM payload.institution_members_assigned_kelas
      WHERE _parent_id IN (
        SELECT im.id FROM payload.institution_members im
        JOIN users u ON im.app_user_id = u.id
        WHERE u.email LIKE $1
      )
    `, [TEST_EMAIL_PATTERN]);

    await client.query(`
      DELETE FROM payload.institution_members
      WHERE app_user_id IN (SELECT id FROM users WHERE email LIKE $1)
    `, [TEST_EMAIL_PATTERN]);

    // Delete students (cascade from classes)
    await client.query(`
      DELETE FROM students
      WHERE class_id IN (
        SELECT c.id FROM classes c
        JOIN schools sch ON c.school_id = sch.id
        WHERE sch.npsn LIKE $1
      )
    `, [`${TEST_PREFIX}%`]);

    // Delete schedules
    await client.query(`
      DELETE FROM schedules
      WHERE school_id IN (SELECT id FROM schools WHERE npsn LIKE $1)
    `, [`${TEST_PREFIX}%`]);

    // Delete assessments
    await client.query(`
      DELETE FROM assessments
      WHERE school_id IN (SELECT id FROM schools WHERE npsn LIKE $1)
    `, [`${TEST_PREFIX}%`]);

    // Delete academic calendars
    await client.query(`
      DELETE FROM academic_calendars
      WHERE school_id IN (SELECT id FROM schools WHERE npsn LIKE $1)
    `, [`${TEST_PREFIX}%`]);

    // Delete journal schemas
    await client.query(`
      DELETE FROM journal_schemas
      WHERE school_id IN (SELECT id FROM schools WHERE npsn LIKE $1)
    `, [`${TEST_PREFIX}%`]);

    // Delete classes
    await client.query(`
      DELETE FROM classes
      WHERE school_id IN (SELECT id FROM schools WHERE npsn LIKE $1)
    `, [`${TEST_PREFIX}%`]);

    // Delete subjects
    await client.query(`
      DELETE FROM subjects
      WHERE school_id IN (SELECT id FROM schools WHERE npsn LIKE $1)
    `, [`${TEST_PREFIX}%`]);

    // Delete schools
    await client.query(`
      DELETE FROM schools WHERE npsn LIKE $1
    `, [`${TEST_PREFIX}%`]);

    // Delete institution members for test institutions
    await client.query(`
      DELETE FROM payload.institution_members
      WHERE institution_id IN (
        SELECT id FROM payload.institutions WHERE npsn LIKE $1 OR name LIKE $2
      )
    `, [`${TEST_PREFIX}%`, `${TEST_PREFIX}%`]);

    // Delete institutions
    await client.query(`
      DELETE FROM payload.institutions
      WHERE npsn LIKE $1 OR name LIKE $2
    `, [`${TEST_PREFIX}%`, `${TEST_PREFIX}%`]);

    // Delete users (last, after all FK references are cleaned)
    await client.query(`
      DELETE FROM users WHERE email LIKE $1
    `, [TEST_EMAIL_PATTERN]);

    console.log('✅ Cleanup complete');
  } finally {
    client.release();
  }
}

// ============================================
// SEED FUNCTIONS
// ============================================

async function seedTestData(): Promise<{
  users: TestUser[];
  institutions: TestInstitution[];
  schools: TestSchool[];
  classes: TestClass[];
  students: TestStudent[];
  subjects: TestSubject[];
}> {
  console.log('🌱 Seeding test data...');

  const client = await pool.connect();

  const users: TestUser[] = [];
  const institutions: TestInstitution[] = [];
  const schools: TestSchool[] = [];
  const classes: TestClass[] = [];
  const students: TestStudent[] = [];
  const subjects: TestSubject[] = [];

  try {
    await client.query('BEGIN');

    // ============================================
    // 1. SEED USERS (3 Teachers with different tiers)
    // ============================================
    console.log('   Creating users...');

    // User 1: Free tier teacher
    const user1Result = await client.query(`
      INSERT INTO users (
        id, email, whatsapp, nama_lengkap, password_hash,
        status_langganan, token_limit, addon_token_balance,
        subscription_start, subscription_end, status,
        created_at, is_active, role, username
      ) VALUES (
        $1, $2, $3, $4, $5, 'free', 5, 0,
        NOW(), NOW() + INTERVAL '30 days', 'active',
        NOW(), true, 'guru', $6
      ) RETURNING id, email, whatsapp, nama_lengkap
    `, [
      generateUUID(),
      `${TEST_PREFIX}guru-free@test.gurupro.id`,
      generatePhoneNumber(),
      'TEST_Guru Gratis',
      'hashed_password_placeholder',
      'guru_free'
    ]);
    users.push(user1Result.rows[0]);

    // User 2: 3-month subscription teacher
    const user2Result = await client.query(`
      INSERT INTO users (
        id, email, whatsapp, nama_lengkap, password_hash,
        status_langganan, token_limit, addon_token_balance,
        subscription_start, subscription_end, status,
        created_at, is_active, role, username
      ) VALUES (
        $1, $2, $3, $4, $5, 'active', 500, 100,
        NOW(), NOW() + INTERVAL '90 days', 'active',
        NOW(), true, 'guru', $6
      ) RETURNING id, email, whatsapp, nama_lengkap
    `, [
      generateUUID(),
      `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
      generatePhoneNumber(),
      'TEST_Guru 3 Bulan',
      'hashed_password_placeholder',
      'guru_3bulan'
    ]);
    users.push(user2Result.rows[0]);

    // User 3: 1-year subscription teacher (quota exhausted scenario)
    const user3Result = await client.query(`
      INSERT INTO users (
        id, email, whatsapp, nama_lengkap, password_hash,
        status_langganan, token_limit, addon_token_balance,
        subscription_start, subscription_end, status,
        created_at, is_active, role, username,
        grace_period_ends_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'active', 0, 50,
        NOW() - INTERVAL '400 days', NOW() - INTERVAL '1 day', 'active',
        NOW() - INTERVAL '400 days', true, 'guru', $6,
        NOW() + INTERVAL '14 days'
      ) RETURNING id, email, whatsapp, nama_lengkap
    `, [
      generateUUID(),
      `${TEST_PREFIX}guru-1tahun@test.gurupro.id`,
      generatePhoneNumber(),
      'TEST_Guru 1 Tahun Grace Period',
      'hashed_password_placeholder',
      'guru_1tahun'
    ]);
    users.push(user3Result.rows[0]);

    // User 4: Wali Kelas
    const user4Result = await client.query(`
      INSERT INTO users (
        id, email, whatsapp, nama_lengkap, password_hash,
        status_langganan, token_limit, addon_token_balance,
        subscription_start, subscription_end, status,
        created_at, is_active, role, username
      ) VALUES (
        $1, $2, $3, $4, $5, 'active', 500, 0,
        NOW(), NOW() + INTERVAL '365 days', 'active',
        NOW(), true, 'guru', $6
      ) RETURNING id, email, whatsapp, nama_lengkap
    `, [
      generateUUID(),
      `${TEST_PREFIX}wali-kelas@test.gurupro.id`,
      generatePhoneNumber(),
      'TEST_Wali Kelas Test',
      'hashed_password_placeholder',
      'wali_kelas_test'
    ]);
    users.push(user4Result.rows[0]);

    console.log(`   ✅ Created ${users.length} users`);

    // ============================================
    // 2. SEED INSTITUTIONS
    // ============================================
    console.log('   Creating institutions...');

    // Institution 1: SMP with complete RBAC
    const inst1Result = await client.query(`
      INSERT INTO payload.institutions (
        name, npsn, jenjang, naungan, subscription_tier,
        academic_year_active, approval_layer_config, status
      ) VALUES ($1, $2, 'SMP', 'Kemendikbud', 'premium', '2025/2026', 'single', 'active')
      RETURNING id, name, npsn
    `, [`${TEST_PREFIX}SMP Negeri 1 Test`, `${TEST_PREFIX}0001`]);
    institutions.push(inst1Result.rows[0]);

    // Institution 2: SMA with double approval
    const inst2Result = await client.query(`
      INSERT INTO payload.institutions (
        name, npsn, jenjang, naungan, subscription_tier,
        academic_year_active, approval_layer_config, status
      ) VALUES ($1, $2, 'SMA', 'Kemendikbud', 'enterprise', '2025/2026', 'double', 'active')
      RETURNING id, name, npsn
    `, [`${TEST_PREFIX}SMA Negeri 1 Test`, `${TEST_PREFIX}0002`]);
    institutions.push(inst2Result.rows[0]);

    console.log(`   ✅ Created ${institutions.length} institutions`);

    // ============================================
    // 3. SEED SCHOOLS
    // ============================================
    console.log('   Creating schools...');

    const school1Result = await client.query(`
      INSERT INTO schools (
        id, user_id, nama_sekolah, npsn, alamat,
        nama_kepala_sekolah, nip_kepala_sekolah
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, nama_sekolah, npsn
    `, [
      generateUUID(),
      users[0].id,
      `${TEST_PREFIX}SMP Negeri 1 Jakarta`,
      `${TEST_PREFIX}0001`,
      'Jl. Test No. 1, Jakarta',
      'TEST_Drs. Kepala Sekolah',
      `${TEST_PREFIX}12345678`
    ]);
    schools.push(school1Result.rows[0]);

    console.log(`   ✅ Created ${schools.length} schools`);

    // ============================================
    // 4. SEED SUBJECTS
    // ============================================
    console.log('   Creating subjects...');

    const subjectNames = [
      'Matematika', 'Bahasa Indonesia', 'Bahasa Inggris',
      'IPA', 'IPS', 'Pendidikan Agama Islam',
      'Pendidikan Pancasila', 'Seni Budaya', 'Prakarya'
    ];

    for (const namaMapel of subjectNames) {
      const result = await client.query(`
        INSERT INTO subjects (id, school_id, nama_mapel)
        VALUES ($1, $2, $3)
        RETURNING id, nama_mapel
      `, [generateUUID(), schools[0].id, namaMapel]);
      subjects.push(result.rows[0]);
    }

    console.log(`   ✅ Created ${subjects.length} subjects`);

    // ============================================
    // 5. SEED CLASSES
    // ============================================
    console.log('   Creating classes...');

    const classNames = ['VII-A', 'VII-B', 'VIII-A', 'VIII-B', 'IX-A'];
    for (const namaKelas of classNames) {
      const result = await client.query(`
        INSERT INTO classes (id, school_id, nama_kelas, wali_kelas)
        VALUES ($1, $2, $3, $4)
        RETURNING id, nama_kelas
      `, [generateUUID(), schools[0].id, namaKelas, namaKelas === 'VII-A' ? users[3].namaLengkap : null]);
      classes.push(result.rows[0]);
    }

    console.log(`   ✅ Created ${classes.length} classes`);

    // ============================================
    // 6. SEED STUDENTS (10-20 per class)
    // ============================================
    console.log('   Creating students...');

    const firstNames = ['Ahmad', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Ika', 'Joko',
                        'Kiki', 'Lina', 'Mira', 'Nina', 'Oscar', 'Putri', 'Qori', 'Rudi', 'Sari', 'Toni'];

    for (const classItem of classes) {
      const studentCount = Math.floor(Math.random() * 11) + 10; // 10-20 students

      for (let i = 0; i < studentCount; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const result = await client.query(`
          INSERT INTO students (id, class_id, nama_siswa, nisn, nomor_absen)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, nama_siswa, nisn
        `, [
          generateUUID(),
          classItem.id,
          `TEST_${firstName} ${classItem.namaKelas}`,
          `${TEST_PREFIX}${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
          i + 1
        ]);
        students.push(result.rows[0]);
      }
    }

    console.log(`   ✅ Created ${students.length} students`);

    // ============================================
    // 7. SEED SCHEDULES
    // ============================================
    console.log('   Creating schedules...');

    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    for (const classItem of classes) {
      for (let i = 0; i < 5; i++) {
        await client.query(`
          INSERT INTO schedules (id, school_id, class_id, subject_id, hari, jam_mulai, jam_selesai)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          generateUUID(),
          schools[0].id,
          classItem.id,
          subjects[i % subjects.length].id,
          days[i],
          `${7 + i}:00`,
          `${8 + i}:00`
        ]);
      }
    }

    console.log('   ✅ Created schedules');

    // ============================================
    // 8. SEED INSTITUTION MEMBERS (Complete RBAC)
    // ============================================
    console.log('   Creating institution members...');

    // Create CMS users for institution members
    for (const user of users) {
      await client.query(`
        INSERT INTO payload.cms_users (name, email, role, salt, hash)
        VALUES ($1, $2, 'editor', '', '')
      `, [user.namaLengkap, user.email]);
    }

    // Assign roles to institution 1
    const roles = [
      { role: 'kepala_sekolah', userEmail: users[0].email },
      { role: 'wakasek', userEmail: users[1].email },
      { role: 'operator', userEmail: users[2].email },
      { role: 'admin_sekolah', userEmail: users[3].email },
      { role: 'bendahara', userEmail: users[0].email },
      { role: 'guru', userEmail: users[1].email },
    ];

    for (const { role, userEmail } of roles) {
      const memberResult = await client.query(`
        INSERT INTO payload.institution_members (
          user_id, app_user_id, institution_id, status
        )
        SELECT
          cu.id, u.id, $3, 'active'
        FROM payload.cms_users cu
        JOIN users u ON u.email = cu.email
        WHERE cu.email = $2
        RETURNING id
      `, [role, userEmail, institutions[0].id]);

      await client.query(`
        INSERT INTO payload.institution_members_role (parent_id, "order", value)
        VALUES ($1, 0, $2)
      `, [memberResult.rows[0].id, role]);
    }

    console.log('   ✅ Created institution members');

    // ============================================
    // 9. SEED SAMPLE DOCUMENTS (Administrasi)
    // ============================================
    console.log('   Creating sample documents...');

    const documentTypes = ['RPP', 'Modul Ajar', 'Silabus', 'LKPD'];
    for (const user of users.slice(0, 2)) {
      for (const docType of documentTypes) {
        await client.query(`
          INSERT INTO guru_administrasi (
            id, user_id, tipe_dokumen, judul_dokumen, konten,
            owned_by_institution, institution_id
          ) VALUES ($1, $2, $3, $4, $5, false, NULL)
        `, [
          generateUUID(),
          user.id,
          docType.toLowerCase().replace(' ', '_'),
          `TEST_${docType} ${user.namaLengkap}`,
          JSON.stringify({ dummy: 'content', createdFor: 'testing' })
        ]);
      }
    }

    console.log('   ✅ Created sample documents');

    await client.query('COMMIT');

    console.log('✅ Test data seeding complete!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Institutions: ${institutions.length}`);
    console.log(`   - Schools: ${schools.length}`);
    console.log(`   - Classes: ${classes.length}`);
    console.log(`   - Students: ${students.length}`);
    console.log(`   - Subjects: ${subjects.length}`);

    return { users, institutions, schools, classes, students, subjects };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const isReset = args.includes('--reset');
  const isCleanup = args.includes('--cleanup');

  try {
    // Test database connection
    const client = await pool.connect();
    console.log('✅ Database connection OK');
    client.release();

    if (isCleanup) {
      await cleanupExistingTestData();
      console.log('💾 Cleanup complete');
      await pool.end();
      return;
    }

    if (isReset) {
      console.log('⚠️  Reset mode: Cleaning up existing data first...');
      await cleanupExistingTestData();
    }

    await seedTestData();

    console.log('');
    console.log('📝 Test Credentials:');
    console.log('   Free Tier:');
    console.log(`     Email: ${TEST_PREFIX}guru-free@test.gurupro.id`);
    console.log('     Password: test123 (or as set in seed)');
    console.log('');
    console.log('   3-Month:');
    console.log(`     Email: ${TEST_PREFIX}guru-3bulan@test.gurupro.id`);
    console.log('');
    console.log('   1-Year (Grace Period):');
    console.log(`     Email: ${TEST_PREFIX}guru-1tahun@test.gurupro.id`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
