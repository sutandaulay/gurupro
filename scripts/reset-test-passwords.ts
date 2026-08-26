/**
 * Reset test account passwords to a known value.
 * Run: npx tsx scripts/reset-test-passwords.ts
 */
import { hash } from 'bcrypt';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const pool = new Pool({ connectionString: DATABASE_URL });

const PASSWORD = 'GuruPRO123!';

async function main() {
  const hashed = await hash(PASSWORD, 10);

  const accounts = [
    { email: 'guru1@sekolahmandiri.sch.id', label: 'Guru Mandiri (individual)' },
    { email: 'guru2@sekolahmandiri.sch.id', label: 'Guru Mandiri #2' },
    { email: 'guru3@mtsnurulimmi.sch.id', label: 'Guru Mandiri #3' },
    { email: 'guru4@smaplusmadani.sch.id', label: 'Guru Mandiri #4' },
    { email: 'guru5@tunasbangsa.sch.id', label: 'Guru Mandiri #5' },
    { email: 'guru1@demo.test', label: 'Guru Institusi' },
    { email: 'guru2@demo.test', label: 'Guru Institusi #2' },
    { email: 'wali1@demo.test', label: 'Guru Institusi + Wali Kelas' },
    { email: 'ekskul1@demo.test', label: 'Guru Institusi + Ekskul' },
    { email: 'bendahara@demo.test', label: 'Bendahara Institusi' },
    { email: 'wakasek@demo.test', label: 'Wakasek Institusi' },
    { email: 'operator@demo.test', label: 'Operator Institusi' },
    { email: 'ks@demo.test', label: 'Kepala Sekolah' },
    { email: 'kepala.sekolah1@mtsbilingual.sch.id', label: 'Kepala Sekolah #1' },
    { email: 'kepala.sekolah2@sman3inspirasi.sch.id', label: 'Kepala Sekolah #2' },
    { email: 'andrieran@gmail.com', label: 'Guru Mandiri (andrieran)' },
  ];

  for (const acc of accounts) {
    const res = await pool.query(
      `UPDATE public.users SET password_hash = $1, email_verified = true, phone_verified = true WHERE email = $2 RETURNING id`,
      [hashed, acc.email]
    );
    if (res.rowCount && res.rowCount > 0) {
      console.log(`✅ ${acc.label} (${acc.email})`);
    } else {
      console.log(`⚠️  Not found: ${acc.email}`);
    }
  }

  console.log(`\nPassword for all: ${PASSWORD}`);
  await pool.end();
}

main().catch(console.error);
