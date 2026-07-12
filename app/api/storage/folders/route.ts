import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(req.url)
    const parentId = searchParams.get('parent_id')

    let sql = `SELECT * FROM user_folders WHERE user_id = $1`
    const params: (string | null)[] = [session.id]
    let paramIndex = 2

    if (parentId === 'null' || parentId === '') {
      sql += ` AND parent_id IS NULL`
    } else if (parentId) {
      sql += ` AND parent_id = $${paramIndex}`
      params.push(parentId)
      paramIndex++
    }

    sql += ` ORDER BY name ASC`

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('GET /api/storage/folders error:', err)
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    const body = await req.json()
    const { name, parent_id } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama folder wajib diisi' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO user_folders (user_id, name, parent_id) VALUES ($1, $2, $3) RETURNING *`,
      [session.id, name.trim(), parent_id || null]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Nama folder sudah ada di lokasi ini' }, { status: 409 })
    }
    console.error('POST /api/storage/folders error:', err)
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const body = await req.json()
    const { name } = body

    if (!id) {
      return NextResponse.json({ error: 'ID folder wajib diisi' }, { status: 400 })
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama folder wajib diisi' }, { status: 400 })
    }

    const result = await query(
      `UPDATE user_folders SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *`,
      [name.trim(), id, session.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Folder tidak ditemukan atau bukan milik Anda' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Nama folder sudah ada di lokasi ini' }, { status: 409 })
    }
    console.error('PUT /api/storage/folders error:', err)
    return NextResponse.json({ error: 'Failed to rename folder' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID folder wajib diisi' }, { status: 400 })
    }

    const result = await query(
      `DELETE FROM user_folders WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, session.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Folder tidak ditemukan atau bukan milik Anda' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Folder berhasil dihapus' })
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('DELETE /api/storage/folders error:', err)
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 })
  }
}
