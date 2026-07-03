/**
 * API Route: /api/pelatihan
 * CRUD operations for pelatihan/pengembangan diri
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { logPelatihanEvidence, getSemesterFromDate } from '@/lib/evidence/logger'

// GET /api/pelatihan - List all pelatihan for current user
export async function GET(req: Request) {
  try {
    // Get session from cookie
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

    let sql = `
      SELECT id, guru_id, tahun_ajaran_id, semester, nama_pelatihan, penyelenggara,
             jenis, lingkup, tanggal_mulai, tanggal_selesai, durasi_jam,
             nomor_sertifikat, deskripsi, relevansi_mapel, kompetensi_dikembangkan,
             file_sertifikat_url, file_sertifikat_nama, status_verifikasi,
             created_at, updated_at
      FROM pelatihan_guru
      WHERE guru_id = $1
    `
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

    sql += ` ORDER BY tanggal_mulai DESC`

    const result = await query(sql, params)

    // Get totals
    const totalResult = await query(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(durasi_jam), 0) as total_jam,
        COUNT(*) FILTER (WHERE status_verifikasi = 'belum_upload') as belum_sertifikat
      FROM pelatihan_guru
      WHERE guru_id = $1 ${tahunAjaranId ? 'AND tahun_ajaran_id = $2' : ''} ${semester ? `AND semester = '${semester}'` : ''}`,
      tahunAjaranId ? [guruId, tahunAjaranId] : [guruId]
    )

    const stats = totalResult.rows[0]

    return NextResponse.json({
      data: result.rows,
      stats: {
        total: parseInt(stats.total),
        total_jam: parseInt(stats.total_jam),
        belum_sertifikat: parseInt(stats.belum_sertifikat),
      },
    })
  } catch (err) {
    console.error('GET /api/pelatihan error:', err)
    return NextResponse.json({ error: 'Failed to fetch pelatihan' }, { status: 500 })
  }
}

// POST /api/pelatihan - Create new pelatihan
export async function POST(req: Request) {
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
    const guruId = sessionData.id

    const body = await req.json()
    const {
      tahunAjaranId,
      semester,
      namaPelatihan,
      penyelenggara,
      jenis,
      lingkup,
      tanggalMulai,
      tanggalSelesai,
      durasiJam,
      nomorSertifikat,
      deskripsi,
      relevansiMapel,
      kompetensiDikembangkan,
    } = body

    // Validate required fields
    if (!namaPelatihan || !penyelenggara || !jenis || !lingkup || !tanggalMulai || !tanggalSelesai || !durasiJam) {
      return NextResponse.json({ error: 'Field wajib belum diisi' }, { status: 400 })
    }

    // Determine semester from date if not provided
    const startDate = new Date(tanggalMulai)
    const semesterAuto = semester || getSemesterFromDate(startDate)

    const result = await query(
      `INSERT INTO pelatihan_guru (
        guru_id, tahun_ajaran_id, semester, nama_pelatihan, penyelenggara,
        jenis, lingkup, tanggal_mulai, tanggal_selesai, durasi_jam,
        nomor_sertifikat, deskripsi, relevansi_mapel, kompetensi_dikembangkan,
        status_verifikasi
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        guruId,
        tahunAjaranId || null,
        semesterAuto,
        namaPelatihan,
        penyelenggara,
        jenis,
        lingkup,
        tanggalMulai,
        tanggalSelesai,
        durasiJam,
        nomorSertifikat || null,
        deskripsi || null,
        relevansiMapel ?? true,
        kompetensiDikembangkan || [],
        'belum_upload',
      ]
    )

    const pelatihan = result.rows[0]

    // Log evidence
    await logPelatihanEvidence({
      guruId,
      tahunAjaranId: tahunAjaranId || '',
      semester: semesterAuto as 'ganjil' | 'genap',
      pelatihanId: pelatihan.id,
      namaPelatihan,
      penyelenggara,
      jenis,
      lingkup,
      durasiJam,
      tanggalMulai: startDate,
      kompetensi: kompetensiDikembangkan || [],
      adaSertifikat: false,
    })

    return NextResponse.json(pelatihan, { status: 201 })
  } catch (err) {
    console.error('POST /api/pelatihan error:', err)
    return NextResponse.json({ error: 'Failed to create pelatihan' }, { status: 500 })
  }
}
