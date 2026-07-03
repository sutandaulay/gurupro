import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

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

    const skpResult = await query(
      `SELECT skp.*, ta.nama as tahun_ajaran_nama
       FROM skp_tahunan skp
       LEFT JOIN tahun_ajaran ta ON ta.id = skp.tahun_ajaran_id
       WHERE skp.id = $1 AND skp.guru_id = $2`,
      [id, guruId]
    )

    if (skpResult.rows.length === 0) {
      return NextResponse.json({ error: 'SKP tidak ditemukan' }, { status: 404 })
    }

    const indikatorResult = await query(
      `SELECT si.*, ik.kode, ik.nama as indikator_nama, ik.komponen, ik.bobot_persen, ik.min_evidence
       FROM skp_indikator si
       JOIN indikator_kinerja_config ik ON ik.id = si.indikator_id
       WHERE si.skp_id = $1
       ORDER BY ik.kode`,
      [id]
    )

    const observasiResult = await query(
      `SELECT id, tanggal_observasi, jenis, status, catatan_observer, rekomendasi
       FROM observasi_kinerja
       WHERE skp_id = $1 AND guru_id = $2
       ORDER BY tanggal_observasi DESC`,
      [id, guruId]
    )

    return NextResponse.json({
      ...skpResult.rows[0],
      indikator_list: indikatorResult.rows,
      observasi: observasiResult.rows,
    })
  } catch (err) {
    console.error('GET /api/skp/[id] error:', err)
    return NextResponse.json({ error: 'Failed to fetch SKP' }, { status: 500 })
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
    const { catatanGuru, indikator, status } = body

    // Update SKP
    const result = await query(
      `UPDATE skp_tahunan SET
        catatan_guru = COALESCE($1, catatan_guru),
        status = COALESCE($2, status),
        updated_at = NOW()
       WHERE id = $3 AND guru_id = $4
       RETURNING *`,
      [catatanGuru ?? null, status || null, id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'SKP tidak ditemukan' }, { status: 404 })
    }

    // Update indicators if provided
    if (indikator && Array.isArray(indikator)) {
      // Delete existing and re-insert
      await query(`DELETE FROM skp_indikator WHERE skp_id = $1`, [id])
      for (const ind of indikator) {
        await query(
          `INSERT INTO skp_indikator (skp_id, indikator_id, target_self)
           VALUES ($1, $2, $3)`,
          [id, ind.indikatorId, ind.targetSelf || 0]
        )
      }
    }

    const indikatorResult = await query(
      `SELECT si.*, ik.kode, ik.nama as indikator_nama, ik.komponen, ik.bobot_persen, ik.min_evidence
       FROM skp_indikator si
       JOIN indikator_kinerja_config ik ON ik.id = si.indikator_id
       WHERE si.skp_id = $1
       ORDER BY ik.kode`,
      [id]
    )

    return NextResponse.json({
      ...result.rows[0],
      indikator_list: indikatorResult.rows,
    })
  } catch (err) {
    console.error('PUT /api/skp/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update SKP' }, { status: 500 })
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

    const result = await query(
      `DELETE FROM skp_tahunan WHERE id = $1 AND guru_id = $2 RETURNING id`,
      [id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'SKP tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ message: 'SKP berhasil dihapus' })
  } catch (err) {
    console.error('DELETE /api/skp/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete SKP' }, { status: 500 })
  }
}
