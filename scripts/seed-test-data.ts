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
import bcrypt from 'bcrypt';

// ============================================
// CONFIGURATION
// ============================================

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const TEST_PREFIX = 'TEST_';
const TEST_EMAIL_PATTERN = `${TEST_PREFIX}%@test.gurupro.id`;

const pool = new Pool({ connectionString: DATABASE_URL });

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================
// CLEANUP FUNCTIONS
// ============================================

async function cleanupExistingTestData(): Promise<void> {
  console.log('🧹 Cleaning up existing test data...');
  const c = await pool.connect();
  try {
    const tables = [
      'data_raport_status_history', 'data_raport_nilai_mapel', 'data_raport', 'template_raport',
      'catatan_wali_kelas', 'penilaian_ekstrakurikuler', 'penilaian_sikap', 'ekstrakurikuler',
      'observasi_indikator', 'observasi_kinerja', 'skp_indikator', 'skp_tahunan',
      'laporan_kinerja', 'dokumen_bukti', 'pelatihan_guru', 'evidence_log', 'absent_alerts',
      'student_grades', 'student_attendance', 'raport_cache', 'journal_supervisions',
      'teacher_journals', 'teaching_sessions', 'school_teaching_sessions', 'lesson_memories',
      'ai_chat_logs', 'admin_tasks', 'payout_requests', 'transactions', 'question_banks',
      'duty_assignments', 'assessments', 'schedules', 'students', 'wali_kelas_assignments',
      'classes', 'subjects', 'academic_calendars', 'journal_schemas', 'teacher_attendance',
      'user_school_assignments', 'tahun_ajaran', 'guru_administrasi', 'GeminiCache', 'TokenUsage',
      'payload.institution_members_assigned_kelas', 'payload.institution_members_assigned_mapel',
      'payload.institution_members_role', 'payload.institution_members', 'payload.invitations',
      'payload.otp_verifications', 'payload.pricing_plans', 'payload.landing_page_hero_stats',
      'payload.landing_page', 'payload.footer_content_social_links', 'payload.footer_content_links',
      'payload.footer_content', 'payload.chatbot_config', 'payload.cms_features', 'payload.why_points',
      'payload.categories', 'payload.posts', 'payload.media', 'payload.cms_users_sessions',
      'payload.cms_users', 'payload.institutions'
    ];
    for (const t of tables) {
      try { await c.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`); } catch {}
    }
    await c.query(`DELETE FROM schools WHERE npsn LIKE $1`, [`${TEST_PREFIX}%`]);
    await c.query(`DELETE FROM users WHERE email LIKE $1`, [TEST_EMAIL_PATTERN]);
    // Also cleanup elhanum test user by ID
    await c.query(`DELETE FROM users WHERE id = $1`, ['50e096cc-9dc2-4403-b731-5506088ddc32']);
    await c.query(`DELETE FROM schools WHERE id = $1`, ['8606e992-1379-41ef-8834-e834e9312dee']);
    console.log('✅ Cleanup complete');
  } finally {
    c.release();
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
    const hashedPassword1 = await hashPassword('test123');
    const user1Result = await client.query(`
       INSERT INTO users (
         id, email, whatsapp, nama_lengkap, password_hash,
         status_langganan, token_limit, addon_token_balance,
         subscription_start, subscription_end,
         created_at, is_active, role, username,
         phone_verified, email_verified, login_attempts, lock_until
       ) VALUES (
         $1, $2, $3, $4, $5, 'free', 5, 0,
         NOW(), NOW() + INTERVAL '30 days',
         NOW(), true, 'guru', $6,
         true, true, 0, NULL
       ) RETURNING id, email, whatsapp, nama_lengkap
    `, [
      generateUUID(),
      `${TEST_PREFIX}guru-free@test.gurupro.id`,
      generatePhoneNumber(),
      'TEST_Guru Gratis',
      hashedPassword1,
      'guru_free'
    ]);
    users.push(user1Result.rows[0]);

    // User 2: 3-month subscription teacher
    const hashedPassword2 = await hashPassword('test123');
    const user2Result = await client.query(`
       INSERT INTO users (
         id, email, whatsapp, nama_lengkap, password_hash,
         status_langganan, token_limit, addon_token_balance,
         subscription_start, subscription_end,
         created_at, is_active, role, username,
         phone_verified, email_verified, login_attempts, lock_until
       ) VALUES (
         $1, $2, $3, $4, $5, 'active', 500, 100,
         NOW(), NOW() + INTERVAL '90 days',
         NOW(), true, 'guru', $6,
         true, true, 0, NULL
       ) RETURNING id, email, whatsapp, nama_lengkap
    `, [
      generateUUID(),
      `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
      generatePhoneNumber(),
      'TEST_Guru 3 Bulan',
      hashedPassword2,
      'guru_3bulan'
    ]);
    users.push(user2Result.rows[0]);

    // User 3: 1-year subscription teacher (quota exhausted scenario)
    const hashedPassword3 = await hashPassword('test123');
    const user3Result = await client.query(`
      INSERT INTO users (
        id, email, whatsapp, nama_lengkap, password_hash,
        status_langganan, token_limit, addon_token_balance,
        subscription_start, subscription_end,
        created_at, is_active, role, username,
        grace_period_ends_at,
        phone_verified, email_verified, login_attempts, lock_until
      ) VALUES (
        $1, $2, $3, $4, $5, 'active', 0, 50,
        NOW() - INTERVAL '400 days', NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '400 days', true, 'guru', $6,
        NOW() + INTERVAL '14 days',
        true, true, 0, NULL
      ) RETURNING id, email, whatsapp, nama_lengkap
    `, [
      generateUUID(),
      `${TEST_PREFIX}guru-1tahun@test.gurupro.id`,
      generatePhoneNumber(),
      'TEST_Guru 1 Tahun Grace Period',
      hashedPassword3,
      'guru_1tahun'
    ]);
    users.push(user3Result.rows[0]);

    // User 4: Wali Kelas (elhanum)
    const ELHANUM_USER_ID = '50e096cc-9dc2-4403-b731-5506088ddc32';
    const ELHANUM_EMAIL = 'ptgenerasidigitalindonesiaemas@gmail.com';
    const hashedPassword4 = await hashPassword('test123');
    const user4Result = await client.query(`
      INSERT INTO users (
        id, email, whatsapp, nama_lengkap, password_hash,
        status_langganan, token_limit, addon_token_balance,
        subscription_start, subscription_end,
        created_at, is_active, role, username,
        phone_verified, email_verified, login_attempts, lock_until
      ) VALUES (
        $1, $2, $3, $4, $5, 'active', 500, 0,
        NOW(), NOW() + INTERVAL '365 days',
        NOW(), true, 'guru', $6,
        true, true, 0, NULL
      ) RETURNING id, email, whatsapp, nama_lengkap
    `, [
      ELHANUM_USER_ID,
      ELHANUM_EMAIL,
      '+6281234567890',
      'ElHanum, M.Pd',
      hashedPassword4,
      'elhanum'
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

    // School 2: elhanum's school (SMA IDEA 1)
    const ELHANUM_SCHOOL_ID = '8606e992-1379-41ef-8834-e834e9312dee';
    const school2Result = await client.query(`
      INSERT INTO schools (
        id, user_id, nama_sekolah, npsn, alamat,
        nama_kepala_sekolah, nip_kepala_sekolah,
        nama_wali_kelas, nip_wali_kelas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, nama_sekolah, npsn
    `, [
      ELHANUM_SCHOOL_ID,
      ELHANUM_USER_ID,
      'SMA IDEA 1',
      '20202020',
      'Jl. Pendidikan No. 1, Jakarta',
      'Drs. Kepala Sekolah',
      '196501011990031000',
      'ElHanum, M.Pd',
      '198505052010122000'
    ]);
    schools.push(school2Result.rows[0]);

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

    // Subjects for school 1 (SMP)
    for (const namaMapel of subjectNames) {
      const result = await client.query(`
        INSERT INTO subjects (id, school_id, nama_mapel)
        VALUES ($1, $2, $3)
        RETURNING id, nama_mapel
      `, [generateUUID(), schools[0].id, namaMapel]);
      subjects.push(result.rows[0]);
    }

    // Subjects for school 2 (elhanum's SMA IDEA 1)
    const smaSubjectNames = [
      'MATEMATIKA', 'BAHASA INDONESIA', 'BAHASA INGGRIS',
      'FISIKA', 'KIMIA', 'BIOLOGI',
      'SEJARAH', 'GEOGRAFI', 'EKONOMI',
      'SOSIOLOGI', 'INFORMATIKA', 'PENDIDIKAN AGAMA ISLAM',
      'PENDIDIKAN PANCASILA', 'SENI BUDAYA', 'PRAKARYA',
      'PENDIDIKAN JASMANI', 'BAHASA JAWA', 'BAHASA ARAB'
    ];

    for (const namaMapel of smaSubjectNames) {
      const result = await client.query(`
        INSERT INTO subjects (id, school_id, nama_mapel)
        VALUES ($1, $2, $3)
        RETURNING id, nama_mapel
      `, [generateUUID(), schools[1].id, namaMapel]);
      subjects.push(result.rows[0]);
    }

    console.log(`   ✅ Created ${subjects.length} subjects`);

    // ============================================
    // 5. SEED CLASSES
    // ============================================
    console.log('   Creating classes...');

    // Classes for school 1 (SMP)
    const smpClassNames = ['VII-A', 'VII-B', 'VIII-A', 'VIII-B', 'IX-A'];
    for (const namaKelas of smpClassNames) {
      const result = await client.query(`
        INSERT INTO classes (id, school_id, nama_kelas, wali_kelas)
        VALUES ($1, $2, $3, $4)
        RETURNING id, nama_kelas
      `, [generateUUID(), schools[0].id, namaKelas, namaKelas === 'VII-A' ? users[3].nama_lengkap : null]);
      classes.push(result.rows[0]);
    }

    // Classes for school 2 (elhanum's SMA IDEA 1) - X.1 is elhanum's wali kelas
    const ELHANUM_CLASS_ID = 'a70db632-5e6a-4654-8eeb-90646814500d';
    const smaClassNames = ['X.1', 'X.2', 'X.3', 'XI.1', 'XI.2', 'XI.3', 'XII.1', 'XII.2'];
    for (const namaKelas of smaClassNames) {
      const classId = namaKelas === 'X.1' ? ELHANUM_CLASS_ID : generateUUID();
      const waliKelas = namaKelas === 'X.1' ? 'ElHanum, M.Pd' : null;
      const waliKelasUserId = namaKelas === 'X.1' ? ELHANUM_USER_ID : null;
      const result = await client.query(`
        INSERT INTO classes (id, school_id, nama_kelas, wali_kelas, wali_kelas_user_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, nama_kelas
      `, [classId, schools[1].id, namaKelas, waliKelas, waliKelasUserId]);
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

    // Specific students for elhanum's class X.1 (from walikelas seed)
    const elhanumStudents = [
      { id: '5beed45d-6e0b-4023-b244-c337450985cf', nama: 'Siswono', nisn: '77226633' },
      { id: 'c7e6f4a7-f9e2-45ce-a46e-831bdb4fab16', nama: 'Lestari', nisn: '221133' },
    ];
    
    const elhanumClass = classes.find(c => c.nama_kelas === 'X.1');
    if (elhanumClass) {
      for (let i = 0; i < elhanumStudents.length; i++) {
        const s = elhanumStudents[i];
        await client.query(`
          INSERT INTO students (id, class_id, nama_siswa, nisn, nomor_absen)
          VALUES ($1, $2, $3, $4, $5)
        `, [s.id, elhanumClass.id, s.nama, s.nisn, i + 1]);
        students.push({ id: s.id, nama_siswa: s.nama, nisn: s.nisn });
      }
    }

    console.log(`   ✅ Created ${students.length} students`);

    // ============================================
    // 7. SEED SCHEDULES
    // ============================================
    console.log('   Creating schedules...');

    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    
    // Schedules for school 1 (SMP)
    const smpClasses = classes.filter(c => c.id.startsWith(generateUUID().substring(0, 1)) || true).filter(c => {
      // Filter SMP classes (VII-A, VII-B, VIII-A, VIII-B, IX-A)
      return ['VII-A', 'VII-B', 'VIII-A', 'VIII-B', 'IX-A'].includes(c.nama_kelas);
    });
    
    // Schedules for school 2 (SMA IDEA 1)
    const smaClasses = classes.filter(c => ['X.1', 'X.2', 'X.3', 'XI.1', 'XI.2', 'XI.3', 'XII.1', 'XII.2'].includes(c.nama_kelas));
    
    const smpSubjects = subjects.filter(s => {
      // Get subjects for school 1
      const smpSubjectNames = ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama Islam', 'Pendidikan Pancasila', 'Seni Budaya', 'Prakarya'];
      return smpSubjectNames.includes(s.nama_mapel);
    });
    
    const smaSubjects = subjects.filter(s => {
      const smaSubjectNames = ['MATEMATIKA', 'BAHASA INDONESIA', 'BAHASA INGGRIS', 'FISIKA', 'KIMIA', 'BIOLOGI', 'SEJARAH', 'GEOGRAFI', 'EKONOMI', 'SOSIOLOGI', 'INFORMATIKA', 'PENDIDIKAN AGAMA ISLAM', 'PENDIDIKAN PANCASILA', 'SENI BUDAYA', 'PRAKARYA', 'PENDIDIKAN JASMANI', 'BAHASA JAWA', 'BAHASA ARAB'];
      return smaSubjectNames.includes(s.nama_mapel);
    });

    // Create schedules for SMP classes
    for (const classItem of smpClasses) {
      for (let i = 0; i < 5; i++) {
        await client.query(`
          INSERT INTO schedules (id, school_id, class_id, subject_id, hari, jam_mulai, jam_selesai)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          generateUUID(),
          schools[0].id,
          classItem.id,
          smpSubjects[i % smpSubjects.length].id,
          days[i],
          `${7 + i}:00`,
          `${8 + i}:00`
        ]);
      }
    }

    // Create schedules for SMA classes
    for (const classItem of smaClasses) {
      for (let i = 0; i < 5; i++) {
        await client.query(`
          INSERT INTO schedules (id, school_id, class_id, subject_id, hari, jam_mulai, jam_selesai)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          generateUUID(),
          schools[1].id,
          classItem.id,
          smaSubjects[i % smaSubjects.length].id,
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
        INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at)
        VALUES ($1, $2, 'editor', '', '', true, '1.0', NOW())
      `, [user.nama_lengkap, user.email]);
    }

    // Assign roles to institution 1 (SMP)
    const rolesInst1 = [
      { role: 'kepala_sekolah', userEmail: users[0].email },
      { role: 'wakasek', userEmail: users[1].email },
      { role: 'operator', userEmail: users[2].email },
      { role: 'admin_sekolah', userEmail: users[3].email },
      { role: 'bendahara', userEmail: users[0].email },
      { role: 'guru', userEmail: users[1].email },
    ];

    const memberMap = new Map<string, { memberId: number; roles: string[] }>();
    for (const roleEntry of rolesInst1) {
      const memberResult = await client.query(`
        INSERT INTO payload.institution_members (
          user_id, app_user_id, institution_id, status
        )
        SELECT
          cu.id, u.id, $1, 'active'
        FROM payload.cms_users cu
        JOIN users u ON u.email = cu.email
        WHERE cu.email = $2
        ON CONFLICT (user_id, institution_id) DO UPDATE SET status = EXCLUDED.status
        RETURNING id
      `, [institutions[0].id, roleEntry.userEmail]);

      const memberId = memberResult.rows[0].id;
      const key = `${roleEntry.userEmail}-${institutions[0].id}`;
      if (!memberMap.has(key)) memberMap.set(key, { memberId, roles: [] });
      memberMap.get(key)!.roles.push(roleEntry.role);
    }

    // Assign roles to institution 2 (SMA) - elhanum as guru (wali_kelas is assigned via wali_kelas_assignments table)
    const elhanum = users.find(u => u.id === ELHANUM_USER_ID);
    if (elhanum && institutions[1]) {
      const rolesInst2 = [
        { role: 'guru', userEmail: ELHANUM_EMAIL },
      ];

      for (const roleEntry of rolesInst2) {
        const memberResult = await client.query(`
          INSERT INTO payload.institution_members (
            user_id, app_user_id, institution_id, status
          )
          SELECT
            cu.id, u.id, $1, 'active'
          FROM payload.cms_users cu
          JOIN users u ON u.email = cu.email
          WHERE cu.email = $2
          ON CONFLICT (user_id, institution_id) DO UPDATE SET status = EXCLUDED.status
          RETURNING id
        `, [institutions[1].id, roleEntry.userEmail]);

        const memberId = memberResult.rows[0].id;
        const key = `${roleEntry.userEmail}-${institutions[1].id}`;
        if (!memberMap.has(key)) memberMap.set(key, { memberId, roles: [] });
        memberMap.get(key)!.roles.push(roleEntry.role);
      }
    }

    for (const { memberId, roles: memberRoles } of memberMap.values()) {
      for (let r = 0; r < memberRoles.length; r++) {
        await client.query(`
          INSERT INTO payload.institution_members_role (parent_id, "order", value)
          VALUES ($1, $2, $3)
        `, [memberId, r, memberRoles[r]]);
      }
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
          `TEST_${docType} ${user.nama_lengkap}`,
          JSON.stringify({ dummy: 'content', createdFor: 'testing' })
        ]);
      }
    }

    console.log('   ✅ Created sample documents');

    // 10. TAHUN AJARAN
    console.log('   Creating tahun ajaran...');
    const taNames = ['2024/2025', '2025/2026', '2026/2027'];
    for (const schoolId of schools.map(s => s.id)) {
      for (const taName of taNames) {
        await client.query(`
          INSERT INTO tahun_ajaran (id, nama, tanggal_mulai, tanggal_selesai, is_active, semester_type, semester, sekolah_id, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          generateUUID(),
          taName,
          taName === '2024/2025' ? '2024-07-01' : taName === '2025/2026' ? '2025-07-01' : '2026-07-01',
          taName === '2024/2025' ? '2025-06-30' : taName === '2025/2026' ? '2026-06-30' : '2027-06-30',
          taName === '2025/2026',
          'full',
          'Ganjil',
          schoolId,
          users[0].id
        ]);
      }
    }
    console.log('   ✅ Created tahun ajaran');

    // 11. USER SCHOOL ASSIGNMENTS
    console.log('   Creating user school assignments...');
    for (const user of users) {
      for (const school of schools) {
        // Check if this user is wali_kelas for this school
        const isWaliKelas = (user.id === ELHANUM_USER_ID && school.id === '8606e992-1379-41ef-8834-e834e9312dee') || 
                            (user.role === 'wali_kelas' && school.id === schools[0].id);
        await client.query(`
          INSERT INTO user_school_assignments (id, "userId", "schoolId", tahunajaranid, iswalikelas)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          generateUUID(),
          user.id,
          school.id,
          null,
          isWaliKelas
        ]);
      }
    }
    console.log('   ✅ Created user school assignments');

    // 12. MORE SUBJECTS PER SCHOOL
    console.log('   Creating more subjects...');
    const extraMapel = ['Fisika', 'Kimia', 'Biologi', 'Sejarah', 'Geografi', 'Ekonomi', 'Sosiologi', 'Informatika'];
    for (const school of schools) {
      for (const mapel of extraMapel) {
        await client.query(`
          INSERT INTO subjects (id, school_id, nama_mapel)
          VALUES ($1, $2, $3)
        `, [generateUUID(), school.id, mapel]);
      }
    }
    console.log('   ✅ Created more subjects');

    // 13. MORE CLASSES PER SCHOOL
    console.log('   Creating more classes...');
    const extraClasses: { id: string; nama_kelas: string }[] = [];
    const classPrefixes = ['VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const classSuffixes = ['A', 'B', 'C'];
    for (const school of schools) {
      for (const prefix of classPrefixes) {
        for (const suffix of classSuffixes) {
          const namaKelas = `${prefix}-${suffix}`;
          const result = await client.query(`
            INSERT INTO classes (id, school_id, nama_kelas, wali_kelas)
            VALUES ($1, $2, $3, $4)
            RETURNING id, nama_kelas
          `, [
            generateUUID(),
            school.id,
            namaKelas,
            Math.random() > 0.5 ? pick(users).nama_lengkap : null
          ]);
          extraClasses.push(result.rows[0]);
        }
      }
    }
    console.log(`   ✅ Created ${extraClasses.length} more classes`);

    // 14. MORE STUDENTS PER CLASS
    console.log('   Creating more students...');
    const moreStudents: { id: string }[] = [];
    for (const classItem of extraClasses) {
      const studentCount = 15 + Math.floor(Math.random() * 10);
      for (let i = 0; i < studentCount; i++) {
        const firstName = pick(['Ahmad', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Ika', 'Joko', 'Kiki', 'Lina', 'Mira', 'Nina', 'Oscar', 'Putri', 'Qori', 'Rudi', 'Sari', 'Toni']);
        const lastName = pick(['Suryadi', 'Wibowo', 'Kusuma', 'Hidayat', 'Nugroho', 'Pratama', 'Setiawan', 'Fauzi', 'Ramadhani', 'Putri']);
        const result = await client.query(`
          INSERT INTO students (id, class_id, nama_siswa, nisn, nomor_absen)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          generateUUID(),
          classItem.id,
          `Dummy_${firstName} ${lastName}`,
          `NISN${rand(1000000000, 9999999999)}`,
          i + 1
        ]);
        moreStudents.push(result.rows[0]);
      }
    }
    console.log(`   ✅ Created ${moreStudents.length} more students`);

    // 15. MORE SCHEDULES
    console.log('   Creating more schedules...');
    const allClasses = [...classes, ...extraClasses];
    const allSubjects = subjects;
    const moreScheduleTimes = [
      ['07:00', '07:45'], ['07:45', '08:30'], ['08:30', '09:15'], ['09:15', '10:00'],
      ['10:00', '10:45'], ['10:45', '11:30'], ['13:00', '13:45'], ['13:45', '14:30']
    ];
    for (const classItem of allClasses) {
      const numSchedules = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numSchedules; i++) {
        const day = pick(days);
        const time = pick(moreScheduleTimes);
        const subject = pick(allSubjects);
        await client.query(`
          INSERT INTO schedules (id, school_id, class_id, subject_id, hari, jam_mulai, jam_selesai)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          generateUUID(),
          classItem.school_id || schools[0].id,
          classItem.id,
          subject.id,
          day,
          time[0],
          time[1]
        ]);
      }
    }
    console.log('   ✅ Created more schedules');

    // 16. ASSESSMENTS
    console.log('   Creating assessments...');
    const assessmentTypes = ['Diagnostik', 'Formatif', 'Sumatif'];
    const assessmentNames = ['Ulangan Harian', 'UTS', 'UAS', 'Tugas Mandiri', 'Praktik', 'Observasi', 'Proyek'];
    const assessmentIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const classItem = pick(allClasses);
      const schoolForClass = await client.query(`SELECT school_id FROM classes WHERE id = $1`, [classItem.id]);
      const schoolId = schoolForClass.rows[0]?.school_id || schools[0].id;
      const subjectsForSchool = await client.query(`SELECT id FROM subjects WHERE school_id = $1 ORDER BY random() LIMIT 1`, [schoolId]);
      const subjectId = subjectsForSchool.rows[0]?.id || allSubjects[0].id;
      const result = await client.query(`
        INSERT INTO assessments (id, school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkm)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        generateUUID(),
        schoolId,
        classItem.id,
        subjectId,
        `${pick(assessmentNames)} ${rand(1, 3)}`,
        pick(assessmentTypes),
        rand(60, 80)
      ]);
      assessmentIds.push(result.rows[0].id);
    }
    console.log(`   ✅ Created ${assessmentIds.length} assessments`);

    // 17. STUDENT GRADES
    console.log('   Creating student grades...');
    const allStudents = await client.query(`SELECT id, class_id FROM students`);
    const gradeCount = Math.min(300, assessmentIds.length * Math.max(1, Math.floor(allStudents.rows.length / assessmentIds.length)));
    for (let i = 0; i < gradeCount; i++) {
      const assessmentId = pick(assessmentIds);
      const assessment = await client.query(`SELECT class_id FROM assessments WHERE id = $1`, [assessmentId]);
      const classId = assessment.rows[0]?.class_id;
      if (!classId) continue;
      const classStudents = allStudents.rows.filter(s => s.class_id === classId);
      if (classStudents.length === 0) continue;
      const student = pick(classStudents);
      const nilaiAwal = Math.round((60 + Math.random() * 40) * 100) / 100;
      const isRemedial = nilaiAwal < 70;
      const nilaiRemedial = isRemedial ? Math.round((60 + Math.random() * 40) * 100) / 100 : null;
      const nilaiAkhir = nilaiRemedial !== null ? Math.round(Math.max(nilaiAwal, nilaiRemedial) * 100) / 100 : nilaiAwal;
      await client.query(`
        INSERT INTO student_grades (id, assessment_id, student_id, nilai_awal, nilai_remedial, nilai_akhir, status_remedial)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        generateUUID(),
        assessmentId,
        student.id,
        nilaiAwal,
        nilaiRemedial,
        nilaiAkhir,
        nilaiAkhir >= 70 ? 'Lulus' : 'Butuh Remedial'
      ]);
    }
    console.log(`   ✅ Created student grades`);

    // 18. TEACHER ATTENDANCE
    console.log('   Creating teacher attendance...');
    const attendanceStatuses = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Terlambat'];
    for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      const dateStr = date.toISOString().split('T')[0];
      for (const user of users) {
        const status = pick(attendanceStatuses);
        await client.query(`
          INSERT INTO teacher_attendance (id, user_id, school_id, tanggal, status, latitude, longitude)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          generateUUID(),
          user.id,
          pick(schools).id,
          dateStr,
          status,
          '-6.2088',
          '106.8456'
        ]);
      }
    }
    console.log('   ✅ Created teacher attendance');

    // 19. STUDENT ATTENDANCE
    console.log('   Creating student attendance...');
    const allSchedules = await client.query(`SELECT id, class_id FROM schedules`);
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      const dateStr = date.toISOString().split('T')[0];
      const sampleSchedules = allSchedules.rows.slice(0, 50);
      for (const schedule of sampleSchedules) {
        const studentsInClass = allStudents.rows.filter(s => s.class_id === schedule.class_id).slice(0, 15);
        for (const student of studentsInClass) {
          const status = Math.random() > 0.15 ? 'Hadir' : pick(['Izin', 'Sakit', 'Alpa']);
          await client.query(`
            INSERT INTO student_attendance (id, schedule_id, student_id, tanggal, status)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            generateUUID(),
            schedule.id,
            student.id,
            dateStr,
            status
          ]);
        }
      }
    }
    console.log('   ✅ Created student attendance');

    // 20. TEACHER JOURNALS
    console.log('   Creating teacher journals...');
    const materiList = ['Membaca Permulaan', 'Penjumlahan Pecahan', 'Gaya dan Gerak', 'Photosynthesis', 'Sejarah Kerajaan', 'Algoritma Dasar', 'Cerita Pendek', 'Peta Indonesia', 'Ekosistem', 'Khitabah'];
    const tujuanList = ['Siswa dapat menjelaskan konsep dasar dengan jelas', 'Siswa mampu menyelesaikan soal secara mandiri', 'Siswa mampu menganalisis kasus nyata', 'Siswa dapat menggambarkan proses yang terjadi'];
    const journalStatuses = ['Draft', 'Submitted', 'Reviewed', 'Approved'];
    const journalIds: string[] = [];
    const allScheds = await client.query(`SELECT id, class_id, subject_id, school_id FROM schedules`);
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      const dateStr = date.toISOString().split('T')[0];
      for (const user of users) {
        const sched = pick(allScheds.rows);
        if (!sched) continue;
        const result = await client.query(`
          INSERT INTO teacher_journals (id, user_id, school_id, schedule_id, class_id, subject_id, tanggal, materi_pembelajaran, tujuan_pembelajaran, aktivitas_pembelajaran, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `, [
          generateUUID(),
          user.id,
          sched.school_id,
          sched.id,
          sched.class_id,
          sched.subject_id,
          dateStr,
          pick(materiList),
          pick(tujuanList),
          'Pembelajaran berbasis proyek dan discusi kelompok',
          pick(journalStatuses)
        ]);
        journalIds.push(result.rows[0].id);
      }
    }
    console.log(`   ✅ Created ${journalIds.length} teacher journals`);

    // 21. JOURNAL SUPERVISIONS
    console.log('   Creating journal supervisions...');
    for (const journalId of journalIds) {
      if (Math.random() > 0.5) {
        await client.query(`
          INSERT INTO journal_supervisions (id, journal_id, supervisor_id, catatan_supervisi, rekomendasi, status_persetujuan)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          generateUUID(),
          journalId,
          pick(users).id,
          'Jurnal sudah sesuai standar dan tersusun dengan baik.',
          'Pertahankan consistensi format jurnal',
          pick(['disetujui', 'perlu_revisi', 'draft'])
        ]);
      }
    }
    console.log('   ✅ Created journal supervisions');

    // 22. MORE GURU ADMINISTRASI
    console.log('   Creating more administrasi documents...');
    const docTypes = ['rpp', 'silabus', 'modul_ajar', 'atp', 'prota', 'promes', 'lkpd', 'bahan_ajar'];
    for (const user of users) {
      for (let d = 0; d < 8; d++) {
        await client.query(`
          INSERT INTO guru_administrasi (id, user_id, tipe_dokumen, judul_dokumen, konten, tanggal_kegiatan, owned_by_institution, institution_id, school_id, jenjang, kurikulum, semester, dimensi8, tahunAjaran, subject_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          generateUUID(),
          user.id,
          pick(docTypes),
          `${pick(docTypes).toUpperCase()} - ${pick(materiList)}`,
          JSON.stringify({ bab: d + 1, semester: 'Ganjil', tujuan: 'Mengenal...', alokasi_waktu: '2 JP', sumber: 'Buku digital' }),
          '2025-09-01',
          false,
          null,
          pick(schools).id,
          pick(['SD', 'SMP', 'SMA']),
          pick(['K13', 'Kurikulum Merdeka', 'KBC']),
          1,
          JSON.stringify([{ elemen: 'Berbahasa', indikator: 'Mampu menyusun kalimat efektif' }]),
          '2025/2026',
          pick(allSubjects).id
        ]);
      }
    }
    console.log('   ✅ Created more administrasi documents');

    // 23. ACADEMIC CALENDARS
    console.log('   Creating academic calendars...');
    const events = ['Hari Libur Nasional', 'UTS Semester Ganjil', 'UAS Semester Ganjil', 'Libur Sekolah', 'Pembagian Rapor', 'MPLS', 'UPK', 'KSM', 'Hari Guru', 'Libur Idul Fitri'];
    for (const schoolId of schools.map(s => s.id)) {
      for (let e = 0; e < 10; e++) {
        const mulai = new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
        const selesai = new Date(mulai);
        selesai.setDate(selesai.getDate() + Math.floor(Math.random() * 14) + 1);
        await client.query(`
          INSERT INTO academic_calendars (id, school_id, event_name, tanggal_mulai, tanggal_selesai, keterangan)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          generateUUID(),
          schoolId,
          pick(events),
          mulai,
          selesai,
          'Acara akademik sekolah'
        ]);
      }
    }
    console.log('   ✅ Created academic calendars');

    // 24. JOURNAL SCHEMAS
    console.log('   Creating journal schemas...');
    for (const schoolId of schools.map(s => s.id)) {
      await client.query(`
        INSERT INTO journal_schemas (id, school_id, nama_skema, fields)
        VALUES ($1, $2, $3, $4)
      `, [
        generateUUID(),
        schoolId,
        'Standar Jurnal Mengajar',
        JSON.stringify([
          { name: 'tujuan_pembelajaran', type: 'textarea', required: true },
          { name: 'kegiatan_pembelajaran', type: 'textarea', required: true },
          { name: 'asesmen', type: 'textarea', required: false }
        ])
      ]);
    }
    console.log('   ✅ Created journal schemas');

    // 25. EVIDENCE LOG
    console.log('   Creating evidence log...');
    const evidenceCategories = ['observasi_kelas', 'dokumentasi_pembelajaran', 'produk_siswa', 'refleksi_diri'];
    const evidenceSubCategories = ['Video pembelajaran', 'Portofolio siswa', 'Foto kegiatan', 'Laporan observasi'];
    const taIds = (await client.query(`SELECT id FROM tahun_ajaran WHERE is_active = true LIMIT 1`)).rows.map(r => r.id);
    const activeTaId = taIds[0] || (await client.query(`SELECT id FROM tahun_ajaran LIMIT 1`)).rows[0]?.id;
    for (let i = 0; i < 80; i++) {
      const tgl = new Date();
      tgl.setDate(tgl.getDate() - Math.floor(Math.random() * 90));
      await client.query(`
        INSERT INTO evidence_log (id, guru_id, tahun_ajaran_id, semester, kategori, sub_kategori, judul, deskripsi, indikator_kinerja, bobot_evidence, tanggal_aktivitas, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        generateUUID(),
        pick(users).id,
        activeTaId || generateUUID(),
        'Ganjil',
        pick(evidenceCategories),
        pick(evidenceSubCategories),
        `Bukti ${pick(evidenceCategories)}`,
        'Deskripsi bukti kinerja',
        ['IkK-1', 'IkK-2'],
        Math.floor(Math.random() * 5) + 1,
        tgl,
        JSON.stringify({ jenis: pick(['foto', 'video', 'dokumen']) })
      ]);
    }
    console.log('   ✅ Created evidence log');

    // 26. PELATIHAN GURU
    console.log('   Creating pelatihan guru...');
    const pelatihanNames = ['Workshop Kurikulum Merdeka', 'Pelatihan Teknologi AI dalam Pendidikan', 'Seminar Nasional Pendidikan', 'Workshop Penilaian Formatif', 'Diklat Guru Penggerak'];
    for (const user of users) {
      for (let p = 0; p < 4; p++) {
        const mulai = new Date(2025, Math.floor(Math.random() * 6), Math.floor(Math.random() * 20) + 1);
        const selesai = new Date(mulai);
        selesai.setDate(selesai.getDate() + Math.floor(Math.random() * 14) + 2);
        await client.query(`
          INSERT INTO pelatihan_guru (id, guru_id, tahun_ajaran_id, semester, nama_pelatihan, penyelenggara, jenis, lingkup, tanggal_mulai, tanggal_selesai, durasi_jam, nomor_sertifikat, deskripsi)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          generateUUID(),
          user.id,
          activeTaId || generateUUID(),
          'Ganjil',
          pick(pelatihanNames),
          'Diknas Kota',
          pick(['Workshop', 'Seminar', 'Diklat']),
          'Nasional',
          mulai,
          selesai,
          Math.floor(Math.random() * 40) + 8,
          `SERT-${rand(1000, 9999)}`,
          'Pelatihan yang sangat bermanfaat dan relevan dengan pembelajaran saat ini'
        ]);
      }
    }
    console.log('   ✅ Created pelatihan guru');

    // 27. DOKUMEN BUKTI
    console.log('   Creating dokumen bukti...');
    const dokTypes = ['Sertifikat Pelatihan', 'Piagam Penghargaan', 'Surat Tugas', 'Laporan Kinerja'];
    for (const user of users) {
      for (let d = 0; d < 5; d++) {
        await client.query(`
          INSERT INTO dokumen_bukti (id, guru_id, tahun_ajaran_id, semester, kategori, judul, deskripsi, tanggal_dokumen, penerbit, file_url, file_nama, file_tipe, file_ukuran, indikator_kinerja)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          generateUUID(),
          user.id,
          activeTaId || generateUUID(),
          'Ganjil',
          pick(dokTypes),
          `Dokumen ${pick(dokTypes)}`,
          'Dokumen bukti kinerja guru',
          '2025-09-15',
          'Dinas Pendidikan',
          'https://example.com/doc.pdf',
          `${pick(dokTypes)}.pdf`,
          'application/pdf',
          Math.floor(Math.random() * 500) + 50,
          ['IkK-1']
        ]);
      }
    }
    console.log('   ✅ Created dokumen bukti');

    // 28. LAPORAN KINERJA
    console.log('   Creating laporan kinerja...');
    for (const user of users) {
      await client.query(`
        INSERT INTO laporan_kinerja (id, guru_id, tahun_ajaran_id, semester, judul, content, status, predikat, total_observasi, rata_rata_rating)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        generateUUID(),
        user.id,
        activeTaId || generateUUID(),
        'Ganjil',
        `Laporan Kinerja Semester Ganjil ${new Date().getFullYear()}`,
        JSON.stringify({ ringkasan: 'Kinerja melampaui target', kelebihan: 'Kreatif', kelemahan: 'Perlu ditingkatkan' }),
        'draft',
        'Baik',
        Math.floor(Math.random() * 10),
        Math.round((3 + Math.random() * 2) * 100) / 100
      ]);
    }
    console.log('   ✅ Created laporan kinerja');

    // 29. INDUKATOR KINERJA CONFIG
    console.log('   Creating indikator kinerja config...');
    const komponenList = ['Perencanaan', 'Pelaksanaan', 'Penilaian', 'Refleksi', 'Pengembangan'];
    for (let i = 0; i < 15; i++) {
      await client.query(`
        INSERT INTO indikator_kinerja_config (id, kode, nama, deskripsi, komponen, bobot_persen, min_evidence, sumber_regulasi)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (kode) DO NOTHING
      `, [
        generateUUID(),
        `IK${i + 1}`,
        `Indikator Kinerja ${i + 1}`,
        'Deskripsi indikator kinerja guru',
        pick(komponenList),
        Math.floor(Math.random() * 20) + 5,
        Math.floor(Math.random() * 5) + 1,
        'Permenkopudikbud No. 10 Tahun 2025'
      ]);
    }
    console.log('   ✅ Created indikator kinerja config');

    // 30. SKP TAHUNAN + SKP INDIKATOR
    console.log('   Creating SKP...');
    const indikatorRows = await client.query(`SELECT id FROM indikator_kinerja_config`);
    const indikatorIds = indikatorRows.rows.map(r => r.id);
    const skpIds: string[] = [];
    for (const user of users) {
      const result = await client.query(`
        INSERT INTO skp_tahunan (id, guru_id, tahun_ajaran_id, status, catatan_guru, catatan_kepsek)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        generateUUID(),
        user.id,
        activeTaId || generateUUID(),
        'draft',
        'Saya akan meningkatkan kompetensi...',
        'Pertahankan kinerja yang sudah baik'
      ]);
      const skpId = result.rows[0].id;
      skpIds.push(skpId);
      const usedForSkp = new Set<string>();
      for (let ind = 0; ind < 10; ind++) {
        let indikatorId = pick(indikatorIds);
        while (usedForSkp.has(indikatorId) && usedForSkp.size < indikatorIds.length) {
          indikatorId = pick(indikatorIds);
        }
        usedForSkp.add(indikatorId);
        await client.query(`
          INSERT INTO skp_indikator (id, skp_id, indikator_id, target_self, target_sk)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          generateUUID(),
          skpId,
          indikatorId,
          Math.round((60 + Math.random() * 40) * 100) / 100,
          Math.round((60 + Math.random() * 40) * 100) / 100
        ]);
      }
    }
    console.log(`   ✅ Created SKP`);

    // 31. OBSERVASI KINERJA + OBSERVASI INDIKATOR
    console.log('   Creating observasi kinerja...');
    for (const user of users) {
      const tglObs = new Date();
      tglObs.setDate(tglObs.getDate() - Math.floor(Math.random() * 30));
      const result = await client.query(`
        INSERT INTO observasi_kinerja (id, guru_id, tahun_ajaran_id, tanggal_observasi, jenis, suasana_pembelajaran, catatan_observer, rekomendasi, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        generateUUID(),
        user.id,
        activeTaId || generateUUID(),
        tglObs,
        pick(['kelas', 'laboratorium', 'lapangan']),
        'Aktif dan kondusif',
        'Siswa sangat antusias',
        'Pertahankan metode pembelajaran yang sudah diterapkan',
        'draft'
      ]);
      const obsId = result.rows[0].id;
      const usedForObs = new Set<string>();
      for (let oi = 0; oi < 8; oi++) {
        let indikatorId = pick(indikatorIds);
        while (usedForObs.has(indikatorId) && usedForObs.size < indikatorIds.length) {
          indikatorId = pick(indikatorIds);
        }
        usedForObs.add(indikatorId);
        await client.query(`
          INSERT INTO observasi_indikator (id, observasi_id, indikator_id, rating, catatan, bukti_observasi)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          generateUUID(),
          obsId,
          indikatorId,
          Math.floor(Math.random() * 5) + 1,
          'Performa sangat baik di aspek ini',
          'https://example.com/bukti.jpg'
        ]);
      }
    }
    console.log('   ✅ Created observasi kinerja');

    // 32. TEACHING SESSIONS
    console.log('   Creating teaching sessions...');
    for (const user of users) {
      for (let ts = 0; ts < 25; ts++) {
        const tgl = new Date();
        tgl.setDate(tgl.getDate() - ts);
        await client.query(`
          INSERT INTO teaching_sessions (id, user_id, school_id, session_date, status, attendance_completed, journal_generated, reflection_generated, followup_generated)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          generateUUID(),
          user.id,
          pick(schools).id,
          tgl,
          pick(['pending', 'completed', 'cancelled']),
          Math.random() > 0.3,
          Math.random() > 0.5,
          Math.random() > 0.7,
          Math.random() > 0.8
        ]);
      }
    }
    console.log('   ✅ Created teaching sessions');

    // 33. SCHOOL TEACHING SESSIONS
    console.log('   Creating school teaching sessions...');
    for (const user of users) {
      for (let sts = 0; sts < 20; sts++) {
        const tgl = new Date();
        tgl.setDate(tgl.getDate() - Math.floor(Math.random() * 30));
        const startedAt = new Date(tgl);
        startedAt.setHours(7 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60));
        const endedAt = new Date(startedAt.getTime() + (Math.floor(Math.random() * 3) + 1) * 45 * 60000);
        await client.query(`
          INSERT INTO school_teaching_sessions (id, user_id, school_id, subject_id, class_id, started_at, ended_at, duration_minutes, latitude, longitude, face_match_score, liveness_passed, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          generateUUID(),
          user.id,
          pick(schools).id,
          pick(allSubjects).id,
          pick(allClasses).id,
          startedAt,
          endedAt,
          Math.floor(Math.random() * 120) + 45,
          '-6.2088',
          '106.8456',
          Math.round((0.7 + Math.random() * 0.3) * 1000) / 1000,
          Math.random() > 0.2,
          'active'
        ]);
      }
    }
    console.log('   ✅ Created school teaching sessions');

    // 34. ADMIN TASKS
    console.log('   Creating admin tasks...');
    const taskTypes = ['input_nilai', 'input_absensi', 'upload_dokumen', 'verifikasi_jurnal', 'input_kkm'];
    const taskTitles = ['Input Nilai UTS', 'Input Absensi Hari Ini', 'Upload Silabus', 'Verifikasi Jurnal Minggu Ini', 'Input KKM Semester'];
    const taskStatuses = ['pending', 'in_progress', 'completed'];
    const priorities = ['low', 'normal', 'high'];
    for (const user of users) {
      for (let t = 0; t < 6; t++) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 30));
        await client.query(`
          INSERT INTO admin_tasks (id, user_id, task_type, task_title, status, priority, due_date, description)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          generateUUID(),
          user.id,
          pick(taskTypes),
          pick(taskTitles),
          pick(taskStatuses),
          pick(priorities),
          dueDate.toISOString().split('T')[0],
          'Task untuk testing administrasi guru'
        ]);
      }
    }
    console.log('   ✅ Created admin tasks');

    // 35. PAYOUT REQUESTS + TRANSACTIONS
    console.log('   Creating payout requests and transactions...');
    for (const user of users) {
      if (Math.random() > 0.4) {
        await client.query(`
          INSERT INTO payout_requests (id, user_id, tipe, jumlah, status, catatan, bank_name, bank_account_number, bank_account_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          generateUUID(),
          user.id,
          'cashback',
          Math.floor(Math.random() * 500000) + 50000,
          pick(['PENDING', 'APPROVED', 'REJECTED']),
          'Penarikan cashback bulan ini',
          pick(['BCA', 'Mandiri', 'BNI', 'BRI']),
          `1234${rand(10000, 99999)}`,
          user.nama_lengkap
        ]);
      }
      await client.query(`
        INSERT INTO transactions (id, user_id, external_id, amount, status, payment_method, plan_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        generateUUID(),
        user.id,
        `EXT-${rand(1000, 9999)}`,
        Math.floor(Math.random() * 500000) + 50000,
        pick(['PENDING', 'PAID', 'FAILED']),
        pick(['transfer', 'ewallet', 'credit_card']),
        pick(['free', 'pro', 'enterprise'])
      ]);
    }
    console.log('   ✅ Created payout requests and transactions');

    // 36. QUESTION BANKS
    console.log('   Creating question banks...');
    const kurikulumOpts = ['K13', 'Kurikulum Merdeka', 'KBC'];
    for (const user of users) {
      for (let q = 0; q < 8; q++) {
        await client.query(`
          INSERT INTO question_banks (id, user_id, kurikulum, mata_pelajaran, topik, detail_soal)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          generateUUID(),
          user.id,
          pick(kurikulumOpts),
          pick(allSubjects.map(s => s.nama_mapel)),
          pick(['Bab 1', 'Bab 2', 'Bab 3', 'Bab 4']),
          JSON.stringify({
            soal: 'Contoh soal pilihan ganda...',
            jawaban: 'Jawaban benar',
            opsi: ['A', 'B', 'C', 'D'],
            tingkat_kognitif: pick(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
          })
        ]);
      }
    }
    console.log('   ✅ Created question banks');

    // 37. DUTY ASSIGNMENTS
    console.log('   Creating duty assignments...');
    const dutyPurposes = ['Mengajar', 'Workshop', 'Rapat', 'Pelatihan', 'Observasi'];
    for (const user of users) {
      for (let d = 0; d < 5; d++) {
        const dutyDate = new Date();
        dutyDate.setDate(dutyDate.getDate() - Math.floor(Math.random() * 30));
        await client.query(`
          INSERT INTO duty_assignments (id, teacher_id, school_id, institution_id, date, purpose, location_latitude, location_longitude, radius_meters, status, approved_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          generateUUID(),
          user.id,
          pick(schools).id,
          null,
          dutyDate,
          pick(dutyPurposes),
          '-6.2088',
          '106.8456',
          Math.floor(Math.random() * 100) + 50,
          pick(['pending', 'approved', 'rejected']),
          Math.random() > 0.5 ? pick(users).id : null
        ]);
      }
    }
    console.log('   ✅ Created duty assignments');

    // 38. AI CHAT LOGS
    console.log('   Creating ai chat logs...');
    const actionTypes = ['chat', 'generate_soal', 'generate_rpp', 'generate_silabus'];
    for (let i = 0; i < 50; i++) {
      await client.query(`
        INSERT INTO ai_chat_logs (id, user_id, session_id, role, content, action_type, action_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        generateUUID(),
        pick(users).id,
        `sess_${rand(1000, 9999)}`,
        pick(['user', 'assistant']),
        pick(['Halo, bantu saya buat soal...', 'Baik, berikut soal yang saya buat...', 'Mari kita diskusikan...']),
        pick(actionTypes),
        JSON.stringify({ model: pick(['mock', 'gemini-2.5-flash']) })
      ]);
    }
    console.log('   ✅ Created ai chat logs');

    // 39. LESSON MEMORIES
    console.log('   Creating lesson memories...');
    const allScheduleIds = (await client.query(`SELECT id FROM schedules`)).rows.map(r => r.id);
    for (const user of users) {
      if (allScheduleIds.length > 0) {
        await client.query(`
          INSERT INTO lesson_memories (id, user_id, schedule_id, last_topic, last_subtopic, last_page_number, last_date, next_recommendations, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          generateUUID(),
          user.id,
          pick(allScheduleIds),
          pick(materiList),
          'Halaman ' + (Math.floor(Math.random() * 200) + 1),
          Math.floor(Math.random() * 200) + 1,
          '2025-09-15',
          'Lanjutkan ke topik selanjutnya',
          'Siswa perlu bimbingan lebih lanjut'
        ]);
      }
    }
    console.log('   ✅ Created lesson memories');

    // 40. WALI KELAS ASSIGNMENTS
    console.log('   Creating wali kelas assignments...');
    for (const classItem of allClasses) {
      // For elhanum's class X.1, use elhanum as the wali kelas
      // wali_kelas_member_id is UUID, generate a consistent one for elhanum
      let waliKelasMemberId = generateUUID();
      let ditugaskanOleh = users[0].id;
      
      if (classItem.nama_kelas === 'X.1') {
        // Use a consistent UUID for elhanum as wali kelas member
        waliKelasMemberId = '50e096cc-9dc2-4403-b731-5506088ddc32'; // Same as user ID
        ditugaskanOleh = ELHANUM_USER_ID;
      }
      
      await client.query(`
        INSERT INTO wali_kelas_assignments (id, kelas_id, wali_kelas_member_id, tahun_ajaran, semester, status, ditugaskan_pada, ditugaskan_oleh)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        generateUUID(),
        classItem.id,
        waliKelasMemberId,
        '2025/2026',
        'ganjil',
        'aktif',
        new Date(),
        ditugaskanOleh
      ]);
    }
    console.log(`   ✅ Created wali kelas assignments`);

    // 41. RAPORT CACHE
    console.log('   Creating raport cache...');
    for (let i = 0; i < 50; i++) {
      const student = pick(allStudents.rows);
      await client.query(`
        INSERT INTO raport_cache (id, student_id, subject_id, assessment_id, nilai, ai_description, generated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        generateUUID(),
        student.id,
        pick(allSubjects).id,
        pick(assessmentIds) || generateUUID(),
        Math.round((60 + Math.random() * 40) * 100) / 100,
        'Deskripsi nilai yang dihasilkan oleh AI',
        new Date()
      ]);
    }

    // Raport cache deterministik untuk siswa X.1 (elhanum)
    const x1StudentsForRaport = (await client.query(
      `SELECT id FROM students WHERE class_id = $1 LIMIT 3`,
      [ELHANUM_CLASS_ID]
    )).rows;
    for (const student of x1StudentsForRaport) {
      const subj = (await client.query(
        `SELECT id FROM subjects WHERE school_id = $1 LIMIT 1`,
        [ELHANUM_SCHOOL_ID]
      )).rows[0];
      await client.query(`
        INSERT INTO raport_cache (id, student_id, subject_id, assessment_id, nilai, ai_description, generated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        generateUUID(),
        student.id,
        subj?.id || generateUUID(),
        pick(assessmentIds) || generateUUID(),
        Math.round((60 + Math.random() * 40) * 100) / 100,
        'Deskripsi nilai yang dihasilkan oleh AI',
        new Date()
      ]);
    }
    console.log('   ✅ Created raport cache');

    // 42. ABSENT ALERTS
    console.log('   Creating absent alerts...');
    for (const student of allStudents.rows.slice(0, 30)) {
      await client.query(`
        INSERT INTO absent_alerts (id, student_id, user_id, absence_count, last_absent_date, alert_sent, whatsapp_message, sent_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        generateUUID(),
        student.id,
        pick(users).id,
        Math.floor(Math.random() * 10) + 1,
        new Date(),
        Math.random() > 0.5,
        'Anak Anda masih perlu diperhatikan kehadirannya',
        new Date()
      ]);
    }
    console.log('   ✅ Created absent alerts');

    // 43. REFERRALS
    console.log('   Creating referrals...');
    for (let r = 0; r < users.length - 1; r++) {
      await client.query(`
        INSERT INTO referrals (id, referrer_id, referee_id, reward_tokens, cashback_amount)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        generateUUID(),
        users[r].id,
        users[r + 1].id,
        Math.floor(Math.random() * 50),
        Math.floor(Math.random() * 100000)
      ]);
    }
    console.log(`   ✅ Created referrals`);

    // 44. PAYLOAD LANDING / FEATURES / WHY POINTS / CATEGORIES / POSTS / PRICING PLANS
    console.log('   Seeding payload CMS...');
    for (const schoolId of schools.map(s => s.id)) {
      await client.query(`
        INSERT INTO payload.pricing_plans ("packageName", slug, price, "durationDays", tokens, features, "isActive", "isPopular", description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        `TEST_${pick(['Basic', 'Pro'])}`,
        `test-${pick(['basic', 'pro'])}-${Date.now()}`,
        Math.floor(Math.random() * 500000) + 100000,
        30,
        Math.floor(Math.random() * 1000) + 100,
        JSON.stringify(['Fitur 1', 'Fitur 2']),
        true,
        Math.random() > 0.5,
        'Testing plan'
      ]);
    }

    const landingId = await client.query(`INSERT INTO payload.landing_page DEFAULT VALUES RETURNING id`);
    if (landingId.rows[0]?.id) {
      await client.query(`
        INSERT INTO payload.landing_page_hero_stats (id, _parent_id, "_order", number, label)
        VALUES ($1, $2, $3, $4, $5)
      `, [generateUUID(), landingId.rows[0].id, 1, '1000+', 'Guru Aktif']);
    }

    for (let f = 0; f < 5; f++) {
      await client.query(`
        INSERT INTO payload.cms_features (title, description, icon, "order", is_active)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        `TEST_Fitur ${f + 1}`,
        'Deskripsi fitur testing',
        'IconSparkles',
        f + 1,
        true
      ]);
    }

    for (let w = 0; w < 3; w++) {
      await client.query(`
        INSERT INTO payload.why_points (point, "order", is_active)
        VALUES ($1, $2, $3)
      `, [`TEST_Poin ${w + 1}`, w + 1, true]);
    }

    const catId = await client.query(`INSERT INTO payload.categories (title, slug) VALUES ($1, $2) RETURNING id`, ['TEST_Category', 'test-category']);
    if (catId.rows[0]?.id) {
      await client.query(`
        INSERT INTO payload.posts (title, slug, author, excerpt, content, status, _status, category_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, ['TEST_Post', 'test-post', 'Testing', 'Excerpt testing', JSON.stringify({ body: 'Content testing' }), 'published', 'published', catId.rows[0].id]);
    }
    console.log('   ✅ Created payload CMS');

    // 44b. DASHBOARD DATA
    console.log('   Creating dashboard data...');

    const assignmentIds: string[] = [];
    for (const inst of institutions) {
      for (const user of users) {
        const cmsUser = await client.query(`SELECT id FROM payload.cms_users WHERE email = $1`, [user.email]);
        if (cmsUser.rows.length === 0) continue;
        const cmsUserId = cmsUser.rows[0].id;
        const result = await client.query(`
          INSERT INTO payload.teacher_institution_assignments (teacher_id_id, institution_id_id, subject_ids, weekly_schedule, status, start_date, end_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          cmsUserId,
          inst.id,
          JSON.stringify([1, 2, 3]),
          JSON.stringify({
            monday: [{ start: '07:00', end: '09:00', subjectId: 1 }],
            tuesday: [{ start: '07:00', end: '09:00', subjectId: 2 }],
            wednesday: [{ start: '07:00', end: '09:00', subjectId: 3 }],
            thursday: [{ start: '07:00', end: '09:00', subjectId: 1 }],
            friday: [{ start: '07:00', end: '09:00', subjectId: 2 }],
            saturday: [],
            sunday: []
          }),
          'aktif',
          new Date('2025-07-01'),
          new Date('2026-06-30')
        ]);
        assignmentIds.push(result.rows[0].id);
      }
    }
    console.log(`   ✅ Created ${assignmentIds.length} teacher institution assignments`);

    for (const user of users) {
      const cmsUser = await client.query(`SELECT id FROM payload.cms_users WHERE email = $1`, [user.email]);
      if (cmsUser.rows.length === 0) continue;
      const cmsUserId = cmsUser.rows[0].id;

      const assignments = await client.query(`SELECT id, institution_id_id FROM payload.teacher_institution_assignments WHERE teacher_id_id = $1`, [cmsUserId]);
      for (const assignment of assignments.rows) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        await client.query(`
          INSERT INTO attendance_logs (teacher_id, institution_id, assignment_id, type, timestamp, status, latitude, longitude, face_match_score, liveness_passed, trust_score)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          user.id,
          assignment.institution_id_id,
          assignment.id,
          'masuk',
          new Date(todayStr + 'T07:15:00'),
          'hadir',
          '-6.2088',
          '106.8456',
          0.95,
          true,
          0.9
        ]);

        await client.query(`
          INSERT INTO attendance_logs (teacher_id, institution_id, assignment_id, type, timestamp, status, latitude, longitude, face_match_score, liveness_passed, trust_score)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          user.id,
          assignment.institution_id_id,
          assignment.id,
          'pulang',
          new Date(todayStr + 'T15:30:00'),
          'hadir',
          '-6.2088',
          '106.8456',
          0.92,
          true,
          0.88
        ]);
      }
    }
    console.log('   ✅ Created attendance logs');

    for (const inst of institutions) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      const hari = d.getDay();
      const selisih = hari === 0 ? -6 : 1 - hari;
      d.setDate(d.getDate() + selisih);
      const weekStart = d.toISOString().split('T')[0];

      await client.query(`
        INSERT INTO executive_dashboard_cache (institution_id, week_start, payload)
        VALUES ($1, $2, $3)
        ON CONFLICT (institution_id, week_start)
        DO UPDATE SET payload = $3, cached_at = CURRENT_TIMESTAMP
      `, [
        inst.id,
        weekStart,
        JSON.stringify({
          attendance: { hadir: 85, izin: 10, sakit: 5 },
          jurnal: { submitted: 120, approved: 100, pending: 20 },
          administrasi: { completed: 40, pending: 5 },
          summary: 'Dashboard eksekutif minggu ini'
        })
      ]);
    }
    console.log('   ✅ Created executive dashboard cache');

    // 45. GEMINI CACHE + TOKEN USAGE
    console.log('   Creating gemini cache and token usage...');
    for (const user of users) {
      await client.query(`
        INSERT INTO "GeminiCache" (id, cache_name, cache_type, model_name, token_count, expire_time, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (cache_name)
        DO UPDATE SET cache_type = $3, model_name = $4, token_count = $5,
                      expire_time = $6, is_active = $7, updated_at = NOW()
      `, [
        generateUUID(),
        `test_cache_${user.id}`,
        'chat',
        'gemini-2.5-flash',
        Math.floor(Math.random() * 1000),
        new Date(Date.now() + 86400000),
        true,
        new Date(),
        new Date()
      ]);
      await client.query(`
        INSERT INTO "TokenUsage" (id, user_id, request_id, feature, model, provider, input_tokens, output_tokens, cached_tokens, image_tokens, total_cost_idr, tokens_charged, success, mapel, jenjang, jumlah_soal)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        generateUUID(),
        user.id,
        `req_${rand(1000, 9999)}`,
        'chat',
        'gemini-2.5-flash',
        'google',
        Math.floor(Math.random() * 1000),
        Math.floor(Math.random() * 500),
        Math.floor(Math.random() * 200),
        Math.floor(Math.random() * 5),
        Math.round(Math.random() * 5000 * 100) / 100,
        Math.floor(Math.random() * 500),
        Math.random() > 0.1,
        'Matematika',
        'SMP',
        Math.floor(Math.random() * 20)
      ]);
    }
    console.log('   ✅ Created gemini cache and token usage');

    // 46. RAPORT TABLES
    console.log('   Creating raport data...');
    const templateRaportIds: string[] = [];
    for (const schoolId of schools.map(s => s.id)) {
      const result = await client.query(`
        INSERT INTO template_raport (sekolah_id, nama_template, jalur_regulasi, jenjang, kurikulum, jenis_laporan, mode_nilai_akademik, varian_sikap, basis_deskripsi, sections, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        schoolId,
        'Template Default',
        'kemendikdasmen',
        'smp_mts',
        'kurikulum_merdeka',
        'akhir_semester',
        'angka_kkm',
        'profil_pelajar_pancasila',
        'capaian_pembelajaran',
        JSON.stringify([{ sectionType: 'header', order: 1, wajib: true }]),
        true
      ]);
      templateRaportIds.push(result.rows[0].id);
    }

    const dataRaportIds: string[] = [];
    for (const student of allStudents.rows.slice(0, 50)) {
      const result = await client.query(`
        INSERT INTO data_raport (siswa_id, nisn, nis_lokal, kelas_id, template_raport_id, periode, jenis_laporan, status, sikap_id, catatan_wali_kelas, presensi_snapshot)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        student.id,
        (student.nisn && student.nisn.length <= 10 ? student.nisn : `NISN${rand(100000, 999999)}`),
        `NL${rand(1000, 9999)}`,
        student.class_id,
        pick(templateRaportIds),
        '2025/2026-Ganjil',
        'akhir_semester',
        'draft',
        generateUUID(),
        'Siswa perlu meningkatkan prestasi',
        JSON.stringify({ sakit: 2, izin: 1, alpa: 0 })
      ]);
      dataRaportIds.push(result.rows[0].id);
    }

    for (const drId of dataRaportIds) {
      await client.query(`
        INSERT INTO data_raport_nilai_mapel (data_raport_id, mapel_id, guru_mapel_member_id, nilai_akhir, kkm, deskripsi_capaian)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        drId,
        pick(allSubjects).id,
        generateUUID(),
        Math.round((60 + Math.random() * 40) * 10) / 10,
        70,
        'Capaian pembelajaran sesuai standar'
      ]);
      await client.query(`
        INSERT INTO data_raport_status_history (data_raport_id, status, changed_by, changed_by_role)
        VALUES ($1, $2, $3, $4)
      `, [
        drId,
        'draft',
        users[0].id,
        'guru_mapel'
      ]);
    }
    console.log('   ✅ Created raport data');

    // 47. SIKAP, EKSKUL, CATATAN WALI KELAS
    console.log('   Creating sikap, ekskul, catatan wali kelas...');
    for (const student of allStudents.rows.slice(0, 40)) {
      await client.query(`
        INSERT INTO penilaian_sikap (siswa_id, kelas_id, periode, varian, penilaian_per_dimensi, deskripsi_umum, dinilai_oleh)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        student.id,
        student.class_id,
        '2025/2026-Ganjil',
        'profil_pelajar_pancasila',
        JSON.stringify([{ dimensi: 'iman', predikat: 'Baik' }, { dimensi: 'sikap_kerjasama', predikat: 'Sangat Baik' }]),
        'Siswa menunjukkan perilaku yang baik sesuai nilai Profil Pelajar Pancasila',
        generateUUID()
      ]);

      await client.query(`
        INSERT INTO catatan_wali_kelas (id, siswa_id, kelas_id, periode, catatan, ditulis_oleh)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        generateUUID(),
        student.id,
        student.class_id,
        '2025/2026-Ganjil',
        'Perlu ditingkatkan partisipasi aktif di kelas.',
        ELHANUM_USER_ID
      ]);
    }

    // Catatan wali kelas khusus untuk siswa X.1 (ditulis oleh elhanum)
    const elhanumX1Students = (await client.query(
      `SELECT id, class_id FROM students WHERE class_id = $1`,
      [ELHANUM_CLASS_ID]
    )).rows;
    for (const student of elhanumX1Students) {
      await client.query(`
        INSERT INTO catatan_wali_kelas (id, siswa_id, kelas_id, periode, catatan, ditulis_oleh)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        generateUUID(),
        student.id,
        student.class_id,
        '2025/2026-Ganjil',
        'Siswa menunjukkan perkembangan positif, perlu pendampingan pada mata pelajaran eksak.',
        ELHANUM_USER_ID
      ]);
    }

    for (const classItem of allClasses.slice(0, 10)) {
      await client.query(`
        INSERT INTO ekstrakurikuler (nama_ekskul, kelas_id, pembina_member_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [
        pick(['Pramuka', 'PMR', 'Paskibra', 'Futsal', 'Paduan Suara']),
        classItem.id,
        generateUUID()
      ]);
    }
    console.log('   ✅ Created sikap, ekskul, catatan wali kelas');

    await client.query('COMMIT');

    console.log('✅ Test data seeding complete!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Institutions: ${institutions.length}`);
    console.log(`   - Schools: ${schools.length}`);
    console.log(`   - Classes: ${classes.length + extraClasses.length}`);
    console.log(`   - Students: ${students.length + moreStudents.length}`);
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
