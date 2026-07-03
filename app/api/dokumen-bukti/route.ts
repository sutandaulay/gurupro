/**
 * API Route: /api/dokumen-bukti
 * CRUD for dokumen bukti (piagam, SK, dll)
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// GET /api/dokumen-bukti - List documents
export async function GET(req: Request) {
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
    const guruId = sessionData.id

    const { searchParams } = new URL(req.url)
    const tahunAjaranId = searchParams.get('tahun_ajaran_id')
    const semester = searchParams.get('semester')

    let sql = `SELECT * FROM dokumen_bukti WHERE guru_id = $1`
    const params: (string | null)[] = [guruId]
    let paramIndex = 2

    if (tahunAjaranId) {
      sql += ` AND tahun_ajaran_id = $${paramIndex}`
      params.push(tahunAjaranId)
      paramIndex++
    }

    if (semester) {
      sql += ` AND semester = $${paramIndex}`
      params.push(semester)
      paramIndex++
    }

    sql += ` ORDER BY tanggal_dokumen DESC`

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/dokumen-bukti error:', err)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

// POST /api/dokumen-bukti - Upload document
export async function POST(req: Request) {
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
    const guruId = sessionData.id

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const kategori = formData.get('kategori') as string
    const judul = formData.get('judul') as string
    const deskripsi = formData.get('deskripsi') as string
    const tanggalDokumen = formData.get('tanggal_dokumen') as string
    const penerbit = formData.get('penerbit') as string
    const indikatorKinerja = formData.get('indikator_kinerja') as string

    if (!file || !kategori || !judul) {
      return NextResponse.json({ error: 'Field wajib belum diisi' }, { status: 400 })
    }

    // Validate file
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format file tidak didukung' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 })
    }

    // Upload file (base64 for now)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const fileUrl = `data:${file.type};base64,${base64}`

    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'unknown'

    const result = await query(
      `INSERT INTO dokumen_bukti (
        guru_id, kategori, judul, deskripsi, tanggal_dokumen, penerbit,
        file_url, file_nama, file_tipe, file_ukuran, indikator_kinerja
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        guruId,
        kategori,
        judul,
        deskripsi || null,
        tanggalDokumen || null,
        penerbit || null,
        fileUrl,
        file.name,
        fileExtension,
        file.size,
        indikatorKinerja ? JSON.parse(indikatorKinerja) : [],
      ]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error('POST /api/dokumen-bukti error:', err)
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
  }
}