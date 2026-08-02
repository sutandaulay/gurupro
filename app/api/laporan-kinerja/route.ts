import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { parsePagination, wrapResponse } from '@/lib/pagination'

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
    const sekolahId = searchParams.get('sekolah_id')

    let whereClause = 'guru_id = $1'
    const params: any[] = [guruId]

    if (sekolahId) {
      whereClause += ` AND sekolah_id = $2`
      params.push(sekolahId)
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM laporan_kinerja WHERE ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].count, 10)

    const pagination = parsePagination(searchParams)
    const off = (pagination.page - 1) * pagination.limit

    const result = await query(
      `SELECT id, judul, semester, status, predikat, total_observasi,
              rata_rata_rating, sekolah_id, created_at, ai_generated_at
       FROM laporan_kinerja
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${pagination.limit} OFFSET ${off}`,
      params
    )

    return NextResponse.json(wrapResponse(result.rows, total, pagination))
  } catch (err) {
    console.error('GET /api/laporan-kinerja error:', err)
    return NextResponse.json({ error: 'Failed to fetch laporan' }, { status: 500 })
  }
}
