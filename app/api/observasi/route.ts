import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

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
    const skpId = searchParams.get('skp_id')
    const tahunAjaranId = searchParams.get('tahun_ajaran_id')
    const sekolahId = searchParams.get('sekolah_id')

    let queryStr = `
      SELECT ok.*, u.nama_lengkap as observer_nama,
             skp.status as skp_status
      FROM observasi_kinerja ok
      LEFT JOIN users u ON u.id = ok.observer_id
      LEFT JOIN skp_tahunan skp ON skp.id = ok.skp_id
      WHERE ok.guru_id = $1
    `
    const params: any[] = [guruId]
    let paramIdx = 2

    if (skpId) {
      queryStr += ` AND ok.skp_id = $${paramIdx++}`
      params.push(skpId)
    } else if (tahunAjaranId) {
      queryStr += ` AND ok.tahun_ajaran_id = $${paramIdx++}`
      params.push(tahunAjaranId)
    }
    if (sekolahId) {
      queryStr += ` AND ok.sekolah_id = $${paramIdx++}`
      params.push(sekolahId)
    }

    queryStr += ` ORDER BY ok.tanggal_observasi DESC`

    const result = await query(queryStr, params)

    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/observasi error:', err)
    return NextResponse.json({ error: 'Failed to fetch observasi' }, { status: 500 })
  }
}

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
    const { skpId, tahunAjaranId, tanggalObservasi, jenis, suasanaPembelajaran, catatanObserver, rekomendasi, indikator, sekolahId } = body

    if (!tahunAjaranId || !tanggalObservasi) {
      return NextResponse.json({ error: 'tahun_ajaran_id dan tanggal_observasi wajib diisi' }, { status: 400 })
    }

    // Create observasi
    const obsResult = await query(
      `INSERT INTO observasi_kinerja (guru_id, skp_id, observer_id, tahun_ajaran_id, tanggal_observasi, jenis, suasana_pembelajaran, catatan_observer, rekomendasi, status, sekolah_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10)
       RETURNING *`,
      [
        guruId,
        skpId || null,
        sessionData.id,
        tahunAjaranId,
        tanggalObservasi,
        jenis || 'kelas',
        suasanaPembelajaran || null,
        catatanObserver || null,
        rekomendasi || null,
        sekolahId || null,
      ]
    )

    const observasiId = obsResult.rows[0].id

    // Insert indikator ratings
    if (indikator && Array.isArray(indikator)) {
      for (const ind of indikator) {
        await query(
          `INSERT INTO observasi_indikator (observasi_id, indikator_id, rating, catatan, bukti_observasi)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            observasiId,
            ind.indikatorId,
            ind.rating,
            ind.catatan || null,
            ind.buktiObservasi || null,
          ]
        )
      }
    }

    // Return full observasi with ratings
    const fullResult = await getObservasiWithRatings(observasiId, guruId)

    return NextResponse.json(fullResult, { status: 201 })
  } catch (err) {
    console.error('POST /api/observasi error:', err)
    return NextResponse.json({ error: 'Failed to create observasi' }, { status: 500 })
  }
}

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
