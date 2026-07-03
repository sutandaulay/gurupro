/**
 * API Route: /api/laporan-kinerja/[id]
 * Get and update single laporan kinerja
 */

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

    const result = await query(
      `SELECT * FROM laporan_kinerja WHERE id = $1 AND guru_id = $2`,
      [id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('GET /api/laporan-kinerja/[id] error:', err)
    return NextResponse.json({ error: 'Failed to fetch laporan' }, { status: 500 })
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

    const result = await query(
      `UPDATE laporan_kinerja SET
        status = COALESCE($1, status),
        content = COALESCE($2, content),
        updated_at = NOW()
      WHERE id = $3 AND guru_id = $4
      RETURNING *`,
      [
        body.status,
        body.content ? JSON.stringify(body.content) : null,
        id,
        guruId,
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('PUT /api/laporan-kinerja/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update laporan' }, { status: 500 })
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
      `DELETE FROM laporan_kinerja WHERE id = $1 AND guru_id = $2 RETURNING id`,
      [id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Laporan berhasil dihapus' })
  } catch (err) {
    console.error('DELETE /api/laporan-kinerja/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete laporan' }, { status: 500 })
  }
}
