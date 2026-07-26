/**
 * API Route: /api/tahun-ajaran
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSchoolAccess } from '@/lib/school-access'

// Helper: get user ID dari cookie (untuk POST)
function getUserId(cookieHeader: string): string | null {
  try {
    const cookies = cookieHeader.split(';').map(c => c.trim())
    const session = cookies.find(c => c.startsWith('gurupro_session='))
    if (!session) return null
    const value = session.split('=')[1] || ''
    const data = JSON.parse(decodeURIComponent(value))
    return data.id || null
  } catch {
    return null
  }
}

// GET list — wajib sekolah_id
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const schoolId = searchParams.get('school_id') || searchParams.get('sekolah_id')

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id wajib diisi' }, { status: 400 })
    }

    await requireSchoolAccess(schoolId)

    // Check table exists
    const check = await query(
      "SELECT to_regclass('public.tahun_ajaran') as tbl"
    ).catch(() => null)

    if (!check) {
      return NextResponse.json({ error: 'Table tahun_ajaran tidak ada. Jalankan migration SQL dulu.' }, { status: 500 })
    }

    const result = await query(
      `SELECT id, nama, tanggal_mulai, tanggal_selesai, is_active, semester_type, semester, sekolah_id, created_at
       FROM tahun_ajaran
       WHERE sekolah_id = $1
        ORDER BY tanggal_mulai DESC`,
      [schoolId]
    )

    return NextResponse.json(result.rows)
  } catch (err: any) {
    const status = err.message === "Forbidden" ? 403 : err.message === "Unauthorized" ? 401 : 500
    console.error('GET /api/tahun-ajaran:', err?.message)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status })
  }
}

// POST create
export async function POST(req: Request) {
  try {
    const userId = getUserId(req.headers.get('cookie') || '')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const nama = (body.nama || '').trim()
    const tanggalMulai = (body.tanggalMulai || '').trim()
    const tanggalSelesai = (body.tanggalSelesai || '').trim()
    const sekolahId = (body.sekolahId || '').trim()

    if (!nama || !tanggalMulai || !tanggalSelesai || !sekolahId) {
      return NextResponse.json(
        { error: 'Nama, tanggal mulai, tanggal selesai, dan sekolah_id wajib diisi' },
        { status: 400 }
      )
    }

    await requireSchoolAccess(sekolahId)

    const result = await query(
      `INSERT INTO tahun_ajaran (nama, tanggal_mulai, tanggal_selesai, semester_type, semester, sekolah_id, created_by)
      VALUES ($1, $2, $3, 'full', $4, $5, $6)
      RETURNING *`,
      [nama, tanggalMulai, tanggalSelesai, 'ganjil', sekolahId, userId]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err: any) {
    console.error('POST /api/tahun-ajaran:', err?.message)
    return NextResponse.json(
      { error: err?.message || 'Server error' },
      { status: 500 }
    )
  }
}
