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
    const statusFilter = searchParams.get('status')

    let whereClause = 'guru_id = $1'
    const params: any[] = [guruId]
    let paramIndex = 2

    if (sekolahId) {
      whereClause += ` AND sekolah_id = $${paramIndex}`
      params.push(sekolahId)
      paramIndex++
    }

    if (statusFilter && statusFilter !== 'all') {
      whereClause += ` AND status = $${paramIndex}`
      params.push(statusFilter)
      paramIndex++
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

    const resultSKP = await query(
      `SELECT id, tahun_ajaran_id, tahun_ajaran_nama, status, catatan_guru,
              created_at, indikator_list, observasi
       FROM skp
       WHERE guru_id = $1
       ORDER BY created_at DESC`,
      [guruId]
    )

    return NextResponse.json({
      data: wrapResponse(result.rows, total, pagination),
      skpList: resultSKP.rows,
    })
  } catch (err) {
    console.error('GET /api/laporan-kinerja error:', err)
    return NextResponse.json({ error: 'Failed to fetch laporan' }, { status: 500 })
  }
}
