/**
 * API Route: /api/pelatihan/[id]/upload-sertifikat
 * Upload certificate for pelatihan
 */

import { NextResponse } from 'next/server'
import { uploadToR2 } from '@/lib/r2'
import { getSessionFromCookieHeader } from '@/lib/session-sign'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const sessionData = getSessionFromCookieHeader(req.headers.get('cookie'))

    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guruId = sessionData.id

    const { query: dbQuery } = await import('@/lib/db')
    const userDb = await dbQuery("SELECT role, status_langganan, subscription_end FROM users WHERE id = $1", [guruId])
    const user = userDb.rows[0]
    const isPro = user?.status_langganan && user.status_langganan !== 'free'
    const isExpired = isPro && user.subscription_end && new Date(user.subscription_end).getTime() < Date.now()

    if (isExpired && user.role !== 'admin') {
      return NextResponse.json({ error: 'Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk melakukan unggah sertifikat pelatihan.' }, { status: 403 })
    }

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

    let fileUrl = ""
    try {
      const r2Url = await uploadToR2(buffer, file.name, file.type)
      if (r2Url) {
        fileUrl = r2Url
      } else {
        const base64 = buffer.toString('base64')
        fileUrl = `data:${file.type};base64,${base64}`
      }
    } catch (err) {
      console.warn("Failed to upload to R2, falling back to base64:", err)
      const base64 = buffer.toString('base64')
      fileUrl = `data:${file.type};base64,${base64}`
    }

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
