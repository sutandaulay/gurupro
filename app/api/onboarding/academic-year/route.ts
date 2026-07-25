import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { pool } from '@/lib/db'

async function getUserId() {
  const cookieStore = await cookies()
  const rawSession = cookieStore.get('gurupro_session')?.value
  if (!rawSession) throw new Error('Unauthorized')
  const session = JSON.parse(rawSession)
  if (!session?.id) throw new Error('Unauthorized')
  return session.id as string
}

// Pengguna lama dengan sekolah yang telah ada tetap lolos jika menggunakan TA global lama.
async function getActiveTahunAjaran(userId: string) {
  const result = await pool.query(
    `SELECT ta.id, ta.nama, ta.semester, ta.sekolah_id
       FROM tahun_ajaran ta
      WHERE ta.is_active = true
        AND (
          ta.created_by = $1
          OR ta.created_by IS NULL
          OR EXISTS (
            SELECT 1 FROM user_school_assignments usa
            WHERE usa."userId" = $1
          )
        )
      ORDER BY ta.created_at DESC NULLS LAST
      LIMIT 1`,
    [userId]
  )
  return result.rows[0] ?? null
}

export async function GET() {
  try {
    const userId = await getUserId()
    const activeTahunAjaran = await getActiveTahunAjaran(userId)
    return NextResponse.json({ hasActiveTahunAjaran: Boolean(activeTahunAjaran), activeTahunAjaran })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memeriksa tahun ajaran' }, { status: error.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(req: Request) {
  const client = await pool.connect()
  try {
    const userId = await getUserId()
    const body = await req.json().catch(() => ({}))
    const nama = String(body.nama || '').trim()
    const tanggalMulai = String(body.tanggalMulai || '').trim()
    const tanggalSelesai = String(body.tanggalSelesai || '').trim()
    const semester = body.semester === 'genap' ? 'genap' : 'ganjil'

    if (!nama || !tanggalMulai || !tanggalSelesai || Number.isNaN(Date.parse(tanggalMulai)) || Number.isNaN(Date.parse(tanggalSelesai))) {
      return NextResponse.json({ error: 'Nama serta tanggal mulai dan selesai tahun ajaran wajib diisi.' }, { status: 400 })
    }
    if (new Date(tanggalMulai).getTime() >= new Date(tanggalSelesai).getTime()) {
      return NextResponse.json({ error: 'Tanggal selesai harus setelah tanggal mulai.' }, { status: 400 })
    }

    await client.query('BEGIN')
    // TA onboarding bersifat personal/global sampai pengguna membuat atau memilih sekolah.
    await client.query('UPDATE tahun_ajaran SET is_active = false WHERE created_by = $1 AND sekolah_id IS NULL', [userId])
    const result = await client.query(
      `INSERT INTO tahun_ajaran (nama, tanggal_mulai, tanggal_selesai, is_active, semester_type, semester, sekolah_id, created_by)
       VALUES ($1, $2, $3, true, 'full', $4, NULL, $5)
       RETURNING id, nama, semester, sekolah_id, is_active`,
      [nama, tanggalMulai, tanggalSelesai, semester, userId]
    )
    await client.query('COMMIT')
    return NextResponse.json({ activeTahunAjaran: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => undefined)
    return NextResponse.json({ error: error.message || 'Gagal menyiapkan tahun ajaran' }, { status: error.message === 'Unauthorized' ? 401 : 500 })
  } finally {
    client.release()
  }
}
