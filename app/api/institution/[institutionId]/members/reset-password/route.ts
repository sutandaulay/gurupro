import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { sendEventNotification } from '@/lib/notifications'

async function checkPermission(institutionId: number): Promise<NextResponse | null> {
  try {
    const session = await requireSession()
    const result = await query(
      `SELECT imr.value
       FROM institution_members im
       JOIN institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
      [session.id, institutionId]
    )
    if (result.rows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const allowed = result.rows.some((r: any) => r.value === 'operator' || r.value === 'admin_sekolah')
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return null
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  const { institutionId } = await context.params
  const instId = parseInt(institutionId, 10)
  if (isNaN(instId)) return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 })

  const permError = await checkPermission(instId)
  if (permError) return permError

  const { memberId } = await req.json()
  if (!memberId) {
    return NextResponse.json({ error: 'ID anggota wajib diisi' }, { status: 400 })
  }

  const memberResult = await query(
    `SELECT im.app_user_id, im.status, im.institution_id,
            u.email, u.nama_lengkap, u.whatsapp
     FROM institution_members im
     JOIN users u ON u.id = im.app_user_id::uuid
     WHERE im.id = $1 AND im.institution_id = $2`,
    [memberId, instId]
  )

  if (memberResult.rows.length === 0) {
    return NextResponse.json({ error: 'Anggota tidak ditemukan di institusi ini' }, { status: 404 })
  }

  const member = memberResult.rows[0]

  if (member.status !== 'active') {
    return NextResponse.json(
      { error: 'Reset password hanya dapat dilakukan untuk anggota aktif' },
      { status: 400 }
    )
  }

  if (!member.app_user_id || !member.email) {
    return NextResponse.json(
      { error: 'Anggota ini tidak memiliki akun GuruPRO yang valid' },
      { status: 400 }
    )
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()

  await query(
    `UPDATE users
     SET otp_code = $1,
         otp_expires_at = NOW() + INTERVAL '10 minutes'
     WHERE id = $2`,
    [otp, member.app_user_id]
  )

  await sendEventNotification('forgot_password', {
    email: member.email,
    whatsapp: member.whatsapp,
    nama_lengkap: member.nama_lengkap,
  }, { otp_code: otp })

  return NextResponse.json({
    success: true,
    message: 'Kode OTP reset password telah dikirim ke email/WhatsApp guru yang bersangkutan',
  })
}
