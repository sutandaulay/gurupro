import { NextResponse } from 'next-response'
import { query } from '@/lib/db'

// =====================================================
// POST — seed demo accounts untuk semua role institusi
// Tanpa auth. Dipanggil manual via curl/Postman.
// =====================================================

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function createAccount(
  email: string,
  password: string,
  namaLengkap: string,
  institutionId: number,
  role: string
) {
  const passwordHash = await hashPassword(password)

  // Cek sudah ada
  const existing = await query(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  )
  if (existing.rows.length > 0) {
    const userId = existing.rows[0].id

    // Cek sudah jadi member
    const memberCheck = await query(
      `SELECT id FROM public.institution_members WHERE app_user_id = $1 AND institution_id = $2`,
      [userId.toString(), institutionId]
    )
    if (memberCheck.rows.length > 0) {
      return { email, status: 'already_member', userId }
    }

    // Tambah ke institution_members
    const insRes = await query(
      `INSERT INTO institution_members (app_user_id, institution_id, status)
       VALUES ($1, $2, 'active') RETURNING id`,
      [userId.toString(), institutionId]
    )
    const memberId = insRes.rows[0].id

    // Insert role
    await query(
      `INSERT INTO institution_members_role (parent_id, value)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [memberId, role]
    )

    return { email, status: 'role_added', userId }
  }

  // Buat user baru
  const userRes = await query(
    `INSERT INTO users (email, password_hash, nama_lengkap, created_at)
     VALUES ($1, $2, $3, NOW()) RETURNING id`,
    [email, passwordHash, namaLengkap]
  )
  const userId = userRes.rows[0].id

  // Buat institution member
  const insRes = await query(
    `INSERT INTO institution_members (app_user_id, institution_id, status)
     VALUES ($1, $2, 'active') RETURNING id`,
    [userId.toString(), institutionId]
  )
  const memberId = insRes.rows[0].id

  // Insert role
  await query(
    `INSERT INTO institution_members_role (parent_id, value)
     VALUES ($1, $2)`,
    [memberId, role]
  )

  return { email, status: 'created', userId }
}

export async function POST(req: Request) {
  try {
    // Basic secret gate — biar gak sembarang orang bisa seed
    const authHeader = req.headers.get('authorization')
    if (authHeader !== 'Bearer seed-secret-123') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const institutionId = body.institutionId || 1

    const accounts = [
      { email: 'ks@demo.test', password: 'Demo123456', nama: 'Dr. Ahmad Wijaya, M.Pd.', role: 'kepala_sekolah' },
      { email: 'wakasek@demo.test', password: 'Demo123456', nama: 'Dra. Siti Nurhaliza', role: 'wakasek' },
      { email: 'operator@demo.test', password: 'Demo123456', nama: 'Budi Santoso', role: 'operator' },
      { email: 'bendahara@demo.test', password: 'Demo123456', nama: 'Hj. Dewi Lestari', role: 'bendahara' },
      { email: 'guru1@demo.test', password: 'Demo123456', nama: 'Prof. Hadi Pranoto, M.Si.', role: 'guru' },
      { email: 'guru2@demo.test', password: 'Demo123456', nama: 'Ibu Ratna Kumala, S.Pd.', role: 'guru' },
      { email: 'wali1@demo.test', password: 'Demo123456', nama: 'Pak Joko Widodo', role: 'guru', subRole: 'wali_kelas', waliKelasOf: 'VII-A' },
      { email: 'ekskul1@demo.test', password: 'Demo123456', nama: 'Ibu Siti Aminah, Or', role: 'guru', subRole: 'pembina_ekskul', ekskulName: 'Pramuka' },
    ]

    const results = []
    for (const acc of accounts) {
      const result = await createAccount(acc.email, acc.password, acc.nama, institutionId, acc.role)

      // Update sub-role kalau ada
      if (acc.subRole && result.status !== 'already_member') {
        const memberRes = await query(
          `SELECT id FROM public.institution_members WHERE app_user_id = $1 AND institution_id = $2`,
          [result.userId.toString(), institutionId]
        )
        if (memberRes.rows.length > 0) {
          await query(
            `UPDATE institution_members SET sub_role = $1, wali_kelas_of = $2, ekskul_name = $3
             WHERE id = $4`,
            [acc.subRole, acc.waliKelasOf || null, acc.ekskulName || null, memberRes.rows[0].id]
          )
        }
      }

      results.push({
        email: acc.email,
        password: acc.password,
        role: acc.role,
        ...result,
      })
    }

    return NextResponse.json({
      ok: true,
      institutionId,
      message: 'Demo accounts seeded successfully',
      accounts: results.map(r => ({
        email: r.email,
        password: r.password,
        role: r.role,
        status: r.status,
      })),
    })
  } catch (err) {
    console.error('Seed error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
