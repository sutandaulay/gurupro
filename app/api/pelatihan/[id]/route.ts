/**
 * API Route: /api/pelatihan/[id]
 * Get, Update, Delete single pelatihan
 */

import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
    const guruId = sessionData.id

    const { query } = await import('@/lib/db')
    const result = await query(
      `SELECT * FROM pelatihan_guru WHERE id = $1 AND guru_id = $2`,
      [id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Pelatihan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('GET /api/pelatihan/[id] error:', err)
    return NextResponse.json({ error: 'Failed to fetch pelatihan' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
    const guruId = sessionData.id

    const body = await req.json()
    const { query } = await import('@/lib/db')

    const result = await query(
      `UPDATE pelatihan_guru SET
        nama_pelatihan = COALESCE($1, nama_pelatihan),
        penyelenggara = COALESCE($2, penyelenggara),
        jenis = COALESCE($3, jenis),
        lingkup = COALESCE($4, lingkup),
        tanggal_mulai = COALESCE($5, tanggal_mulai),
        tanggal_selesai = COALESCE($6, tanggal_selesai),
        durasi_jam = COALESCE($7, durasi_jam),
        nomor_sertifikat = COALESCE($8, nomor_sertifikat),
        deskripsi = COALESCE($9, deskripsi),
        relevansi_mapel = COALESCE($10, relevansi_mapel),
        kompetensi_dikembangkan = COALESCE($11, kompetensi_dikembangkan),
        updated_at = NOW()
      WHERE id = $12 AND guru_id = $13
      RETURNING *`,
      [
        body.namaPelatihan,
        body.penyelenggara,
        body.jenis,
        body.lingkup,
        body.tanggalMulai,
        body.tanggalSelesai,
        body.durasiJam,
        body.nomorSertifikat,
        body.deskripsi,
        body.relevansiMapel,
        body.kompetensiDikembangkan,
        id,
        guruId,
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Pelatihan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('PUT /api/pelatihan/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update pelatihan' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
    const guruId = sessionData.id

    const { query } = await import('@/lib/db')
    const result = await query(
      `DELETE FROM pelatihan_guru WHERE id = $1 AND guru_id = $2 RETURNING id`,
      [id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Pelatihan tidak ditemukan' }, { status: 404 })
    }

    await query(
      `DELETE FROM evidence_log
       WHERE referensi_id = $1 AND referensi_tabel = 'pelatihan_guru'
       AND guru_id = $2`,
      [id, guruId]
    )

    return NextResponse.json({ message: 'Pelatihan berhasil dihapus' })
  } catch (err) {
    console.error('DELETE /api/pelatihan/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete pelatihan' }, { status: 500 })
  }
}
