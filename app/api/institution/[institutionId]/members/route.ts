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
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
      [session.id, institutionId]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const allowed = result.rows.some((r: any) =>
      r.value === 'operator' || r.value === 'admin_sekolah' || r.value === 'kepala_sekolah' || r.value === 'wakasek'
    )
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
    `SELECT im.id, im.app_user_id, im.institution_id, im.status, im.joined_at, im.created_at,
            im.sub_role, im.wali_kelas_of, im.ekskul_name,
            COALESCE(
              (SELECT json_agg(json_build_object('role', imr.value))
               FROM public.institution_members_role imr WHERE imr.parent_id = im.id),
              '[]'::json
            ) AS roles,
            u.email AS app_user_email,
            u.nama_lengkap,
            u.whatsapp,
            cu.name AS cms_user_name,
            cu.email AS cms_user_email,
            COALESCE(
              (SELECT json_agg(json_build_object('mapel', am.mapel) ORDER BY am._order)
               FROM public.institution_members_assigned_mapel am WHERE am._parent_id = im.id),
              '[]'::json
            ) AS assigned_mapel,
            COALESCE(
              (SELECT json_agg(json_build_object('kelas', ak.kelas) ORDER BY ak._order)
               FROM public.institution_members_assigned_kelas ak WHERE ak._parent_id = im.id),
              '[]'::json
            ) AS assigned_kelas
     FROM public.institution_members im
     LEFT JOIN users u ON u.id::text = im.app_user_id
     LEFT JOIN payload.cms_users cu ON cu.id::text = im.user_id::text
     WHERE im.institution_id = $1
     ORDER BY created_at DESC`,
    [instId]
  )

  const enriched = (result.rows || []).map((row: any) => ({
    id: row.id,
    app_user_id: row.app_user_id,
    institution_id: row.institution_id,
    status: row.status,
    joined_at: row.joined_at,
    created_at: row.created_at,
    sub_role: row.sub_role || null,
    wali_kelas_of: row.wali_kelas_of || null,
    ekskul_name: row.ekskul_name || null,
    roles: row.roles || [],
    app_user_email: row.app_user_email || null,
    nama_lengkap: row.nama_lengkap || row.cms_user_name || null,
    whatsapp: row.whatsapp || null,
    cms_user_name: row.cms_user_name || null,
    cms_user_email: row.cms_user_email || null,
    assigned_mapel: row.assigned_mapel || [],
    assigned_kelas: row.assigned_kelas || [],
  }))

  return NextResponse.json(enriched)
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
    `SELECT id FROM public.institution_members WHERE app_user_id = $1 AND institution_id = $2`,
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

  const publicMember = await query(
    `INSERT INTO public.institution_members (app_user_id, institution_id, status, joined_at, created_at, updated_at)
     VALUES ($1, $2, 'invited', NULL, NOW(), NOW())
     RETURNING id`,
    [appUser.id, instId]
  )
  const publicMemberId = publicMember.rows[0]?.id ?? membership.id

  if (mapel) {
    const mapelList = typeof mapel === 'string' ? mapel.split(',').map((m: string) => m.trim()).filter(Boolean) : []
    for (const m of mapelList) {
      try {
        await query(
          `INSERT INTO public.institution_members_assigned_mapel (_order, _parent_id, id, mapel)
           VALUES ((SELECT COALESCE(MAX(_order), 0) + 1 FROM public.institution_members_assigned_mapel WHERE _parent_id = $1), $1, gen_random_uuid()::text, $2)`,
          [publicMemberId, m]
        )
      } catch { /* table may not exist yet */ }
    }
  }

  if (kelas) {
    const kelasList = typeof kelas === 'string' ? kelas.split(',').map((k: string) => k.trim()).filter(Boolean) : []
    for (const k of kelasList) {
      try {
        await query(
          `INSERT INTO public.institution_members_assigned_kelas (_order, _parent_id, id, kelas)
           VALUES ((SELECT COALESCE(MAX(_order), 0) + 1 FROM public.institution_members_assigned_kelas WHERE _parent_id = $1), $1, gen_random_uuid()::text, $2)`,
          [publicMemberId, k]
        )
      } catch { /* table may not exist yet */ }
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
