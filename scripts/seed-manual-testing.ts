/**
 * Seed Data: GuruPRO Manual Testing
 *
 * PURPOSE: Fiktif seed data untuk testing manual di staging/dev
 * ENVIRONMENT: Local/Staging only — JANGAN jalankan di production
 * TAHUN AJARAN: 2026/2027, Semester 1 (Juli–Desember 2026)
 *
 * Usage:
 *   npx tsx scripts/seed-manual-testing.ts [--cleanup]
 *
 * Domain email fiktif: @sekolahmandiri.sch.id, @mtsnusantara.sch.id, dll
 * Semua data ditandai is_seed_data=true, seed_batch='manual-testing-20260806'
 */

import { Pool } from 'pg';
import { hash } from 'bcrypt';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const pool = new Pool({ connectionString: DATABASE_URL });
const BATCH = 'manual-testing-20260806';
const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'Password123!';

const SEKOLAH_MANDIRI: Array<{nama: string; npsn: string; jenjang: string; kurikulum: string; domain: string}> = [
  { nama: 'SMP Islam Cendekia Mandiri', npsn: '20261901', jenjang: 'SMP', kurikulum: 'kurikulum_merdeka', domain: 'sekolahmandiri.sch.id' },
  { nama: 'SMA Nurul Ilmi Boarding', npsn: '20261902', jenjang: 'SMA', kurikulum: 'kurikulum_merdeka', domain: 'sekolahmandiri.sch.id' },
  { nama: 'MTs Al-Hidayah Surabaya', npsn: '20261903', jenjang: 'MTs', kurikulum: 'kurikulum_merdeka', domain: 'mtsnurulimmi.sch.id' },
  { nama: 'SMA Plus Madani Jakarta', npsn: '20261904', jenjang: 'SMA', kurikulum: 'k13', domain: 'smaplusmadani.sch.id' },
  { nama: 'SMP Tunas Bangsa Medan', npsn: '20261905', jenjang: 'SMP', kurikulum: 'kurikulum_merdeka', domain: 'tunasbangsa.sch.id' },
];

const INSTITUSI: Array<{
  nama: string; npsn: string; jenjang: string; naungan: string; domain: string;
  alamat: string; kepala: { nama: string; nip: string };
  wakasek: Array<{ nama: string; nip: string; bidang: string }>;
  operator: { nama: string; nip: string };
  bendahara: { nama: string; nip: string };
  jenjang_code: string; jumlah_rombel: number;
}> = [
  {
    nama: 'MTs Islamiyah Bilingual Boarding',
    npsn: '20261001',
    jenjang: 'MTs',
    naungan: 'Kemenag',
    domain: 'mtsbilingual.sch.id',
    alamat: 'Jl. Pendidikan Raya No. 15, Kota Baru, Jawa Timur',
    kepala: { nama: 'Dr. H. Abdul Malik, M.Pd.I', nip: '197501151995031001' },
    wakasek: [{ nama: 'Hj. Nurul Hidayah, S.Pd.', nip: '198203102006042001', bidang: 'Kurikulum' }],
    operator: { nama: 'Ahmad Fauzi, S.Kom.', nip: '199010152020121001' },
    bendahara: { nama: 'Siti Aminah, S.E.', nip: '198506252015032001' },
    jenjang: 'MTs',
    jumlah_rombel: 9,
    jenjang_code: 'smp_mts',
  },
  {
    nama: 'SMA Negeri 3 Inspirasi Bangsa',
    npsn: '20261002',
    jenjang: 'SMA',
    naungan: 'Kemendikbud',
    domain: 'sman3inspirasi.sch.id',
    alamat: 'Jl. Graha Pendidikan Kav. 88, Jakarta Selatan',
    kepala: { nama: 'Dr. Ratna Kumala Dewi, M.Si.', nip: '197208201995022001' },
    wakasek: [
      { nama: 'Budi Santoso, M.Pd.', nip: '198104152008011001', bidang: 'Kesiswaan' },
      { nama: 'Dewi Kusuma Ningrum, S.Pd.', nip: '198309202010012001', bidang: 'Sarana Prasarana' },
    ],
    operator: { nama: 'Rizki Ramadhan, A.Md.', nip: '199208152018011001' },
    bendahara: { nama: 'Tri Wahyuni, S.E.', nip: '198710252014032001' },
    jenjang: 'SMA',
    jumlah_rombel: 12,
    jenjang_code: 'sma_ma',
  },
];

const MAPEL_SMP = ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama Islam', 'Pendidikan Pancasila', 'Seni Budaya', 'Prakarya'];
const MAPEL_SMA = ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'Fisika', 'Kimia', 'Biologi', 'Sejarah', 'Geografi', 'Ekonomi', 'Sosiologi', 'Informatika', 'Pendidikan Agama Islam', 'Pendidikan Pancasila', 'Seni Budaya'];

const FIRST_NAMES = ['Rizki', 'Aisyah', 'Fajar', 'Nadia', 'Bayu', 'Salsabila', 'Dimas', 'Putri', 'Ahmad', 'Diana', 'Rizky', 'Siti', 'Bimo', 'Wulan', 'Galang', 'Anisa', 'Hendra', 'Rini', 'Yoga', 'Lestari'];
const LAST_NAMES = ['Pratama', 'Wibowo', 'Kusuma', 'Hidayat', 'Nugroho', 'Rahman', 'Setiawan', 'Fauzi', 'Ramadhani', 'Putri', 'Saputra', 'Wijaya', 'Kurniawan', 'Andriana', 'Suryanto'];

const EKSKUL_LIST = ['Pramuka', 'Futsal', 'Karya Ilmiah Remaja', 'Seni Tari', 'Robotik'];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function phone(): string {
  const prefixes = ['812', '813', '814', '815', '816', '817', '818'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const n = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return `+628${p}${n}`;
}

function nisn(): string {
  return Math.floor(Math.random() * 9000000000 + 1000000000).toString();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function predikat(nilai: number): string {
  if (nilai >= 90) return 'A';
  if (nilai >= 80) return 'B';
  if (nilai >= 70) return 'C';
  if (nilai >= 60) return 'D';
  return 'E';
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ============================================
// CLEANUP
// ============================================

async function cleanup(): Promise<void> {
  console.log(`🧹 Cleaning up seed data (batch: ${BATCH})...`);
  const c = await pool.connect();
  try {
    const tables = [
      'catatan_wali_kelas', 'penilaian_ekstrakurikuler', 'penilaian_sikap', 'ekstrakurikuler',
      'data_raport_nilai_mapel', 'data_raport_status_history', 'data_raport',
      'student_attendance', 'student_grades', 'teacher_attendance',
      'academic_calendars', 'schedules',
      'wali_kelas_assignments',
      'assessments',
    ];
    for (const t of tables) {
      try { await c.query(`DELETE FROM ${t} WHERE seed_batch = $1`, [BATCH]); } catch {}
    }

    const tables2 = ['students', 'classes', 'subjects', 'schedules', 'assessments'];
    for (const t of tables2) {
      try { await c.query(`DELETE FROM ${t} WHERE seed_batch = $1`, [BATCH]); } catch {}
    }

    await c.query(`DELETE FROM schools WHERE seed_batch = $1`, [BATCH]);
    await c.query(`DELETE FROM users WHERE seed_batch = $1`, [BATCH]);
    await c.query(`DELETE FROM tahun_ajaran WHERE seed_batch = $1`, [BATCH]);
    await c.query(`DELETE FROM template_raport WHERE seed_batch = $1`, [BATCH]);

    console.log('✅ Cleanup done');
  } finally {
    c.release();
  }
}

// ============================================
// SEED
// ============================================

async function seed(): Promise<SeedResult> {
  console.log(`🌱 Seeding GuruPRO manual testing data (batch: ${BATCH})`);
  const c = await pool.connect();
  const result: SeedResult = { users: [], institutions: [], schools: [], classes: [], students: [], credentials: [] };

  try {
    await c.query('BEGIN');

    // --- 1. Tahun Ajaran 2026/2027 ---
    console.log('   [1] Tahun Ajaran 2026/2027...');
    const taId = uuid();
    await c.query(`
      INSERT INTO tahun_ajaran (id, nama, tanggal_mulai, tanggal_selesai, is_active, semester_type, semester, seed_batch)
      VALUES ($1, '2026/2027', '2026-07-01', '2027-06-30', true, 'full', 'Ganjil', $2)
      ON CONFLICT DO NOTHING
    `, [taId, BATCH]);

    // --- 2. 5 Guru Mandiri ---
    console.log('   [2] 5 Guru Mandiri...');
    for (let i = 0; i < 5; i++) {
      const sekolah = SEKOLAH_MANDIRI[i];
      const guruId = uuid();
      const mapelList = sekolah.jenjang === 'SMP' || sekolah.jenjang === 'MTs' ? pickN(MAPEL_SMP, 2) : pickN(MAPEL_SMA, 2);
      const passHash = await hash(DEFAULT_PASSWORD, SALT_ROUNDS);
      const email = `guru${i + 1}@${sekolah.domain}`;
      const nama = NAMA_GURU_MANDIRI[i];

      await c.query(`
        INSERT INTO users (id, email, whatsapp, nama_lengkap, password_hash,
          role, status_langganan, token_limit, quota_poin_total, addon_poin,
          subscription_start, subscription_end, subscription_status, is_active,
          is_seed_data, seed_batch, phone_verified, email_verified)
        VALUES ($1, $2, $3, $4, $5, 'guru', 'one_year', 1000, 1000, 0,
          '2026-07-01', '2027-06-30', 'active', true,
          true, $6, true, true)
      `, [guruId, email, phone(), nama, passHash, BATCH]);

      result.users.push({ id: guruId, email, nama, role: 'guru', type: 'mandiri' });
      result.credentials.push({ email, password: DEFAULT_PASSWORD, nama, role: 'guru' });

      // School untuk guru mandiri
      const schoolId = uuid();
      await c.query(`
        INSERT INTO schools (id, user_id, nama_sekolah, npsn, alamat,
          nama_kepala_sekolah, nip_kepala_sekolah, is_seed_data, seed_batch)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
      `, [schoolId, guruId, sekolah.nama, sekolah.npsn, 'Alamat sekolah ' + sekolah.nama,
          'Drs. ' + nama.split(' ')[0], '000000000000000000', BATCH]);
      result.schools.push({ id: schoolId, nama: sekolah.nama, type: 'mandiri' });

      // Subjects
      const subjectIds: string[] = [];
      const mapelPerSekolah: Record<number, string[]> = {
        0: ['Matematika', 'Fisika'],
        1: ['Bahasa Indonesia', 'Bahasa Inggris'],
        2: ['Pendidikan Agama Islam', 'Matematika'],
        3: ['Kimia', 'Biologi'],
        4: ['IPA', 'IPS'],
      };
      const mapelSaya = mapelPerSekolah[i];
      for (const mp of mapelSaya) {
        const sid = uuid();
        await c.query(`
          INSERT INTO subjects (id, school_id, nama_mapel, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, true, $4)
        `, [sid, schoolId, mp, BATCH]);
        subjectIds.push(sid);
      }

      // Classes (2-3 kelas)
      const kelasList = ['VII-A', 'VII-B', 'VIII-A', 'VIII-B', 'IX-A', 'IX-B', 'X-IPA-1', 'X-IPS-1', 'XI-IPA-1', 'XI-IPS-1'];
      const numKelas = 2 + (i % 2);
      const kelasIds: string[] = [];
      for (let k = 0; k < numKelas; k++) {
        const kid = uuid();
        await c.query(`
          INSERT INTO classes (id, school_id, nama_kelas, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, true, $4)
        `, [kid, schoolId, kelasList[i * 2 + k] || `Kelas-${k + 1}`, BATCH]);
        kelasIds.push(kid);
        result.classes.push({ id: kid, nama: kelasList[i * 2 + k], schoolId });
      }

      // Schedules Mon-Sat
      const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const times = [['07:00', '07:45'], ['07:45', '08:30'], ['08:30', '09:15'], ['09:30', '10:15'], ['10:15', '11:00']];
      for (const kid of kelasIds) {
        for (let d = 0; d < (i < 3 ? 6 : 5); d++) {
          const sid = uuid();
          const jamIdx = d % times.length;
          await c.query(`
            INSERT INTO schedules (id, school_id, class_id, subject_id, hari, jam_mulai, jam_selesai, is_seed_data, seed_batch)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
          `, [sid, schoolId, kid, subjectIds[d % subjectIds.length], days[d], times[jamIdx][0], times[jamIdx][1], BATCH]);

          // Assessments per mapel
          const mapelId = subjectIds[d % subjectIds.length];
          // UH 2x
          for (let uh = 1; uh <= 2; uh++) {
            const aid = uuid();
            await c.query(`
              INSERT INTO assessments (id, school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkm, is_seed_data, seed_batch)
              VALUES ($1, $2, $3, $4, $5, 'ulangan_harian', 70, true, $6)
            `, [aid, schoolId, kid, mapelId, `UH ${uh}`, BATCH]);
          }
          // PTS
          const ptsId = uuid();
          await c.query(`
            INSERT INTO assessments (id, school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkm, is_seed_data, seed_batch)
            VALUES ($1, $2, $3, $4, 'PTS Ganjil', 'pts', 70, true, $5)
          `, [ptsId, schoolId, kid, mapelId, BATCH]);
        }
      }

      // Students per class (10 each)
      const siswaPerKelas = ['VII-A', 'VII-B', 'VIII-A', 'VIII-B', 'IX-A', 'IX-B', 'X-IPA-1', 'X-IPS-1'];
      for (const kid of kelasIds) {
        const kelasNama = kelasIds.indexOf(kid) === 0 ? siswaPerKelas[i * 2] : siswaPerKelas[i * 2 + 1] || `Kelas ${kelasIds.indexOf(kid) + 1}`;
        for (let s = 1; s <= 10; s++) {
          const studId = uuid();
          const fn = pick(FIRST_NAMES);
          const ln = pick(LAST_NAMES);
          const nisLokal = `NL${randInt(1000, 9999)}`;
          await c.query(`
            INSERT INTO students (id, class_id, nama_siswa, nisn, nis_lokal, nomor_absen, is_seed_data, seed_batch)
            VALUES ($1, $2, $3, $4, $5, $6, true, $7)
          `, [
            studId, kid,
            `${fn} ${ln}`,
            nisn(), nisLokal, s,
            BATCH
          ]);
          result.students.push({ id: studId, nama: `${fn} ${ln}`, classId: kid, schoolId });
        }
      }
    }

    // --- 3. Payload: Institutions + CMS Users + Members ---
    console.log('   [3] Payload Institutions & Members...');
    for (let i = 0; i < 2; i++) {
      const inst = INSTITUSI[i];
      const instResult = await c.query(`
        INSERT INTO payload.institutions (name, npsn, jenjang, naungan, subscription_tier,
          academic_year_active, approval_layer_config, status)
        VALUES ($1, $2, $3, $4, 'trial', '2026/2027', 'single', 'active')
        RETURNING id
      `, [inst.nama, inst.npsn, inst.jenjang, inst.naungan]);
      const instDbId = instResult.rows[0].id;
      result.institutions.push({ id: instDbId, nama: inst.nama, type: 'institution' });
    }

    // CMS Users untuk 2 institusi (kepala sekolah, wakasek, operator, bendahara, 3 guru)
    const guruInstCreds: { email: string; pass: string; nama: string; role: string; instIdx: number }[] = [];
    for (let i = 0; i < 2; i++) {
      const inst = INSTITUSI[i];
      const passHash = await hash(DEFAULT_PASSWORD, SALT_ROUNDS);

      // Kepala Sekolah
      const ksEmail = `kepala.sekolah${i + 1}@${inst.domain}`;
      await c.query(`
        INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at)
        VALUES ($1, $2, 'admin', '', '', true, '1.0', NOW())
      `, [inst.kepala.nama, ksEmail]);
      guruInstCreds.push({ email: ksEmail, pass: DEFAULT_PASSWORD, nama: inst.kepala.nama, role: 'kepala_sekolah', instIdx: i });

      // Wakasek
      for (const ws of inst.wakasek) {
        const wsEmail = `wakasek.${ws.bidang.toLowerCase().replace(' ', '')}${i + 1}@${inst.domain}`;
        await c.query(`
          INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at)
          VALUES ($1, $2, 'editor', '', '', true, '1.0', NOW())
        `, [ws.nama, wsEmail]);
        guruInstCreds.push({ email: wsEmail, pass: DEFAULT_PASSWORD, nama: ws.nama, role: 'wakasek', instIdx: i });
      }

      // Operator
      const opEmail = `operator${i + 1}@${inst.domain}`;
      await c.query(`
        INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at)
        VALUES ($1, $2, 'editor', '', '', true, '1.0', NOW())
      `, [inst.operator.nama, opEmail]);
      guruInstCreds.push({ email: opEmail, pass: DEFAULT_PASSWORD, nama: inst.operator.nama, role: 'operator', instIdx: i });

      // Bendahara
      const bendEmail = `bendahara${i + 1}@${inst.domain}`;
      await c.query(`
        INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at)
        VALUES ($1, $2, 'editor', '', '', true, '1.0', NOW())
      `, [inst.bendahara.nama, bendEmail]);
      guruInstCreds.push({ email: bendEmail, pass: DEFAULT_PASSWORD, nama: inst.bendahara.nama, role: 'bendahara', instIdx: i });
    }

    // --- 4. 6 Guru Institusi (app users + institution members) ---
    console.log('   [4] 6 Guru Institusi...');
    const guruInstData = [
      { nama: 'Hasan Wijaya, S.Pd.', mapel: ['Matematika', 'Fisika'], instIdx: 0, isWaliKelas: true, kelas: 'VII-A' },
      { nama: 'Nur Fadilah, S.Pd.', mapel: ['Bahasa Indonesia', 'Bahasa Inggris'], instIdx: 0, isWaliKelas: true, kelas: 'VIII-A' },
      { nama: 'Asep Saepudin, M.Si.', mapel: ['IPA'], instIdx: 0, isWaliKelas: false, kelas: 'IX-A' },
      { nama: 'Dr. Maya Sari, M.Sc.', mapel: ['Kimia', 'Biologi'], instIdx: 1, isWaliKelas: true, kelas: 'X-IPA-1' },
      { nama: 'Hendra Gunawan, S.Pd.', mapel: ['Matematika', 'Ekonomi'], instIdx: 1, isWaliKelas: true, kelas: 'XI-IPS-1' },
      { nama: 'Rina Hartati, S.Pd.', mapel: ['Sejarah', 'Sosiologi'], instIdx: 1, isWaliKelas: false, kelas: 'X-IPS-1' },
    ];

    const memberIdMap = new Map<string, number>(); // member id per guru
    for (let i = 0; i < guruInstData.length; i++) {
      const gd = guruInstData[i];
      const inst = INSTITUSI[gd.instIdx];
      const guruId = uuid();
      const passHash = await hash(DEFAULT_PASSWORD, SALT_ROUNDS);
      const email = `guru.inst${i + 1}@${inst.domain}`;

      await c.query(`
        INSERT INTO users (id, email, whatsapp, nama_lengkap, password_hash,
          role, status_langganan, token_limit, quota_poin_total, addon_poin,
          subscription_start, subscription_end, subscription_status, is_active,
          is_seed_data, seed_batch, phone_verified, email_verified)
        VALUES ($1, $2, $3, $4, $5, 'guru', 'one_year', 1000, 1000, 0,
          '2026-07-01', '2027-06-30', 'active', true,
          true, $6, true, true)
      `, [guruId, email, phone(), gd.nama, passHash, BATCH]);

      result.users.push({ id: guruId, email, nama: gd.nama, role: 'guru', type: 'institusi' });
      result.credentials.push({ email, password: DEFAULT_PASSWORD, nama: gd.nama, role: 'guru_institusi', institution: inst.nama });

      // CMS User
      const cmsResult = await c.query(`
        INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at)
        VALUES ($1, $2, 'editor', '', '', true, '1.0', NOW())
        RETURNING id
      `, [gd.nama, email]);
      const cmsUserId = cmsResult.rows[0].id;

      // Institution Member
      // Institution Member (user_id=integer cms_users.id, app_user_id=varchar users.id UUID, id=integer auto)
      const instResult2 = await c.query(`
        INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at)
        SELECT $1, $2, i.id, 'active', NOW()
        FROM payload.cms_users cu
        JOIN users u ON u.email = cu.email
        JOIN payload.institutions i ON i.name = $3
        WHERE cu.email = $4
        RETURNING id
      `, [cmsUserId, guruId, inst.nama, email]);
      const rawMemberId = instResult2.rows[0].id;
      // Store as UUID string for compatibility with wali_kelas_assignments
      const memberId = `00000000-0000-0000-0000-${rawMemberId.toString().padStart(12, '0')}`;
      memberIdMap.set(guruId, memberId);

      // Roles (wali_kelas tracked at app layer via wali_kelas_assignments, not Payload)
      const roles = ['guru'];
      for (let r = 0; r < roles.length; r++) {
        await c.query(`
          INSERT INTO payload.institution_members_role (parent_id, "order", value)
          VALUES ($1, $2, $3)
        `, [rawMemberId, r, roles[r]]);
      }

      // Assigned mapel
      for (const mp of gd.mapel) {
        await c.query(`
          INSERT INTO payload.institution_members_assigned_mapel (_order, _parent_id, id, mapel)
          SELECT COALESCE(MAX(_order), 0) + 1, $1, gen_random_uuid()::text, $2
          FROM payload.institution_members_assigned_mapel WHERE _parent_id = $1
        `, [rawMemberId, mp]);
      }
    }

    // Schools untuk institusi
    const schoolIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const inst = INSTITUSI[i];
      const schoolId = uuid();
      const guruIdsForSchool = guruInstData.filter(g => g.instIdx === i).map((_, idx) => guruInstData.filter(x => x.instIdx === i)[idx]?.nama || '');

      await c.query(`
        INSERT INTO schools (id, user_id, nama_sekolah, npsn, alamat,
          nama_kepala_sekolah, nip_kepala_sekolah,
          show_ttd_kepala, show_ttd_wali,
          is_seed_data, seed_batch)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, true, $8)
      `, [
        schoolId, result.users[0].id, inst.nama, inst.npsn, inst.alamat,
        inst.kepala.nama, inst.kepala.nip, BATCH
      ]);
      schoolIds.push(schoolId);
      result.schools.push({ id: schoolId, nama: inst.nama, type: 'institusi' });
    }

    // Subjects untuk institusi
    const instSubjectIds: string[][] = [[], []];
    const instScheduleIds: string[][] = [[], []];
    for (let i = 0; i < 2; i++) {
      const mapelList = i === 0 ? MAPEL_SMP : MAPEL_SMA;
      for (const mp of mapelList) {
        const sid = uuid();
        await c.query(`
          INSERT INTO subjects (id, school_id, nama_mapel, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, true, $4)
        `, [sid, schoolIds[i], mp, BATCH]);
        instSubjectIds[i].push(sid);
      }
    }

    // Classes untuk institusi
    const kelasByInst: string[][] = [[], []];
    const kelasNames = [
      ['VII-A', 'VII-B', 'VIII-A', 'VIII-B', 'IX-A', 'IX-B'],
      ['X-IPA-1', 'X-IPS-1', 'XI-IPA-1', 'XI-IPS-1', 'XII-IPA-1', 'XII-IPS-1'],
    ];
    for (let i = 0; i < 2; i++) {
      for (const kn of kelasNames[i]) {
        const kid = uuid();
        await c.query(`
          INSERT INTO classes (id, school_id, nama_kelas, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, true, $4)
        `, [kid, schoolIds[i], kn, BATCH]);
        kelasByInst[i].push(kid);
        result.classes.push({ id: kid, nama: kn, schoolId: schoolIds[i] });
      }
    }

    // Wali Kelas Assignments
    for (let i = 0; i < guruInstData.length; i++) {
      const gd = guruInstData[i];
      if (gd.isWaliKelas && memberIdMap.has(guruIdByName(gd.nama, result))) {
        const memberId = memberIdMap.get(guruIdByName(gd.nama, result))!;
        const kelasIdx = kelasNames[gd.instIdx].indexOf(gd.kelas);
        if (kelasIdx >= 0) {
          await c.query(`
            INSERT INTO wali_kelas_assignments (id, kelas_id, wali_kelas_member_id, tahun_ajaran, semester, status, ditugaskan_pada, seed_batch)
            VALUES ($1, $2, CAST($3 AS UUID), '2026/2027', 'ganjil', 'aktif', NOW(), $4)
          `, [uuid(), kelasByInst[gd.instIdx][kelasIdx], memberId, BATCH]);
        }
      }
    }

    // Schedules untuk guru institusi (Mon-Sat)
    for (let i = 0; i < guruInstData.length; i++) {
      const gd = guruInstData[i];
      const guruId = result.users.find(u => u.nama === gd.nama)?.id;
      if (!guruId) continue;
      const kelasIdx = kelasNames[gd.instIdx].indexOf(gd.kelas);
      if (kelasIdx < 0) continue;
      const kid = kelasByInst[gd.instIdx][kelasIdx];

      const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const times = [['07:00', '07:45'], ['08:00', '08:45'], ['09:15', '10:00'], ['10:15', '11:00']];
      for (let d = 0; d < (i < 3 ? 6 : 5); d++) {
        const sid = uuid();
        const mp = gd.mapel[d % gd.mapel.length];
        const mpId = instSubjectIds[gd.instIdx].find((_, idx) => {
          const mapelList = gd.instIdx === 0 ? MAPEL_SMP : MAPEL_SMA;
          return mapelList[idx] === mp;
        }) || instSubjectIds[gd.instIdx][0];

        await c.query(`
          INSERT INTO schedules (id, school_id, class_id, subject_id, hari, jam_mulai, jam_selesai, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
        `, [sid, schoolIds[gd.instIdx], kid, mpId, days[d], times[d % times.length][0], times[d % times.length][1], BATCH]);
        instScheduleIds[gd.instIdx].push(sid);
      }
    }

    // Students untuk institusi (15-20 per kelas)
    for (let i = 0; i < 2; i++) {
      for (let ki = 0; ki < kelasByInst[i].length; ki++) {
        const kid = kelasByInst[i][ki];
        const numStudents = 15 + (ki % 3) * 2;
        for (let s = 1; s <= numStudents; s++) {
          const studId = uuid();
          const fn = pick(FIRST_NAMES);
          const ln = pick(LAST_NAMES);
          await c.query(`
            INSERT INTO students (id, class_id, nama_siswa, nisn, nis_lokal, nomor_absen, is_seed_data, seed_batch)
            VALUES ($1, $2, $3, $4, $5, $6, true, $7)
          `, [studId, kid, `${fn} ${ln}`, nisn(), `NL${randInt(1000, 9999)}`, s, BATCH]);
          result.students.push({ id: studId, nama: `${fn} ${ln}`, classId: kid, schoolId: schoolIds[i] });
        }
      }
    }

    // --- 5. Template Raport + Data Raport untuk semua siswa ---
    console.log('   [5] Template Raport & Data Raport...');
    for (const sch of result.schools) {
      const tmplId = uuid();
      await c.query(`
        INSERT INTO template_raport (id, sekolah_id, nama_template, jalur_regulasi, jenjang,
          kurikulum, jenis_laporan, mode_nilai_akademik, varian_sikap, basis_deskripsi,
          sections, is_default, seed_batch)
        VALUES ($1, $2, 'Template Default', 'kemendikdasmen', $3,
          'kurikulum_merdeka', 'akhir_semester', 'angka_kkm', 'profil_pelajar_pancasila',
          'capaian_pembelajaran',
          '[{"sectionType":"header","order":1,"wajib":true},{"sectionType":"identitas","order":2,"wajib":true},{"sectionType":"nilai_mapel","order":3,"wajib":true},{"sectionType":"sikap","order":4,"wajib":true},{"sectionType":"ekskul","order":5,"wajib":false},{"sectionType":"catatan_wali_kelas","order":6,"wajib":true},{"sectionType":"footer","order":7,"wajib":true}]'::jsonb,
          true, $4)
      `, [tmplId, sch.id, sch.type === 'mandiri' ? 'smp_mts' : (sch.nama.includes('SMA') ? 'sma_ma' : 'smp_mts'), BATCH]);

      // Student grades + raport data
      const studentsInSchool = result.students.filter(s => s.schoolId === sch.id);
      for (const st of studentsInSchool) {
        // Student grades per assessment (generate realistic values)
        const assessments = (await c.query(`
          SELECT id, subject_id FROM assessments WHERE seed_batch = $1
        `, [BATCH])).rows;
        const studentAssessments = assessments.filter(a => {
          // match assessment class to student class
          return true; // simplified
        });

        for (const as of studentAssessments.slice(0, 8)) {
          const nilaiAwal = randFloat(65, 95);
          const isRemed = nilaiAwal < 70;
          const nilaiRemed = isRemed ? randFloat(60, 75) : null;
          const nilaiAkhir = isRemed ? Math.max(nilaiAwal, nilaiRemed!) : nilaiAwal;
          await c.query(`
            INSERT INTO student_grades (id, assessment_id, student_id, nilai_awal, nilai_remedial, nilai_akhir, status_remedial, is_seed_data, seed_batch)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
          `, [uuid(), as.id, st.id, nilaiAwal, nilaiRemed, nilaiAkhir, nilaiAkhir >= 70 ? 'Lulus' : 'Remedial', BATCH]);
        }

        // Data raport
        const drId = uuid();
        const sikapId = uuid();
        const siswaInfo = (await c.query(`SELECT nisn, nis_lokal FROM students WHERE id = $1`, [st.id])).rows[0];
        const raporStatus = Math.random() > 0.4 ? 'draft' : 'dikirim_ke_wali_kelas';
        await c.query(`
          INSERT INTO data_raport (id, siswa_id, nisn, nis_lokal, kelas_id, template_raport_id,
            periode, jenis_laporan, status, sikap_id, catatan_wali_kelas, presensi_snapshot,
            is_seed_data, seed_batch)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13)
        `, [
          drId, st.id, siswaInfo?.nisn || nisn(), siswaInfo?.nis_lokal || `NL${randInt(1000, 9999)}`,
          st.classId, tmplId,
          'AS-2026/2027-Ganjil', 'akhir_semester', raporStatus,
          sikapId,
          CATATAN_WALI_KELAS[randInt(0, CATATAN_WALI_KELAS.length - 1)],
          JSON.stringify({ sakit: randInt(0, 3), izin: randInt(0, 2), alpa: randInt(0, 1) }),
          BATCH
        ]);

        // Nilai mapel di raport
        const mpList = sch.type === 'mandiri' ? pickN(MAPEL_SMP, 7) : pickN(MAPEL_SMA, 10);
        for (const mp of mpList) {
          const nilaiAkhir = randFloat(65, 95);
          await c.query(`
            INSERT INTO data_raport_nilai_mapel (id, data_raport_id, mapel_id, guru_mapel_member_id,
              nilai_akhir, kkm, deskripsi_capaian, is_seed_data, seed_batch)
            VALUES ($1, $2, $3, $4, $5, 70, $6, true, $7)
          `, [
            uuid(), drId, uuid(), uuid(), nilaiAkhir,
            `Siswa menunjukkan pemahaman ${nilaiAkhir >= 80 ? 'yang baik' : nilaiAkhir >= 70 ? 'yang cukup' : 'yang masih perlu ditingkatkan'} terhadap materi ${mp}.`,
            BATCH
          ]);
        }

        // Penilaian Sikap
        const dimensiSikap = ['Beriman', 'Berkebinekaan', 'Gotong Royong', 'Mandiri', 'Bernalar Kritis', 'Kreatif'];
        const predikats = ['Sangat Baik', 'Baik', 'Cukup'];
        const dimensiData = dimensiSikap.slice(0, 4).map(d => ({
          dimensi: d,
          predikat: pick(predikats)
        }));
        await c.query(`
          INSERT INTO penilaian_sikap (id, siswa_id, kelas_id, periode, varian,
            penilaian_per_dimensi, deskripsi_umum, dinilai_oleh, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
        `, [
          sikapId, st.id, st.classId, 'AS-2026/2027-Ganjil',
          'profil_pelajar_pancasila',
          JSON.stringify(dimensiData),
          'Siswa menunjukkan sikap positif dalam pembelajaran dan aktivitas sekolah.',
          uuid(), BATCH
        ]);

        // Catatan Wali Kelas
        await c.query(`
          INSERT INTO catatan_wali_kelas (id, siswa_id, kelas_id, periode, catatan, ditulis_oleh, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, $4, $5, $6, true, $7)
        `, [
          uuid(), st.id, st.classId, 'AS-2026/2027-Ganjil',
          CATATAN_WALI_KELAS[randInt(0, CATATAN_WALI_KELAS.length - 1)],
          uuid(), BATCH
        ]);

        // Status history
        await c.query(`
          INSERT INTO data_raport_status_history (id, data_raport_id, status, changed_by, changed_by_role)
          VALUES ($1, $2, $3, $4, 'guru_mapel')
        `, [uuid(), drId, 'draft', uuid()]);
      }
    }

    // --- 6. Ekstrakurikuler ---
    console.log('   [6] Ekstrakurikuler...');
    for (let i = 0; i < EKSKUL_LIST.length; i++) {
      const ekskul = EKSKUL_LIST[i];
      const instIdx = i % 2;
      const pembinaMemberId = memberIdMap.get(result.users.find(u => u.type === 'institusi')?.id || '') || 1;

      for (let ki = 0; ki < Math.min(3, kelasByInst[instIdx].length); ki++) {
        const eksId = uuid();
        await c.query(`
          INSERT INTO ekstrakurikuler (id, nama_ekskul, kelas_id, pembina_member_id, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, $4, true, $5)
        `, [eksId, ekskul, kelasByInst[instIdx][ki], pembinaMemberId, BATCH]);

        // Penilaian ekskul untuk beberapa siswa
        const predikatsEks = ['sangat_baik', 'baik', 'cukup'];
        const predikatsLabel = ['Sangat Baik', 'Baik', 'Cukup'];
        const studentsInClass = result.students.filter(s => s.classId === kelasByInst[instIdx][ki]).slice(0, 8);
        for (const st of studentsInClass) {
          const predIdx = randInt(0, 2);
          await c.query(`
            INSERT INTO penilaian_ekstrakurikuler (id, siswa_id, ekstrakurikuler_id, periode, predikat, deskripsi, dinilai_oleh, is_seed_data, seed_batch)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
          `, [
            uuid(), st.id, eksId, 'AS-2026/2027-Ganjil',
            predikatsEks[predIdx],
            `Siswa aktif dalam kegiatan ${ekskul}. ${predikatsLabel[predIdx]} dalam mengikuti latihan.`,
            pembinaMemberId, BATCH
          ]);
        }
      }
    }

    // --- 7. Academic Calendar ---
    console.log('   [7] Kalender Akademik...');
    const kalenderEvents = [
      { nama: 'Masa Pengenalan Lingkungan Sekolah (MPLS)', mulai: '2026-07-13', selesai: '2026-07-17' },
      { nama: 'Ulangan Tengah Semester (UTS)', mulai: '2026-09-08', selesai: '2026-09-12' },
      { nama: 'Ulangan Akhir Semester (PAS)', mulai: '2026-12-01', selesai: '2026-12-12' },
      { nama: 'Pembagian Raport Semester Ganjil', mulai: '2026-12-15', selesai: '2026-12-16' },
      { nama: 'Libur Semester Ganjil', mulai: '2026-12-17', selesai: '2027-01-03' },
      { nama: 'Libur Hari Raya Natal', mulai: '2026-12-25', selesai: '2026-12-26' },
      { nama: 'Tahun Baru 2027', mulai: '2027-01-01', selesai: '2027-01-01' },
    ];
    for (const sch of result.schools) {
      for (const ev of kalenderEvents) {
        await c.query(`
          INSERT INTO academic_calendars (id, school_id, event_name, tanggal_mulai, tanggal_selesai, keterangan, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, $4, $5, $6, true, $7)
        `, [uuid(), sch.id, ev.nama, ev.mulai, ev.selesai, 'Kalender akademik semester ganjil', BATCH]);
      }
    }

    // --- 8. Teacher & Student Attendance (3 minggu) ---
    console.log('   [8] Presensi Guru & Siswa...');
    for (const user of result.users) {
      for (let d = 0; d < 15; d++) {
        const tgl = new Date(2026, 7, 1 + d * 2); // Aug 2026, every 2 days
        if (tgl.getDay() === 0) continue; // skip Sunday
        await c.query(`
          INSERT INTO teacher_attendance (id, user_id, school_id, tanggal, status, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, $4, $5, true, $6)
        `, [uuid(), user.id, result.schools[0].id, formatDate(tgl), pick(['Hadir', 'Hadir', 'Hadir', 'Izin', 'Sakit', 'Terlambat']), BATCH]);
      }
    }

    for (const st of result.students) {
      for (let d = 0; d < 15; d++) {
        const tgl = new Date(2026, 7, 1 + d * 2);
        if (tgl.getDay() === 0) continue;
        // Use institution schedule IDs for institution students, skip mandiri for simplicity
        const instIdx = schoolIds.indexOf(st.schoolId);
        if (instIdx < 0 || instScheduleIds[instIdx].length === 0) continue;
        const schedId = pick(instScheduleIds[instIdx]);
        await c.query(`
          INSERT INTO student_attendance (id, schedule_id, student_id, tanggal, status, is_seed_data, seed_batch)
          VALUES ($1, $2, $3, $4, $5, true, $6)
        `, [uuid(), schedId, st.id, formatDate(tgl), pick(['Hadir', 'Hadir', 'Hadir', 'Izin', 'Sakit', 'Alpa']), BATCH]);
      }
    }

    // --- 9. Transactions (Langganan one_year: 1000 poin, Rp 150.000) ---
    console.log('   [9] Transaksi Poin...');
    for (const user of result.users) {
      await c.query(`
        INSERT INTO transactions (id, user_id, external_id, amount, status, payment_method, plan_id, is_seed_data, seed_batch)
        VALUES ($1, $2, $3, $4, 'PAID', 'transfer', 'one_year', true, $5)
      `, [uuid(), user.id, `SEED-PAY-${uuid().slice(0, 8)}`, 150000, BATCH]);
    }

    // --- 10. Perpustakaan Digital (bahan ajar) ---
    console.log('   [10] Bahan Ajar Perpustakaan...');
    const bahanList = [
      { tipe: 'bahan_ajar', judul: 'Modul Ajar Matematika Kelas VII Semester 1' },
      { tipe: 'bahan_ajar', judul: ' LKPD IPA Percepatan dan Gerak' },
      { tipe: 'bahan_ajar', judul: 'Silabus Bahasa Indonesia Kurikulum Merdeka' },
      { tipe: 'bahan_ajar', judul: 'ATP Pendidikan Pancasila Kelas X' },
      { tipe: 'bahan_ajar', judul: 'RPP Tematik Terpadu Kelas IV' },
    ];
    for (let i = 0; i < Math.min(5, result.users.length); i++) {
      const b = bahanList[i];
      await c.query(`
        INSERT INTO guru_administrasi (id, user_id, tipe_dokumen, judul_dokumen, konten, tanggal_kegiatan, semester, tahunajaran, jenjang, kurikulum)
        VALUES ($1, $2, $3, $4, $5, '2026-08-01', 'Ganjil', '2026/2027', 'SMP', 'kurikulum_merdeka')
      `, [uuid(), result.users[i].id, b.tipe, b.judul, JSON.stringify({ bab: 1, semester: 'Ganjil' })]);
    }

    await c.query('COMMIT');
    console.log('✅ Seed complete!');

  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }

  return result;
}

// ============================================
// HELPERS
// ============================================

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function guruIdByName(nama: string, result: SeedResult): string {
  return result.users.find(u => u.nama === nama)?.id || '';
}

// ============================================
// DATA
// ============================================

const NAMA_GURU_MANDIRI = [
  'Dedi Kuswanto, S.Pd.',
  'Ratna Sari Dewi, M.Pd.',
  'Ahmad Fauzan, S.Pd.I',
  'Nurhayati, S.Si.',
  'Heri Supriyanto, M.Pd.',
];

const CATATAN_WALI_KELAS = [
  'Siswa menunjukkan semangat belajar yang tinggi dan aktif berpartisipasi dalam diskusi kelas. Perlu dorongan lebih untuk mengerjakan tugas tepat waktu.',
  'Memiliki potensi besar dalam bidang akademik. Disarankan untuk lebih aktif dalam kegiatan ekstrakurikuler untuk mengembangkansoft skill.',
  'Siswa disiplin dan teratur dalam mengerjakan tugas. Perlu peningkatan dalam kemampuan bekerja sama dalam kelompok.',
  'Menunjukkan perkembangan positif dalam akademik. Perlu bimbingan lebih dalam mata pelajaran eksak.',
  'Aktif dan kreatif dalam pembelajaran. Disarankan untuk meningkatkan konsentrasi saat penjelasan guru.',
  'Siswa ramah dan mudah bergaul dengan teman sekelas. Prestasi akademik perlu ditingkatkan agar sesuai potensi.',
  'Terdapat peningkatan signifikan dalam hasil belajar dibanding semester sebelumnya. Pertahankan!',
  'Siswa memiliki kemampuan analitis yang baik. Perlu latihan lebih banyak soal cerita untuk mengasah pemahaman.',
];

interface SeedResult {
  users: { id: string; email: string; nama: string; role: string; type: string }[];
  institutions: { id: number; nama: string; type: string }[];
  schools: { id: string; nama: string; type: string }[];
  classes: { id: string; nama: string; schoolId: string }[];
  students: { id: string; nama: string; classId: string; schoolId: string }[];
  credentials: { email: string; password: string; nama: string; role: string; institution?: string }[];
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const isCleanup = args.includes('--cleanup');

  try {
    const client = await pool.connect();
    console.log('✅ DB connection OK');
    client.release();

    if (isCleanup) {
      await cleanup();
    } else {
      await seed();
    }

    console.log('');
    console.log('📝 CREDENTIALS (all accounts use password: Password123!)');
    console.log('---');
    const creds = (await pool.query(`SELECT nama_lengkap, email FROM users WHERE seed_batch = $1 ORDER BY email`, [BATCH])).rows;
    for (const u of creds) {
      console.log(`   ${u.nama_lengkap} — ${u.email}`);
    }

    console.log('');
    console.log('⚠️  Batch tag:', BATCH);
    console.log('   Hapus: DELETE FROM users WHERE seed_batch = $1');

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

