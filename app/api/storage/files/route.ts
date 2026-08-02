import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { uploadToR2WithKey, deleteFromR2 } from '@/lib/r2'
import { parsePagination, wrapResponse } from '@/lib/pagination'

const MAX_SIZE = 2 * 1024 * 1024

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(req.url)
    const folderId = searchParams.get('folder_id')

    let whereClause = 'user_id = $1'
    const params: (string | null)[] = [session.id]
    let paramIndex = 2

    if (folderId === 'null' || folderId === '') {
      whereClause += ` AND folder_id IS NULL`
    } else if (folderId) {
      whereClause += ` AND folder_id = $${paramIndex}`
      params.push(folderId)
      paramIndex++
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM user_files WHERE ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].count, 10)

    const pagination = parsePagination(searchParams)
    const off = (pagination.page - 1) * pagination.limit

    const result = await query(
      `SELECT * FROM user_files WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${pagination.limit} OFFSET ${off}`,
      params
    )
    return NextResponse.json(wrapResponse(result.rows, total, pagination))
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('GET /api/storage/files error:', err)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folder_id') as string | null
    const customName = formData.get('name') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File wajib diupload' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 50MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileName = customName?.trim() || file.name
    const fileExtension = file.name.split('.').pop() || ''

    const r2Key = `users/${session.id}/files/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExtension}`
    const r2Url = await uploadToR2WithKey(buffer, r2Key, file.type)

    if (!r2Url) {
      return NextResponse.json({ error: 'Gagal mengupload file ke penyimpanan' }, { status: 500 })
    }

    const result = await query(
      `INSERT INTO user_files (user_id, folder_id, name, r2_key, r2_url, size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [session.id, folderId || null, fileName, r2Key, r2Url, file.size, file.type]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('POST /api/storage/files error:', err)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
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
      return NextResponse.json({ error: 'ID file wajib diisi' }, { status: 400 })
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama file wajib diisi' }, { status: 400 })
    }

    const result = await query(
      `UPDATE user_files SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *`,
      [name.trim(), id, session.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'File tidak ditemukan atau bukan milik Anda' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('PUT /api/storage/files error:', err)
    return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID file wajib diisi' }, { status: 400 })
    }

    const file = await query(
      `SELECT * FROM user_files WHERE id = $1 AND user_id = $2`,
      [id, session.id]
    )

    if (file.rows.length === 0) {
      return NextResponse.json({ error: 'File tidak ditemukan atau bukan milik Anda' }, { status: 404 })
    }

    const fileData = file.rows[0]
    await deleteFromR2(fileData.r2_key)

    await query(
      `DELETE FROM user_files WHERE id = $1 AND user_id = $2`,
      [id, session.id]
    )

    return NextResponse.json({ message: 'File berhasil dihapus' })
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('DELETE /api/storage/files error:', err)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
