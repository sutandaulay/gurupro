/**
 * API Route: /api/dokumen-bukti
 * CRUD for dokumen bukti (piagam, SK, dll)
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { uploadToR2 } from '@/lib/r2'
import { parsePagination, wrapResponse } from '@/lib/pagination'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

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

    let whereClause = 'guru_id = $1'
    const params: (string | null)[] = [guruId]
    let paramIndex = 2

    if (tahunAjaranId) {
      whereClause += ` AND (tahun_ajaran_id = $${paramIndex} OR tahun_ajaran_id IS NULL)`
      params.push(tahunAjaranId)
      paramIndex++
    }

    if (semester) {
      whereClause += ` AND (semester = $${paramIndex} OR semester IS NULL)`
      params.push(semester)
      paramIndex++
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM dokumen_bukti WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const pagination = parsePagination(searchParams);
    const off = (pagination.page - 1) * pagination.limit;

    const result = await query(
      `SELECT * FROM dokumen_bukti WHERE ${whereClause}
       ORDER BY tanggal_dokumen DESC
       LIMIT ${pagination.limit} OFFSET ${off}`,
      params
    )

    return NextResponse.json(wrapResponse(result.rows, total, pagination))
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

    const userDb = await query("SELECT role, status_langganan, subscription_end FROM users WHERE id = $1", [guruId])
    const user = userDb.rows[0]
    const isPro = user?.status_langganan && user.status_langganan !== 'free'
    const isExpired = isPro && user.subscription_end && new Date(user.subscription_end).getTime() < Date.now()

    if (isExpired && user.role !== 'admin') {
      return NextResponse.json({ error: 'Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk menggunakan kapasitas penyimpanan (storage) dan fitur unggah dokumen bukti.' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const kategori = formData.get('kategori') as string
    const judul = formData.get('judul') as string
    const deskripsi = formData.get('deskripsi') as string
    const tanggalDokumen = formData.get('tanggal_dokumen') as string
    const penerbit = formData.get('penerbit') as string
    const indikatorKinerja = formData.get('indikator_kinerja') as string
    const semester = formData.get('semester') as string
    const tahunAjaranId = formData.get('tahun_ajaran_id') as string
    const sekolahId = formData.get('sekolah_id') as string

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

    // Upload file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let fileUrl = ""
    try {
      const r2Url = await uploadToR2(buffer, file.name, file.type)
      if (r2Url) {
        fileUrl = r2Url
      } else {
        const base64 = buffer.toString('base64')
        fileUrl = `data:${file.type};base64,${base64}`
      }
    } catch (err) {
      console.warn("Failed to upload to R2, falling back to base64:", err)
      const base64 = buffer.toString('base64')
      fileUrl = `data:${file.type};base64,${base64}`
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'unknown'

    const result = await query(
      `INSERT INTO dokumen_bukti (
        guru_id, kategori, judul, deskripsi, tanggal_dokumen, penerbit,
        file_url, file_nama, file_tipe, file_ukuran, indikator_kinerja,
        semester, tahun_ajaran_id, sekolah_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        semester || null,
        tahunAjaranId || null,
        sekolahId || null
      ]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error('POST /api/dokumen-bukti error:', err)
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
  }
}

// DELETE /api/dokumen-bukti - Delete document
export async function DELETE(req: Request) {
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
    const guruId = sessionData.id

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })
    }

    const result = await query(
      `DELETE FROM dokumen_bukti WHERE id = $1 AND guru_id = $2 RETURNING *`,
      [id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan atau bukan milik Anda' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Dokumen berhasil dihapus' })
  } catch (err) {
    console.error('DELETE /api/dokumen-bukti error:', err)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}