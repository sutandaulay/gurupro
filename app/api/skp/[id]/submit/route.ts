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
    const guruId = sessionData.id

    const result = await query(
      `UPDATE skp_tahunan SET status = 'submitted', updated_at = NOW()
       WHERE id = $1 AND guru_id = $2 AND status = 'draft'
       RETURNING *`,
      [id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'SKP tidak ditemukan atau sudah disubmit' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('POST /api/skp/[id]/submit error:', err)
    return NextResponse.json({ error: 'Failed to submit SKP' }, { status: 500 })
  }
}
