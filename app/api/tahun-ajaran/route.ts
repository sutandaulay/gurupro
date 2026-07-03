/**
 * API Route: /api/tahun-ajaran
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Helper: get user ID dari cookie
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

// GET list
export async function GET(req: Request) {
  try {
    const userId = getUserId(req.headers.get('cookie') || '')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check table exists
    const check = await query(
      "SELECT to_regclass('public.tahun_ajaran') as tbl"
    ).catch(() => null)

    if (!check) {
      return NextResponse.json({ error: 'Table tahun_ajaran tidak ada. Jalankan migration SQL dulu.' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const sekolahId = searchParams.get('sekolah_id')

    let taQuery = `SELECT id, nama, tanggal_mulai, tanggal_selesai, is_active, semester_type, semester, sekolah_id, created_at
             FROM tahun_ajaran`
    const params: any[] = []

    if (sekolahId) {
      taQuery += ` WHERE sekolah_id = $1`
      params.push(sekolahId)
    }

    taQuery += ` ORDER BY tanggal_mulai DESC`

    const result = await query(taQuery, params)

    return NextResponse.json(result.rows)
  } catch (err: any) {
    console.error('GET /api/tahun-ajaran:', err?.message)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
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

    if (!nama || !tanggalMulai || !tanggalSelesai) {
      return NextResponse.json(
        { error: 'Nama, tanggal mulai, tanggal selesai wajib diisi' },
        { status: 400 }
      )
    }

    const result = await query(
      `INSERT INTO tahun_ajaran (nama, tanggal_mulai, tanggal_selesai, semester_type, semester, sekolah_id, created_by)
      VALUES ($1, $2, $3, 'full', $4, $5, $6)
      RETURNING *`,
      [nama, tanggalMulai, tanggalSelesai, 'ganjil', sekolahId || null, userId]
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
