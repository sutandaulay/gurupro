/**
 * API Route: /api/pelatihan/[id]/upload-sertifikat
 * Upload certificate for pelatihan
 */

import { NextResponse } from 'next/server'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

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

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan PDF, JPG, atau PNG.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file maksimal 5MB.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const fileUrl = `data:${file.type};base64,${base64}`

    const { query } = await import('@/lib/db')
    const result = await query(
      `UPDATE pelatihan_guru SET
        file_sertifikat_url = $1,
        file_sertifikat_nama = $2,
        status_verifikasi = 'sudah_upload',
        updated_at = NOW()
      WHERE id = $3 AND guru_id = $4
      RETURNING *`,
      [fileUrl, file.name, id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Pelatihan tidak ditemukan' }, { status: 404 })
    }

    await query(
      `UPDATE evidence_log SET
        metadata = metadata || '{"ada_sertifikat": true}'::jsonb,
        bobot_evidence = 5
      WHERE referensi_id = $1 AND referensi_tabel = 'pelatihan_guru'
      AND guru_id = $2`,
      [id, guruId]
    )

    return NextResponse.json({
      success: true,
      file_url: fileUrl,
      file_nama: file.name,
      data: result.rows[0],
    })
  } catch (err) {
    console.error('POST /api/pelatihan/[id]/upload-sertifikat error:', err)
    return NextResponse.json({ error: 'Gagal upload sertifikat' }, { status: 500 })
  }
}
