import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

async function getObservasiWithRatings(observasiId: string, guruId: string) {
  const obsResult = await query(
    `SELECT ok.*, u.nama_lengkap as observer_nama
     FROM observasi_kinerja ok
     LEFT JOIN users u ON u.id = ok.observer_id
     WHERE ok.id = $1 AND ok.guru_id = $2`,
    [observasiId, guruId]
  )

  if (obsResult.rows.length === 0) return null

  const ratingResult = await query(
    `SELECT oi.*, ik.kode, ik.nama as indikator_nama, ik.komponen
     FROM observasi_indikator oi
     JOIN indikator_kinerja_config ik ON ik.id = oi.indikator_id
     WHERE oi.observasi_id = $1
     ORDER BY ik.kode`,
    [observasiId]
  )

  return {
    ...obsResult.rows[0],
    indikator_ratings: ratingResult.rows,
  }
}

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

    const result = await getObservasiWithRatings(id, guruId)

    if (!result) {
      return NextResponse.json({ error: 'Observasi tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/observasi/[id] error:', err)
    return NextResponse.json({ error: 'Failed to fetch observasi' }, { status: 500 })
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
    const { suasanaPembelajaran, catatanObserver, rekomendasi, indikator, status } = body

    const result = await query(
      `UPDATE observasi_kinerja SET
        suasana_pembelajaran = COALESCE($1, suasana_pembelajaran),
        catatan_observer = COALESCE($2, catatan_observer),
        rekomendasi = COALESCE($3, rekomendasi),
        status = COALESCE($4, status),
        updated_at = NOW()
       WHERE id = $5 AND guru_id = $6
       RETURNING *`,
      [suasanaPembelajaran ?? null, catatanObserver ?? null, rekomendasi ?? null, status || null, id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Observasi tidak ditemukan' }, { status: 404 })
    }

    // Update ratings if provided
    if (indikator && Array.isArray(indikator)) {
      for (const ind of indikator) {
        await query(
          `INSERT INTO observasi_indikator (observasi_id, indikator_id, rating, catatan, bukti_observasi)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (observasi_id, indikator_id)
           DO UPDATE SET rating = $3, catatan = COALESCE($4, observasi_indikator.catatan), bukti_observasi = COALESCE($5, observasi_indikator.bukti_observasi)`,
          [id, ind.indikatorId, ind.rating, ind.catatan || null, ind.buktiObservasi || null]
        )
      }
    }

    const fullResult = await getObservasiWithRatings(id, guruId)

    return NextResponse.json(fullResult)
  } catch (err) {
    console.error('PUT /api/observasi/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update observasi' }, { status: 500 })
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
      `DELETE FROM observasi_kinerja WHERE id = $1 AND guru_id = $2 RETURNING id`,
      [id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Observasi tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Observasi berhasil dihapus' })
  } catch (err) {
    console.error('DELETE /api/observasi/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete observasi' }, { status: 500 })
  }
}
