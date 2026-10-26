import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { uploadToR2WithKey, deleteFromR2 } from '@/lib/r2'
import { parsePagination, wrapResponse } from '@/lib/pagination'
import { StorageListQuerySchema, StorageRenameBodySchema, StorageRenameQuerySchema, StorageDeleteQuerySchema } from '@/lib/validation/schemas'

const MAX_SIZE = 50 * 1024 * 1024 // 50MB

// Allowed MIME types for upload
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Text
  'text/plain',
  'text/csv',
  // Audio/Video
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  'video/quicktime',
]

// MIME types that are always blocked regardless of extension
const BLOCKED_MIME_TYPES = [
  'text/html',
  'application/javascript',
  'application/x-javascript',
  'text/javascript',
  'application/x-msdownload',
  'application/x-sh',
  'application/x-shockwave-flash',
]

// Extension-to-MIME mapping for cross-validation
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  csv: 'text/csv',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
}

// Extensions that are always blocked
const DANGEROUS_EXTENSIONS = [
  'html', 'htm', 'js', 'jsx', 'ts', 'tsx', 'php', 'asp', 'aspx',
  'exe', 'sh', 'bat', 'cmd', 'jar', 'msi', 'dll', 'so',
  'svg', // svg allowed only via content-scan later; blocked by default here
]

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(req.url)

    // Zod-validated query params
    const { folder_id } = StorageListQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    )

    let whereClause = 'user_id = $1'
    const params: (string | null)[] = [session.id]
    let paramIndex = 2

    if (folder_id === 'null' || folder_id === '') {
      whereClause += ` AND folder_id IS NULL`
    } else if (folder_id) {
      whereClause += ` AND folder_id = $${paramIndex}`
      params.push(folder_id)
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

    // --- Server-side MIME type & extension validation ---
    const ext = file.name.split('.').pop()?.toLowerCase() || ''

    // 1. Block dangerous extensions first (these are never allowed)
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Tipe file tidak diizinkan' }, { status: 400 })
    }

    // 2. Block blocked MIME types (regardless of extension)
    if (BLOCKED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipe file tidak diizinkan' }, { status: 400 })
    }

    // 3. Whitelist MIME type check
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipe file tidak diizinkan' }, { status: 400 })
    }

    // 4. Cross-validate extension against MIME type (defense in depth)
    const expectedMime = EXT_TO_MIME[ext]
    if (expectedMime && expectedMime !== file.type) {
      return NextResponse.json({ error: 'Ekstensi file tidak cocok dengan tipe file' }, { status: 400 })
    }
    // --- End validation ---

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
    const body = await req.json()

    // Zod-validated params and body
    const { id } = StorageRenameQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    )
    const { name } = StorageRenameBodySchema.parse(body)

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

    // Zod-validated query param
    const { id } = StorageDeleteQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    )

    const file = await query(
      `SELECT * FROM user_files WHERE id = $1 AND user_id = $2`,
      [id, session.id]
    )

    if (file.rows.length === 0) {
      return NextResponse.json({ error: 'File tidak ditemukan atau bukan milik Anda' }, { status: 404 })
    }

    const fileData = file.rows[0]
    // Delete DB record first, then remove R2 file
    await query(
      `DELETE FROM user_files WHERE id = $1 AND user_id = $2`,
      [id, session.id]
    )

    await deleteFromR2(fileData.r2_key)

    return NextResponse.json({ message: 'File berhasil dihapus' })
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('DELETE /api/storage/files error:', err)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
