/**
 * Setup DEMO institution, schools, and link DEMO users
 * Usage: node scripts/setup-demo-institution.ts
 */
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const client = new Client({ connectionString: DATABASE_URL });

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function main() {
  await client.connect();
  console.log('Connected.');

  // 1. Get DEMO user IDs
  const demoUsers = await client.query(`
    SELECT id, email, nama_lengkap, role FROM users
    WHERE email LIKE 'DEMO_%@test.gurupro.id'
    ORDER BY email
  `);
  console.log('DEMO users found: ' + demoUsers.rows.length);

  const getId = (email) => demoUsers.rows.find(r => r.email === email)?.id;

  // 2. Create DEMO institution
  const instResult = await client.query(`
    INSERT INTO payload.institutions (name, npsn, jenjang, naungan, subscription_tier, academic_year_active, approval_layer_config, status)
    VALUES ('DEMO_MTs Nurul Hikmah', 'DEMO99999', 'MTs', 'Kemenag', 'premium', '2025/2026', 'single', 'active')
    ON CONFLICT DO NOTHING
    RETURNING id, name
  `);

  if (instResult.rows.length === 0) {
    const existing = await client.query(`SELECT id, name FROM payload.institutions WHERE name LIKE 'DEMO_%' LIMIT 1`);
    console.log('DEMO institution already exists: ' + JSON.stringify(existing.rows[0]));
  } else {
    console.log('Created institution: ' + JSON.stringify(instResult.rows[0]));
  }

  const instId = instResult.rows[0]?.id || (await client.query(`SELECT id FROM payload.institutions WHERE name LIKE 'DEMO_%' LIMIT 1`)).rows[0]?.id;
  console.log('Institution ID: ' + instId);

  // 3. Get/create CMS users for DEMO users
  for (const user of demoUsers.rows) {
    const existing = await client.query(`SELECT id FROM payload.cms_users WHERE email = $1`, [user.email]);
    if (existing.rows.length === 0) {
      await client.query(`
        INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at, created_at, updated_at)
        VALUES ($1, $2, 'editor', '', '', true, '1.0', NOW(), NOW(), NOW())
      `, [user.nama_lengkap, user.email]);
      console.log('Created CMS user: ' + user.email);
    }
  }

  // 4. Create school for DEMO institution
  let schoolId;
  const kepalaId = getId('DEMO_kepala-sekolah@test.gurupro.id');
  const existingSchool = await client.query(`SELECT id FROM schools WHERE npsn = 'DEMO99999' LIMIT 1`);
  if (existingSchool.rows.length > 0) {
    schoolId = existingSchool.rows[0].id;
    console.log('School already exists: ' + schoolId);
  } else {
    const schoolResult = await client.query(`
      INSERT INTO schools (id, user_id, nama_sekolah, npsn, alamat, nama_kepala_sekolah, nip_kepala_sekolah)
      VALUES ($1, $2, 'DEMO_MTs Nurul Hikmah Jakarta', 'DEMO99999', 'Jl. Pendidikan Raya No. 10, Jakarta Selatan', 'Dr. Hasan Basri, M.Si.', '197001011995031000')
      RETURNING id
    `, [uuid(), kepalaId]);
    schoolId = schoolResult.rows[0].id;
  }
  console.log('School ID: ' + schoolId);

  // 5. Assign DEMO users to school
  for (const user of demoUsers.rows) {
    try {
      await client.query(`
        INSERT INTO user_school_assignments (id, "userId", "schoolId", iswalikelas)
        VALUES ($1, $2, $3, FALSE)
      `, [uuid(), user.id, schoolId]);
    } catch (e) {
      // ignore duplicate
    }
  }
  console.log('Assigned users to school');

  // 6. Create tahun ajaran
  const taResult = await client.query(`
    INSERT INTO tahun_ajaran (id, nama, tanggal_mulai, tanggal_selesai, is_active, semester_type, semester, sekolah_id, created_by)
    VALUES ($1, '2025/2026', '2025-07-01', '2026-06-30', TRUE, 'full', 'Ganjil', $2, $3)
    RETURNING id
  `, [uuid(), schoolId, kepalaId]);
  let taId = taResult.rows[0]?.id;
  if (!taId) {
    taId = (await client.query(`SELECT id FROM tahun_ajaran WHERE sekolah_id = $1 AND is_active = TRUE LIMIT 1`, [schoolId])).rows[0]?.id;
  }
  console.log('Tahun ajaran ID: ' + taId);

  // 7. Create subjects
  const mtsMapel = ['MATEMATIKA', 'BAHASA INDONESIA', 'BAHASA INGGRIS', 'BAHASA ARAB', 'FIKIH', 'AQIDAH AKHLAK', 'AL-QURAN HADITS', 'IPA', 'IPS', 'PKN', 'SENI BUDAYA', 'PJOK', 'PRAKARYA'];
  const subjectIds = [];
  for (const mapel of mtsMapel) {
    const r = await client.query(`
      INSERT INTO subjects (id, school_id, nama_mapel)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [uuid(), schoolId, mapel]);
    if (r.rows[0]) subjectIds.push(r.rows[0].id);
  }
  console.log('Created ' + subjectIds.length + ' subjects');

  // 8. Create classes (VII, VIII, IX - MTs)
  const classIds = {};
  const kelasList = [
    { nama: 'VII-A', level: 'VII' }, { nama: 'VII-B', level: 'VII' },
    { nama: 'VIII-A', level: 'VIII' }, { nama: 'VIII-B', level: 'VIII' },
    { nama: 'IX-A', level: 'IX' }, { nama: 'IX-B', level: 'IX' }
  ];
  const waliKelasId = getId('DEMO_wali-kelas@test.gurupro.id');
  for (let i = 0; i < kelasList.length; i++) {
    const k = kelasList[i];
    const r = await client.query(`
      INSERT INTO classes (id, school_id, nama_kelas, wali_kelas, wali_kelas_user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [uuid(), schoolId, k.nama, k.nama === 'VII-A' ? 'Elisabeth Nur Hidayah, M.Pd.' : null, k.nama === 'VII-A' ? waliKelasId : null]);
    classIds[k.nama] = r.rows[0].id;
  }
  console.log('Created ' + Object.keys(classIds).length + ' classes: ' + Object.keys(classIds).join(', '));

  // 9. Create students (15-20 per class)
  const firstNames = ['Ahmad', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Ika', 'Joko', 'Kiki', 'Lina', 'Mira', 'Nina', 'Oscar', 'Putri', 'Qori', 'Rudi', 'Sari', 'Toni'];
  const lastNames = ['Suryadi', 'Wibowo', 'Kusuma', 'Hidayat', 'Nugroho', 'Pratama', 'Setiawan', 'Fauzi', 'Ramadhani', 'Putri'];
  let totalStudents = 0;
  for (const [kelasNama, kelasId] of Object.entries(classIds)) {
    const count = 15 + Math.floor(Math.random() * 6); // 15-20
    for (let i = 0; i < count; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      await client.query(`
        INSERT INTO students (id, class_id, nama_siswa, nisn, nomor_absen)
        VALUES ($1, $2, $3, $4, $5)
      `, [uuid(), kelasId, 'DEMO_' + fn + ' ' + ln, 'DEMO' + Math.floor(Math.random() * 900000000 + 100000000), i + 1]);
    }
    totalStudents += count;
  }
  console.log('Created ' + totalStudents + ' students');

  // 10. Create schedules
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  const times = [['07:00', '07:45'], ['07:45', '08:30'], ['08:30', '09:15'], ['09:15', '10:00'], ['10:15', '11:00']];
  for (const [kelasNama, kelasId] of Object.entries(classIds)) {
    for (let d = 0; d < 5; d++) {
      for (let t = 0; t < 3; t++) {
        const subIdx = (d + t) % subjectIds.length;
        await client.query(`
          INSERT INTO schedules (id, school_id, class_id, subject_id, hari, jam_mulai, jam_selesai)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [uuid(), schoolId, kelasId, subjectIds[subIdx], days[d], times[t][0], times[t][1]]);
      }
    }
  }
  console.log('Created schedules for all classes');

  // 11. Assign institution roles to DEMO users
  const roleMap = {
    'DEMO_kepala-sekolah@test.gurupro.id': ['kepala_sekolah'],
    'DEMO_wakasek@test.gurupro.id': ['wakasek'],
    'DEMO_operator@test.gurupro.id': ['operator'],
    'DEMO_bendahara@test.gurupro.id': ['bendahara', 'admin_sekolah'],
    'DEMO_guru-instansi@test.gurupro.id': ['guru'],
    'DEMO_wali-kelas@test.gurupro.id': ['guru'],
    'DEMO_pembina-ekskul@test.gurupro.id': ['guru'],
    'DEMO_guru-mandiri@test.gurupro.id': ['guru'],
  };

  for (const [email, roles] of Object.entries(roleMap)) {
    const appUserId = getId(email);
    if (!appUserId) continue;
    const cmsUser = await client.query(`SELECT id FROM payload.cms_users WHERE email = $1`, [email]);
    if (cmsUser.rows.length === 0) continue;
    const cmsUserId = cmsUser.rows[0].id;

    // Check if already member
    const existing = await client.query(`
      SELECT id FROM payload.institution_members
      WHERE app_user_id = $1 AND institution_id = $2
    `, [appUserId, instId]);

    let memberId;
    if (existing.rows.length > 0) {
      memberId = existing.rows[0].id;
      await client.query(`DELETE FROM payload.institution_members_role WHERE parent_id = $1`, [memberId]);
    } else {
      const m = await client.query(`
        INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
        VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW())
        RETURNING id
      `, [cmsUserId, appUserId, instId]);
      memberId = m.rows[0].id;
    }

    // Assign roles
    for (let i = 0; i < roles.length; i++) {
      await client.query(`
        INSERT INTO payload.institution_members_role (parent_id, "order", value)
        VALUES ($1, $2, $3)
      `, [memberId, i, roles[i]]);
    }
    console.log('Assigned roles ' + JSON.stringify(roles) + ' to ' + email);
  }

  // 12. Create Wali Kelas assignment
  const viiAClassId = classIds['VII-A'];
  if (waliKelasId && viiAClassId) {
    await client.query(`
      INSERT INTO wali_kelas_assignments (id, kelas_id, wali_kelas_member_id, tahun_ajaran, semester, status, ditugaskan_pada, ditugaskan_oleh)
      VALUES ($1, $2, $3, '2025/2026', 'ganjil', 'aktif', NOW(), $3)
    `, [uuid(), viiAClassId, waliKelasId]);
    console.log('Created wali kelas assignment for VII-A');
  }

  // 13. Create ekstrakurikuler
  const ekskulList = ['Pramuka', 'PMR', 'Paskibra', 'Futsal', 'Paduan Suara', 'KIR'];
  const pembinaId = getId('DEMO_pembina-ekskul@test.gurupro.id');
  for (const ekskul of ekskulList) {
    await client.query(`
      INSERT INTO ekstrakurikuler (nama_ekskul, kelas_id, pembina_member_id, pembina_user_id, owner_id)
      VALUES ($1, $2, $3, $3, $3)
    `, [ekskul, Object.values(classIds)[Math.floor(Math.random() * Object.values(classIds).length)], pembinaId]);
  }
  console.log('Created ' + ekskulList.length + ' ekstrakurikuler');

  // 14. Create sample assessments + grades
  const kelasIds = Object.values(classIds);
  for (const classId of kelasIds) {
    const siswa = await client.query(`SELECT id FROM students WHERE class_id = $1 LIMIT 3`, [classId]);
    const subjId = subjectIds[Math.floor(Math.random() * subjectIds.length)];
    const assessmentId = uuid();
    await client.query(`
      INSERT INTO assessments (id, school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkm)
      VALUES ($1, $2, $3, $4, 'Ulangan Harian 1', 'Sumatif', 70)
    `, [assessmentId, schoolId, classId, subjId]);

    for (const s of siswa.rows) {
      const nilai = 60 + Math.round(Math.random() * 40);
      await client.query(`
        INSERT INTO student_grades (id, assessment_id, student_id, nilai_awal, nilai_akhir, status_remedial)
        VALUES ($1, $2, $3, $4, $4, $5)
      `, [uuid(), assessmentId, s.id, nilai, nilai >= 70 ? 'Lulus' : 'Remedial']);
    }
  }
  console.log('Created assessments and grades');

  await client.end();
  console.log('\n=== DONE ===');
  console.log('Institution: DEMO_MTs Nurul Hikmah (ID: ' + instId + ')');
  console.log('School: DEMO_MTs Nurul Hikmah Jakarta (ID: ' + schoolId + ')');
  console.log('Classes: ' + Object.keys(classIds).join(', '));
  console.log('Total students: ' + totalStudents);
  console.log('\nLogin credentials (password: test123):');
  for (const u of demoUsers.rows) {
    console.log('  ' + u.email + ' (' + u.role + ')');
  }
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
