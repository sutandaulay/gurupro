import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { getObjectFromR2 } from '@/lib/r2'

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID file wajib diisi' }, { status: 400 })
    }

    const result = await query(
      `SELECT * FROM user_files WHERE id = $1 AND user_id = $2`,
      [id, session.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
    }

    const file = result.rows[0]
    const object = await getObjectFromR2(file.r2_key)

    if (!object) {
      return NextResponse.json({ error: 'File tidak ditemukan di penyimpanan' }, { status: 404 })
    }

    const bytes = await object.Body?.transformToByteArray()
    if (!bytes) {
      return NextResponse.json({ error: 'Gagal membaca file' }, { status: 500 })
    }

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.name}"`,
        'Content-Length': String(body.length),
      },
    })
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('GET /api/storage/files/download error:', err)
    return NextResponse.json({ error: 'Gagal mendownload file' }, { status: 500 })
  }
}
