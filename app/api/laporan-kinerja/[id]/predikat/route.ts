import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSessionFromCookieHeader } from '@/lib/session-sign'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const sessionData = getSessionFromCookieHeader(req.headers.get('cookie'))

    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guruId = sessionData.id

    const body = await req.json()
    const { predikat, rataRataRating, totalObservasi } = body

    const validPredikat = ['Amat Baik', 'Baik', 'Cukup', 'Kurang']
    if (predikat && !validPredikat.includes(predikat)) {
      return NextResponse.json({ error: 'Predikat tidak valid' }, { status: 400 })
    }

    const result = await query(
      `UPDATE laporan_kinerja SET
        predikat = COALESCE($1, predikat),
        rata_rata_rating = COALESCE($2, rata_rata_rating),
        total_observasi = COALESCE($3, total_observasi),
        status = 'final',
        updated_at = NOW()
       WHERE id = $4 AND guru_id = $5
       RETURNING *`,
      [predikat || null, rataRataRating ?? null, totalObservasi ?? null, id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('PUT /api/laporan-kinerja/[id]/predikat error:', err)
    return NextResponse.json({ error: 'Failed to set predikat' }, { status: 500 })
  }
}
