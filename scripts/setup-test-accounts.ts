/**
 * Setup test accounts - bypass OTP by creating verified users directly
 * Usage: node scripts/setup-test-accounts.ts
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

function phone() {
  const prefixes = ['812', '813', '814', '815', '816', '817', '818', '819'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const n = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return '+628' + p + n;
}

const TEST_USERS = [
  { email: 'DEMO_guru-mandiri@test.gurupro.id', nama: 'Budi Santoso, S.Pd.', role: 'guru', status: 'free', tokenLimit: 5 },
  { email: 'DEMO_guru-instansi@test.gurupro.id', nama: 'Ani Wijaya, M.Pd.', role: 'guru', status: 'active', tokenLimit: 500 },
  { email: 'DEMO_kepala-sekolah@test.gurupro.id', nama: 'Dr. Hasan Basri, M.Si.', role: 'kepala_sekolah', status: 'active', tokenLimit: 500 },
  { email: 'DEMO_wakasek@test.gurupro.id', nama: 'Siti Rahayu, S.Pd.', role: 'wakasek', status: 'active', tokenLimit: 500 },
  { email: 'DEMO_operator@test.gurupro.id', nama: 'Ahmad Dahlan', role: 'operator', status: 'active', tokenLimit: 500 },
  { email: 'DEMO_bendahara@test.gurupro.id', nama: 'Rina Hartati', role: 'bendahara', status: 'active', tokenLimit: 500 },
  { email: 'DEMO_wali-kelas@test.gurupro.id', nama: 'Elisabeth Nur Hidayah, M.Pd.', role: 'guru', status: 'active', tokenLimit: 500 },
  { email: 'DEMO_pembina-ekskul@test.gurupro.id', nama: 'Hendra Wijaya', role: 'guru', status: 'active', tokenLimit: 500 },
];

async function main() {
  await client.connect();
  console.log('Connected to database.');

  const hashedPassword = await bcrypt.hash('test123', 10);
  const results = [];

  for (const u of TEST_USERS) {
    const id = uuid();
    const wa = phone();
    try {
      const res = await client.query(`
        INSERT INTO users (id, email, whatsapp, nama_lengkap, password_hash, role,
          status_langganan, token_limit, phone_verified, email_verified,
          is_active, login_attempts, created_at, referral_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, TRUE, TRUE, 0, NOW(),
          'DEMO-' || $9)
        ON CONFLICT (email) DO UPDATE SET
          nama_lengkap = $4, password_hash = $5, role = $6,
          status_langganan = $7, token_limit = $8,
          phone_verified = TRUE, email_verified = TRUE, is_active = TRUE
        RETURNING id, email, nama_lengkap, role
      `, [id, u.email, wa, u.nama, hashedPassword, u.role, u.status, u.tokenLimit, uuid().substring(0, 6)]);

      const row = res.rows[0];
      console.log('OK: ' + row.nama_lengkap + ' (' + row.role + ') - ' + row.email);
      results.push(row);
    } catch (e) {
      console.error('ERROR creating ' + u.email + ': ' + e.message);
    }
  }

  console.log('\n--- Test Credentials ---');
  console.log('Password for all: test123');
  for (const r of results) {
    console.log('  ' + r.email);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
