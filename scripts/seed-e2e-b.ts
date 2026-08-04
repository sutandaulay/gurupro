/**
 * E2E Campaign Seed — Tenant B (TEST_SMA) + guru tambahan
 *
 * Idempotent. Melengkapi institution TEST_SMA (payload id 2, NPSN TEST_0002)
 * yang belum punya data di public schema:
 *   - public.schools        (TEST_SMA Negeri 1 Jakarta, NPSN TEST_0002)
 *   - public.subjects       (mapel SMA)
 *   - public.classes        (3 kelas: X-A, X-B, XI-A)
 *   - public.students       (15-20 siswa/kelas)
 *   - public.tahun_ajaran   (2025/2026 aktif)
 *   - users TEST_ guru + cms_users + institution_members + roles
 *
 * Semua user baru: password test123, verified, prefix TEST_.
 *
 * Usage: npx tsx scripts/seed-e2e-b.ts
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const pool = new Pool({ connectionString: DATABASE_URL });

const TEST = 'TEST_';
const INST_SMA_ID = 2;             // payload.institutions: TEST_SMA Negeri 1 Test
const SCHOOL_SMA_NPSN = `${TEST}0002`;

function genUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function genPhone(): string {
  const prefixes = ['812', '813', '814', '815', '816', '817', '818', '819'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const n = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return `+628${p}${n}`;
}

const SISWA_PERTENGAH = [
  'Aisyah Putri', 'Budi Santoso', 'Citra Lestari', 'Dimas Pratama', 'Eka Wahyuni',
  'Fajar Ramadhan', 'Gita Permata', 'Hendra Gunawan', 'Intan Permatasari', 'Joko Susilo',
  'Kartika Dewi', 'Lukman Hakim', 'Maya Anggraini', 'Naufal Rizky', 'Oktavia Sari',
  'Putra Ramadhan', 'Qori Amalia', 'Rizky Ananda', 'Siti Nurhaliza', 'Teguh Wibowo',
];

async function main() {
  const c = await pool.connect();
  const passwordHash = await bcrypt.hash('test123', 10);
  let created = 0;

  try {
    await c.query('BEGIN');

    // =========================================================
    // 1. SCHOOL public untuk TEST_SMA
    // =========================================================
    const schoolRes = await c.query('SELECT id FROM schools WHERE npsn = $1', [SCHOOL_SMA_NPSN]);
    let schoolId = schoolRes.rows[0]?.id ?? null;

    if (!schoolId) {
      // user_id: kepala sekolah TEST_SMA (dibuat di bawah) — buat dulu user kepala sekolah
      const ks = await c.query(
        `INSERT INTO users (id, email, whatsapp, nama_lengkap, password_hash, status_langganan,
            token_limit, addon_token_balance, subscription_start, subscription_end, created_at,
            is_active, role, username, phone_verified, email_verified, login_attempts, lock_until)
         VALUES ($1, $2, $3, $4, $5, 'active', 500, 0, NOW(), NOW() + INTERVAL '365 days', NOW(),
            true, 'guru', $6, true, true, 0, NULL)
         ON CONFLICT (email) DO NOTHING RETURNING id`,
        [genUUID(), `${TEST}kepsek-sma@test.gurupro.id`, genPhone(), 'TEST_Kepsek SMA', passwordHash, `${TEST}kepsek_sma`]
      );
      const ksId = ks.rows[0]?.id;
      if (ksId) {
        await c.query(
          `INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at)
           VALUES ($1, $2, 'editor', '', '', true, '1.0', NOW()) ON CONFLICT DO NOTHING`,
          ['TEST_Kepsek SMA', `${TEST}kepsek-sma@test.gurupro.id`]
        );
      }

      const ownerEmail = `${TEST}kepsek-sma@test.gurupro.id`;
      const ownerRes = await c.query('SELECT id FROM users WHERE email = $1', [ownerEmail]);
      const ownerId = ownerRes.rows[0].id;

      const s = await c.query(
        `INSERT INTO schools (id, user_id, nama_sekolah, npsn, alamat, nama_kepala_sekolah, nip_kepala_sekolah)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [genUUID(), ownerId, `${TEST}SMA Negeri 1 Jakarta`, SCHOOL_SMA_NPSN, 'Jl. Test SMA No. 1, Jakarta', 'TEST_Drs. Kepsek SMA', `${TEST}87654321`]
      );
      schoolId = s.rows[0].id;
      created++;
      console.log(`   ✅ School TEST_SMA created: ${schoolId}`);
    } else {
      console.log(`   School TEST_SMA already exists: ${schoolId}`);
    }

    // =========================================================
    // 2. SUBJECTS TEST_SMA
    // =========================================================
    const mapels = ['MATEMATIKA', 'BAHASA INDONESIA', 'BAHASA INGGRIS', 'FISIKA', 'KIMIA',
      'BIOLOGI', 'SEJARAH', 'GEOGRAFI', 'EKONOMI', 'SOSIOLOGI', 'INFORMATIKA', 'PENDIDIKAN AGAMA ISLAM'];
    for (const m of mapels) {
      await c.query(
        `INSERT INTO subjects (id, school_id, nama_mapel)
         SELECT $1, $2, $3::varchar WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE school_id = $2 AND nama_mapel = $3::varchar)`,
        [genUUID(), schoolId, m]
      );
    }
    console.log(`   ✅ Subjects TEST_SMA ensured (${mapels.length})`);

    // =========================================================
    // 3. CLASSES + STUDENTS TEST_SMA
    // =========================================================
    const kelas = ['X-A', 'X-B', 'XI-A'];
    for (const k of kelas) {
      const klRes = await c.query('SELECT id FROM classes WHERE school_id = $1 AND nama_kelas = $2', [schoolId, k]);
      let kelasId = klRes.rows[0]?.id ?? null;
      if (!kelasId) {
        const kr = await c.query(
          `INSERT INTO classes (id, school_id, nama_kelas) VALUES ($1, $2, $3) RETURNING id`,
          [genUUID(), schoolId, k]
        );
        kelasId = kr.rows[0].id;
        created++;
      }
      const cnt = await c.query('SELECT COUNT(*)::int AS n FROM students WHERE class_id = $1', [kelasId]);
      const needed = Math.max(0, 15 - cnt.rows[0].n);
      for (let i = 0; i < needed; i++) {
        const name = SISWA_PERTENGAH[(cnt.rows[0].n + i) % SISWA_PERTENGAH.length];
        await c.query(
          `INSERT INTO students (id, class_id, nama_siswa, nisn, nomor_absen)
           VALUES ($1, $2, $3, $4, $5)`,
          [genUUID(), kelasId, `${name} ${k}`, String(1000000000 + Math.floor(Math.random() * 9000000000)), cnt.rows[0].n + i + 1]
        );
      }
      console.log(`   ✅ Class ${k} ensured, students=${cnt.rows[0].n + needed}`);
    }

    // =========================================================
    // 4. TAHUN AJARAN TEST_SMA (aktif)
    // =========================================================
    await c.query(
      `INSERT INTO tahun_ajaran (id, nama, tanggal_mulai, tanggal_selesai, is_active, semester_type, semester, sekolah_id, created_by)
       SELECT $1, '2025/2026', '2025-07-01', '2026-06-30', true, 'full', 'Ganjil', $2, NULL
       WHERE NOT EXISTS (SELECT 1 FROM tahun_ajaran WHERE sekolah_id = $2 AND nama = '2025/2026')`,
      [genUUID(), schoolId]
    );
    console.log('   ✅ Tahun ajaran TEST_SMA ensured');

    // =========================================================
    // 5. GURU TEST_SMA (role lengkap) + membership
    // =========================================================
    const guruSMA = [
      { email: `${TEST}kepsek-sma@test.gurupro.id`, nama: 'TEST_Kepsek SMA', role: 'kepala_sekolah', username: `${TEST}kepsek_sma` },
      { email: `${TEST}operator-sma@test.gurupro.id`, nama: 'TEST_Operator SMA', role: 'operator', username: `${TEST}operator_sma` },
      { email: `${TEST}wakasek-sma@test.gurupro.id`, nama: 'TEST_Wakasek SMA', role: 'wakasek', username: `${TEST}wakasek_sma` },
      { email: `${TEST}bendahara-sma@test.gurupro.id`, nama: 'TEST_Bendahara SMA', role: 'bendahara', username: `${TEST}bendahara_sma` },
      { email: `${TEST}guru-sma-1@test.gurupro.id`, nama: 'TEST_Guru SMA 1', role: 'guru', username: `${TEST}guru_sma_1` },
      { email: `${TEST}guru-sma-2@test.gurupro.id`, nama: 'TEST_Guru SMA 2', role: 'guru', username: `${TEST}guru_sma_2` },
    ];

    for (const g of guruSMA) {
      const u = await c.query(
        `INSERT INTO users (id, email, whatsapp, nama_lengkap, password_hash, status_langganan,
            token_limit, addon_token_balance, subscription_start, subscription_end, created_at,
            is_active, role, username, phone_verified, email_verified, login_attempts, lock_until)
         VALUES ($1, $2, $3, $4, $5, 'active', 500, 0, NOW(), NOW() + INTERVAL '365 days', NOW(),
            true, 'guru', $6, true, true, 0, NULL)
         ON CONFLICT (email) DO NOTHING RETURNING id`,
        [genUUID(), g.email, genPhone(), g.nama, passwordHash, g.username]
      );
      const userId = u.rows[0]?.id;
      if (!userId) {
        const ex = await c.query('SELECT id FROM users WHERE email = $1', [g.email]);
        if (!ex.rows[0]) throw new Error(`User ${g.email} tidak ada`);
      }

      await c.query(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at)
         VALUES ($1, $2, 'editor', '', '', true, '1.0', NOW())
         ON CONFLICT (email) DO NOTHING`,
        [g.nama, g.email]
      );

      const member = await c.query(
        `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
         SELECT cu.id, u.id, $1, 'active', NOW(), NOW(), NOW()
         FROM payload.cms_users cu JOIN users u ON u.email = cu.email
         WHERE cu.email = $2
         ON CONFLICT (user_id, institution_id) DO UPDATE SET status = EXCLUDED.status
         RETURNING id`,
        [INST_SMA_ID, g.email]
      );
      const memberId = member.rows[0]?.id;
      if (memberId) {
        const roleExists = await c.query(
          `SELECT 1 FROM payload.institution_members_role WHERE parent_id = $1 AND value = $2 LIMIT 1`,
          [memberId, g.role]
        );
        if (roleExists.rows.length === 0) {
          await c.query(
            `INSERT INTO payload.institution_members_role ("order", parent_id, value)
             SELECT (SELECT COALESCE(MAX("order"),0)+1 FROM payload.institution_members_role WHERE parent_id = $1), $1, $2`,
            [memberId, g.role]
          );
        }
      }

      // user_school_assignments
      await c.query(
        `INSERT INTO user_school_assignments (id, "userId", "schoolId")
         SELECT $1, u.id, $2 FROM users u WHERE u.email = $3
         ON CONFLICT DO NOTHING`,
        [genUUID(), schoolId, g.email]
      );
      created++;
    }
    console.log(`   ✅ Guru TEST_SMA ensured (${guruSMA.length})`);

    await c.query('COMMIT');
    console.log(`\n✅ Seed E2E Tenant B selesai. New records: ${created}`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
