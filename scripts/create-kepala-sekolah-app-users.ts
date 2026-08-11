/**
 * Create kepala sekolah app users so they can log into /login
 * and access institution dashboard.
 *
 * Usage: npx tsx scripts/create-kepala-sekolah-app-users.ts
 */
import { Pool } from 'pg';
import { hash } from 'bcrypt';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const pool = new Pool({ connectionString: DATABASE_URL });
const SALT = 10;
const PASSWORD = 'Password123!';

const KEPALA_SEKOLAH: Array<{
  email: string;
  nama: string;
  nip: string;
  whatsapp: string;
  institutionDomain: string;
  role: string;
}> = [
  { email: 'kepala.sekolah1@mtsbilingual.sch.id', nama: 'Dr. H. Abdul Malik, M.Pd.I', nip: '197501151995031001', whatsapp: '+6281234567890', institutionDomain: 'mtsbilingual.sch.id', role: 'kepala_sekolah' },
  { email: 'kepala.sekolah2@sman3inspirasi.sch.id', nama: 'Dr. Ratna Kumala Dewi, M.Si.', nip: '197208201995022001', whatsapp: '+6281234567891', institutionDomain: 'sman3inspirasi.sch.id', role: 'kepala_sekolah' },
];

async function main() {
  const hashedPassword = await hash(PASSWORD, SALT);
  const created: string[] = [];

  for (const ks of KEPALA_SEKOLAH) {
    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [ks.email]);

    if (existing.rows.length > 0) {
      console.log(`✅ User already exists: ${ks.email} (id: ${existing.rows[0].id})`);
      await pool.query('UPDATE users SET role = $1, phone_verified = true, email_verified = true WHERE id = $2', [ks.role, existing.rows[0].id]);
      created.push(ks.email);
      continue;
    }

    // Create app user
    const userResult = await pool.query(`
      INSERT INTO users (
        email, nama_lengkap, whatsapp, password_hash, role,
        status_langganan, token_limit, quota_poin_total, addon_poin,
        subscription_start, subscription_end, subscription_status, is_active,
        is_seed_data, seed_batch, phone_verified, email_verified
      )
      VALUES ($1, $2, $3, $4, $5, 'trial', 100, 5, 0,
        CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'active', true,
        true, 'manual-testing-kepala', true, true)
      RETURNING id
    `, [ks.email, ks.nama, ks.whatsapp, hashedPassword, ks.role]);

    const userId = userResult.rows[0].id;
    console.log(`✅ Created app user: ${ks.email} (id: ${userId})`);

    // Find institution by domain
    const instRes = await pool.query(`
      SELECT id FROM payload.institutions WHERE name ILIKE '%' || $1 || '%' LIMIT 1
    `, [ks.institutionDomain]);

    if (instRes.rows.length > 0) {
      const institutionId = instRes.rows[0].id;

      // Get or create cms_user for payload
      let cmsUserId: number | null = null;
      const cmsCheck = await pool.query("SELECT id FROM payload.cms_users WHERE email = $1", [ks.email]);
      if (cmsCheck.rows.length > 0) {
        cmsUserId = cmsCheck.rows[0].id;
      }

      // Add to institution_members
      await pool.query(`
        INSERT INTO payload.institution_members (
          user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, [cmsUserId, userId, institutionId]);

      // Add role
      const memberRes = await pool.query(`
        SELECT id FROM public.institution_members WHERE app_user_id = $1 AND institution_id = $2
      `, [userId, institutionId]);

      if (memberRes.rows.length > 0) {
        await pool.query(`
          INSERT INTO payload.institution_members_role ("order", parent_id, value)
          VALUES (1, $1, 'kepala_sekolah')
          ON CONFLICT DO NOTHING
        `, [memberRes.rows[0].id]);
      }

      console.log(`   → Added to institution ${institutionId} as kepala_sekolah`);
    } else {
      console.log(`   ⚠️  Institution not found for domain: ${ks.institutionDomain}`);
    }

    created.push(ks.email);
  }

  console.log(`\n✅ Done! Created ${created.length} kepala sekolah app users`);
  console.log(`Password for all: ${PASSWORD}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
