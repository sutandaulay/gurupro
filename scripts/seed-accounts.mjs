// Standalone migration + seed script
// Run: node scripts/seed-accounts.mjs

async function query(sql, params = []) {
  const { Client } = await import('pg')
  const client = new Client({
    user: 'postgres',
    password: 'nus4nt4r4',
    host: 'localhost',
    database: 'gurupro_db',
    port: 5432,
  })
  try {
    await client.connect()
    const res = await client.query(sql, params)
    return res
  } finally {
    await client.end()
  }
}

async function hashPassword(password) {
  const bcrypt = await import('bcrypt')
  return bcrypt.hash(password, 10)
}

const INSTITUTION_ID = parseInt(process.argv[2]) || 1
const SEED_ALL = process.argv.includes('--all')

async function migrateAndSeed() {
  console.log('Step 1: Create institutions table...')
  await query(`
    CREATE TABLE IF NOT EXISTS institutions (
      id SERIAL PRIMARY KEY,
      school_id UUID NOT NULL,
      name VARCHAR(255),
      npsn VARCHAR(50),
      jenjang VARCHAR(100),
      naungan VARCHAR(255),
      subscription_tier VARCHAR(50) DEFAULT 'free',
      academic_year_active VARCHAR(20),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(school_id)
    )
  `)
  console.log('  institutions table created')

  console.log('Step 2: Create institution_members table...')
  await query(`
    CREATE TABLE IF NOT EXISTS institution_members (
      id SERIAL PRIMARY KEY,
      app_user_id VARCHAR(255) NOT NULL,
      institution_id INTEGER NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      sub_role VARCHAR(50),
      wali_kelas_of VARCHAR(100),
      ekskul_name VARCHAR(200),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(app_user_id, institution_id)
    )
  `)
  console.log('  institution_members table created')

  console.log('Step 3: Create institution_members_role table...')
  await query(`
    CREATE TABLE IF NOT EXISTS institution_members_role (
      id SERIAL PRIMARY KEY,
      parent_id INTEGER NOT NULL REFERENCES institution_members(id) ON DELETE CASCADE,
      value VARCHAR(50) NOT NULL,
      UNIQUE(parent_id, value)
    )
  `)
  console.log('  institution_members_role table created')

  console.log('Step 4: Create indexes...')
  await query(`CREATE INDEX IF NOT EXISTS idx_institution_members_institution ON institution_members(institution_id)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_institution_members_app_user ON institution_members(app_user_id)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_institution_members_role_parent ON institution_members_role(parent_id)`)
  console.log('  indexes created')

  // Step 5: Get institutions to seed
  let institutionsToSeed = []
  if (SEED_ALL) {
    const instRes = await query(`SELECT id, name FROM institutions ORDER BY id`)
    institutionsToSeed = instRes.rows
    console.log(`\n--all mode: will seed ${institutionsToSeed.length} institutions`)
  } else {
    const instRes = await query(`SELECT id, name FROM institutions WHERE id = $1`, [INSTITUTION_ID])
    if (instRes.rows.length > 0) institutionsToSeed = instRes.rows
  }

  // Step 6: Seed demo accounts for each institution
  console.log('\nStep 6: Seed demo accounts...')
  const ACCOUNTS = [
    { email: 'ks@demo.test', password: 'Demo123456', nama: 'Dr. Ahmad Wijaya, M.Pd.', role: 'kepala_sekolah' },
    { email: 'wakasek@demo.test', password: 'Demo123456', nama: 'Dra. Siti Nurhaliza', role: 'wakasek' },
    { email: 'operator@demo.test', password: 'Demo123456', nama: 'Budi Santoso', role: 'operator' },
    { email: 'bendahara@demo.test', password: 'Demo123456', nama: 'Hj. Dewi Lestari', role: 'bendahara' },
    { email: 'guru1@demo.test', password: 'Demo123456', nama: 'Prof. Hadi Pranoto, M.Si.', role: 'guru' },
    { email: 'guru2@demo.test', password: 'Demo123456', nama: 'Ibu Ratna Kumala, S.Pd.', role: 'guru' },
    { email: 'wali1@demo.test', password: 'Demo123456', nama: 'Pak Joko Widodo', role: 'guru', sub_role: 'wali_kelas', wali_kelas_of: 'VII-A' },
    { email: 'ekskul1@demo.test', password: 'Demo123456', nama: 'Ibu Siti Aminah, Or', role: 'guru', sub_role: 'pembina_ekskul', ekskul_name: 'Pramuka' },
  ]

  for (const inst of institutionsToSeed) {
    console.log(`\n  Seeding institution ${inst.id}: ${inst.name}`)

    for (const acc of ACCOUNTS) {
      const passwordHash = await hashPassword(acc.password)

      // Check user
      let userRes = await query('SELECT id::text FROM users WHERE email = $1', [acc.email])
      let userId

      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id
        await query(
          `UPDATE users SET password_hash = $1, phone_verified = true, email_verified = true WHERE id = $2`,
          [passwordHash, userId]
        )
        console.log(`    [updated] ${acc.email}`)
      } else {
        const wa = `+6281${Math.floor(Math.random() * 900000000 + 100000000)}`
        userRes = await query(
          `INSERT INTO users (email, password_hash, nama_lengkap, whatsapp, phone_verified, email_verified, created_at)
           VALUES ($1, $2, $3, $4, true, true, NOW()) RETURNING id::text`,
          [acc.email, passwordHash, acc.nama, wa]
        )
        userId = userRes.rows[0].id
        console.log(`    [created] ${acc.email}`)
      }

      // Add to institution_members
      const memberRes = await query(
        `INSERT INTO institution_members (app_user_id, institution_id, status, sub_role, wali_kelas_of, ekskul_name)
         VALUES ($1, $2, 'active', $3, $4, $5)
         ON CONFLICT (app_user_id, institution_id) DO UPDATE SET sub_role=$3, wali_kelas_of=$4, ekskul_name=$5
         RETURNING id`,
        [userId, inst.id, acc.sub_role || null, acc.wali_kelas_of || null, acc.ekskul_name || null]
      )
      const memberId = memberRes.rows[0].id

      await query(
        `INSERT INTO institution_members_role (parent_id, value)
         VALUES ($1, $2)
         ON CONFLICT (parent_id, value) DO NOTHING`,
        [memberId, acc.role]
      )
    }
  }

  // Step 7: Migrate existing user_school_assignments users
  console.log('\nStep 7: Migrate existing users from user_school_assignments...')
  for (const inst of institutionsToSeed) {
    const existingAssignments = await query(`
      SELECT DISTINCT usa."userId"::text as user_id, u.email, u.nama_lengkap
      FROM user_school_assignments usa
      JOIN users u ON u.id = usa."userId"
      WHERE usa."schoolId" IN (SELECT school_id FROM institutions WHERE id = $1)
    `, [inst.id])

    for (const row of existingAssignments.rows) {
      const memberRes = await query(
        `INSERT INTO institution_members (app_user_id, institution_id, status)
         VALUES ($1, $2, 'active')
         ON CONFLICT (app_user_id, institution_id) DO NOTHING
         RETURNING id`,
        [row.user_id, inst.id]
      )
      if (memberRes.rows.length > 0) {
        const memberId = memberRes.rows[0].id
        await query(
          `INSERT INTO institution_members_role (parent_id, value)
           VALUES ($1, 'guru')
           ON CONFLICT (parent_id, value) DO NOTHING`,
          [memberId]
        )
        if (row.email) console.log(`  migrated: ${row.email} -> inst ${inst.id}`)
      }
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('ALL DONE! Demo accounts (same for all institutions):')
  for (const acc of ACCOUNTS) {
    console.log(`  ${acc.role.padEnd(18)} ${acc.email.padEnd(28)} ${acc.password}`)
  }
  console.log('═'.repeat(60))
  if (SEED_ALL) {
    for (const inst of institutionsToSeed) {
      console.log(`\n🔗 URL CANONICAL: http://localhost:3000/institusi/${inst.id}/dashboard`)
    }
  } else {
    console.log(`\n🔗 URL CANONICAL: http://localhost:3000/institusi/${INSTITUTION_ID}/dashboard`)
  }
  console.log(`   Menu utama: wakasek | operator | bendahara | guru`)
  console.log(`   Laporan:   aktivitas | tpg | langganan | pengaturan`)
}

migrateAndSeed().catch(err => {
  console.error('\nError:', err.message)
  process.exit(1)
})
