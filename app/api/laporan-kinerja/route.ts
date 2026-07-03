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
    const sekolahId = searchParams.get('sekolah_id')

    let queryStr = `SELECT id, judul, semester, status, predikat, total_observasi,
                    rata_rata_rating, sekolah_id, created_at, ai_generated_at
             FROM laporan_kinerja
             WHERE guru_id = $1`
    const params: any[] = [guruId]

    if (sekolahId) {
      queryStr += ` AND sekolah_id = $2`
      params.push(sekolahId)
    }

    queryStr += ` ORDER BY created_at DESC`

    const result = await query(queryStr, params)

    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/laporan-kinerja error:', err)
    return NextResponse.json({ error: 'Failed to fetch laporan' }, { status: 500 })
  }
}
