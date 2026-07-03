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
    const tahunAjaranId = searchParams.get('tahun_ajaran_id')
    const sekolahId = searchParams.get('sekolah_id')

    let queryStr = `SELECT skp.*, ta.nama as tahun_ajaran_nama
             FROM skp_tahunan skp
             LEFT JOIN tahun_ajaran ta ON ta.id = skp.tahun_ajaran_id
             WHERE skp.guru_id = $1`
    const params: any[] = [guruId]
    let paramIdx = 2

    if (tahunAjaranId) {
      queryStr += ` AND skp.tahun_ajaran_id = $${paramIdx++}`
      params.push(tahunAjaranId)
    }
    if (sekolahId) {
      queryStr += ` AND skp.sekolah_id = $${paramIdx++}`
      params.push(sekolahId)
    }

    queryStr += ` ORDER BY skp.created_at DESC`

    const result = await query(queryStr, params)

    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/skp error:', err)
    return NextResponse.json({ error: 'Failed to fetch SKP' }, { status: 500 })
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
    const { tahunAjaranId, indikator, catatanGuru, sekolahId } = body

    if (!tahunAjaranId || !indikator || !Array.isArray(indikator) || indikator.length === 0) {
      return NextResponse.json({ error: 'tahun_ajaran_id dan indikator wajib diisi' }, { status: 400 })
    }

    // Check existing SKP
    let checkQuery = `SELECT id FROM skp_tahunan WHERE guru_id = $1 AND tahun_ajaran_id = $2`
    const checkParams: any[] = [guruId, tahunAjaranId]
    if (sekolahId) {
      checkQuery += ` AND sekolah_id = $3`
      checkParams.push(sekolahId)
    }

    const existing = await query(checkQuery, checkParams)

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'SKP untuk tahun ajaran ini sudah ada' }, { status: 409 })
    }

    // Create SKP
    const skpResult = await query(
      `INSERT INTO skp_tahunan (guru_id, tahun_ajaran_id, catatan_guru, status, sekolah_id)
       VALUES ($1, $2, $3, 'draft', $4)
       RETURNING *`,
      [guruId, tahunAjaranId, catatanGuru || null, sekolahId || null]
    )

    const skpId = skpResult.rows[0].id

    // Insert indicators
    for (const ind of indikator) {
      await query(
        `INSERT INTO skp_indikator (skp_id, indikator_id, target_self)
         VALUES ($1, $2, $3)`,
        [skpId, ind.indikatorId, ind.targetSelf || 0]
      )
    }

    // Get full SKP with indicators
    const fullResult = await query(
      `SELECT skp.*, ta.nama as tahun_ajaran_nama
       FROM skp_tahunan skp
       LEFT JOIN tahun_ajaran ta ON ta.id = skp.tahun_ajaran_id
       WHERE skp.id = $1`,
      [skpId]
    )

    const indikatorResult = await query(
      `SELECT si.*, ik.kode, ik.nama as indikator_nama, ik.komponen, ik.bobot_persen, ik.min_evidence
       FROM skp_indikator si
       JOIN indikator_kinerja_config ik ON ik.id = si.indikator_id
       WHERE si.skp_id = $1
       ORDER BY ik.kode`,
      [skpId]
    )

    return NextResponse.json({
      ...fullResult.rows[0],
      indikator_list: indikatorResult.rows,
    }, { status: 201 })
  } catch (err) {
    console.error('POST /api/skp error:', err)
    return NextResponse.json({ error: 'Failed to create SKP' }, { status: 500 })
  }
}
