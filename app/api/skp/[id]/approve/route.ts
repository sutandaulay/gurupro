import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))

    const body = await req.json()
    const { catatanKepsek } = body

    const result = await query(
      `UPDATE skp_tahunan SET
        status = 'approved',
        catatan_kepsek = COALESCE($1, catatan_kepsek),
        updated_at = NOW()
       WHERE id = $2 AND status = 'submitted'
       RETURNING *`,
      [catatanKepsek || null, id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'SKP tidak ditemukan atau status bukan submitted' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('POST /api/skp/[id]/approve error:', err)
    return NextResponse.json({ error: 'Failed to approve SKP' }, { status: 500 })
  }
}
