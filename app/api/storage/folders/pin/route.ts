import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { getUserById } from '@/lib/db'
import { sendEmail } from '@/lib/email'

const bcrypt = require('bcrypt')

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    const body = await req.json()
    const { action, folder_id, pin, code, new_pin } = body

    if (!folder_id) {
      return NextResponse.json({ error: 'ID folder wajib diisi' }, { status: 400 })
    }

    // Verify folder ownership
    const folder = await query(
      `SELECT * FROM user_folders WHERE id = $1 AND user_id = $2`,
      [folder_id, session.id]
    )

    if (folder.rows.length === 0) {
      return NextResponse.json({ error: 'Folder tidak ditemukan atau bukan milik Anda' }, { status: 404 })
    }

    const folderData = folder.rows[0]

    switch (action) {
      case 'set': {
        if (!pin || !/^\d{4,6}$/.test(pin)) {
          return NextResponse.json({ error: 'PIN harus berupa 4-6 digit angka' }, { status: 400 })
        }
        const hashedPin = await bcrypt.hash(pin, 10)
        await query(
          `UPDATE user_folders SET pin = $1, pin_reset_code = NULL, pin_reset_expires_at = NULL WHERE id = $2`,
          [hashedPin, folder_id]
        )
        return NextResponse.json({ message: 'PIN berhasil disimpan' })
      }

      case 'remove': {
        await query(
          `UPDATE user_folders SET pin = NULL, pin_reset_code = NULL, pin_reset_expires_at = NULL WHERE id = $1`,
          [folder_id]
        )
        return NextResponse.json({ message: 'PIN berhasil dihapus' })
      }

      case 'verify': {
        if (!pin) {
          return NextResponse.json({ error: 'PIN wajib diisi' }, { status: 400 })
        }
        if (!folderData.pin) {
          return NextResponse.json({ error: 'Folder ini tidak memiliki PIN' }, { status: 400 })
        }
        const isValid = await bcrypt.compare(pin, folderData.pin)
        if (!isValid) {
          return NextResponse.json({ error: 'PIN salah' }, { status: 401 })
        }
        return NextResponse.json({ message: 'PIN benar' })
      }

      case 'forgot': {
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 menit

        await query(
          `UPDATE user_folders SET pin_reset_code = $1, pin_reset_expires_at = $2 WHERE id = $3`,
          [code, expiresAt.toISOString(), folder_id]
        )

        // Try to send email
        const user = await getUserById(session.id)
        let emailSent = false
        if (user?.email) {
          emailSent = await sendEmail({
            to: user.email,
            subject: 'Kode Reset PIN Folder - GuruPRO',
            html: `
              <div style="font-family: sans-serif; padding: 20px; max-width: 480px;">
                <h2 style="color: #4f46e5;">Reset PIN Folder</h2>
                <p>Halo <strong>${user.nama_lengkap}</strong>,</p>
                <p>Anda meminta reset PIN untuk folder <strong>"${folderData.name}"</strong>.</p>
                <p>Berikut adalah kode reset PIN Anda:</p>
                <h1 style="letter-spacing: 6px; color: #4f46e5; text-align: center; font-size: 32px; background: #f5f3ff; padding: 16px; border-radius: 12px;">${code}</h1>
                <p>Kode ini berlaku selama <strong>10 menit</strong>.</p>
                <p>Jika Anda tidak meminta reset PIN, abaikan email ini.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">GuruPRO — Platform Administrasi Guru</p>
              </div>
            `,
          })
        }

        return NextResponse.json({
          message: emailSent
            ? 'Kode reset PIN telah dikirim ke email Anda'
            : 'Kode reset PIN (lihat response ini untuk development)',
          code: code, // returned for development; remove in production
          email_sent: emailSent,
        })
      }

      case 'reset': {
        if (!code || !new_pin) {
          return NextResponse.json({ error: 'Kode reset dan PIN baru wajib diisi' }, { status: 400 })
        }
        if (!/^\d{4,6}$/.test(new_pin)) {
          return NextResponse.json({ error: 'PIN baru harus berupa 4-6 digit angka' }, { status: 400 })
        }

        if (!folderData.pin_reset_code || !folderData.pin_reset_expires_at) {
          return NextResponse.json({ error: 'Tidak ada permintaan reset PIN' }, { status: 400 })
        }

        if (folderData.pin_reset_code !== code) {
          return NextResponse.json({ error: 'Kode reset tidak valid' }, { status: 401 })
        }

        if (new Date(folderData.pin_reset_expires_at) < new Date()) {
          return NextResponse.json({ error: 'Kode reset sudah kedaluwarsa' }, { status: 410 })
        }

        const hashedPin = await bcrypt.hash(new_pin, 10)
        await query(
          `UPDATE user_folders SET pin = $1, pin_reset_code = NULL, pin_reset_expires_at = NULL WHERE id = $2`,
          [hashedPin, folder_id]
        )

        return NextResponse.json({ message: 'PIN berhasil direset' })
      }

      default:
        return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 })
    }
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('POST /api/storage/folders/pin error:', err)
    return NextResponse.json({ error: 'Failed to process PIN request' }, { status: 500 })
  }
}
