import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import {
  findAppUserByEmailOrUsername,
  findOrCreateCmsUser,
  createInvitation,
  sendInviteNotification,
} from '@/lib/institution-members'

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
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const allowed = result.rows.some((r: any) => r.value === 'operator' || r.value === 'admin_sekolah')
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return null
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  const { institutionId } = await context.params
  const instId = parseInt(institutionId, 10)
  if (isNaN(instId)) {
    return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 })
  }

  const permError = await checkPermission(instId)
  if (permError) return permError

  const result = await query(
    `SELECT im.id, im.user_id, im.app_user_id, im.institution_id, im.status, im.joined_at, im.created_at,
            cu.name AS cms_user_name, cu.email AS cms_user_email,
            u.email AS app_user_email, u.nama_lengkap, u.whatsapp,
            COALESCE(
              (SELECT json_agg(json_build_object('role', imr.value))
               FROM institution_members_role imr WHERE imr.parent_id = im.id),
              '[]'::json
            ) AS roles,
            COALESCE(
              (SELECT json_agg(json_build_object('mapel', imm.mapel))
               FROM institution_members_assigned_mapel imm WHERE imm._parent_id = im.id),
              '[]'::json
            ) AS assigned_mapel,
            COALESCE(
              (SELECT json_agg(json_build_object('kelas', imk.kelas))
               FROM institution_members_assigned_kelas imk WHERE imk._parent_id = im.id),
              '[]'::json
            ) AS assigned_kelas
     FROM institution_members im
     JOIN cms_users cu ON cu.id = im.user_id
     LEFT JOIN users u ON u.id = im.app_user_id::uuid
     WHERE im.institution_id = $1
     ORDER BY im.created_at DESC`,
    [instId]
  )

  return NextResponse.json(result.rows)
}

export async function POST(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  const { institutionId } = await context.params
  const instId = parseInt(institutionId, 10)
  if (isNaN(instId)) {
    return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 })
  }

  const permError = await checkPermission(instId)
  if (permError) return permError

  const body = await req.json()
  const { email, nama, nik, mapel, kelas } = body

  if (!email || !nama) {
    return NextResponse.json({ error: 'Email dan Nama wajib diisi' }, { status: 400 })
  }

  const appUser = await findAppUserByEmailOrUsername(email)
  if (!appUser) {
    return NextResponse.json(
      { error: 'Guru dengan email tersebut belum memiliki akun GuruPRO. Silakan daftar terlebih dahulu.' },
      { status: 404 }
    )
  }

  const existingMember = await query(
    `SELECT id FROM institution_members WHERE app_user_id = $1 AND institution_id = $2`,
    [appUser.id, instId]
  )
  if (existingMember.rows.length > 0) {
    return NextResponse.json(
      { error: 'Guru ini sudah terdaftar sebagai anggota institusi ini' },
      { status: 409 }
    )
  }

  const cmsUserId = await findOrCreateCmsUser({
    id: appUser.id,
    email: appUser.email,
    nama_lengkap: nama || appUser.nama_lengkap,
  })

  const membership = await createInvitation(appUser.id, cmsUserId, instId)

  if (mapel) {
    const mapelList = typeof mapel === 'string' ? mapel.split(',').map((m: string) => m.trim()).filter(Boolean) : []
    for (const m of mapelList) {
      await query(
        `INSERT INTO institution_members_assigned_mapel (_order, _parent_id, id, mapel)
         VALUES ((SELECT COALESCE(MAX(_order), 0) + 1 FROM institution_members_assigned_mapel WHERE _parent_id = $1), $1, gen_random_uuid()::text, $2)`,
        [membership.id, m]
      )
    }
  }

  if (kelas) {
    const kelasList = typeof kelas === 'string' ? kelas.split(',').map((k: string) => k.trim()).filter(Boolean) : []
    for (const k of kelasList) {
      await query(
        `INSERT INTO institution_members_assigned_kelas (_order, _parent_id, id, kelas)
         VALUES ((SELECT COALESCE(MAX(_order), 0) + 1 FROM institution_members_assigned_kelas WHERE _parent_id = $1), $1, gen_random_uuid()::text, $2)`,
        [membership.id, k]
      )
    }
  }

  const instResult = await query(`SELECT name FROM institutions WHERE id = $1`, [instId])
  const institutionName = instResult.rows[0]?.name || ''

  await sendInviteNotification(appUser.id, appUser.email, appUser.whatsapp, nama || appUser.nama_lengkap, institutionName)

  return NextResponse.json({
    success: true,
    message: 'Undangan berhasil dikirim',
    membership,
  })
}
