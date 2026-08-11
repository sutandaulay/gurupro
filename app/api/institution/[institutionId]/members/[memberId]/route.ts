import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'

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
    if (result.rows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const allowed = result.rows.some((r: any) =>
      r.value === 'operator' || r.value === 'admin_sekolah' || r.value === 'kepala_sekolah'
    )
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return null
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ institutionId: string; memberId: string }> }
) {
  const { institutionId, memberId } = await context.params
  const instId = parseInt(institutionId, 10)
  const memId = parseInt(memberId, 10)
  if (isNaN(instId) || isNaN(memId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const permError = await checkPermission(instId)
  if (permError) return permError

  const memberCheck = await query(
    `SELECT id FROM public.institution_members WHERE id = $1 AND institution_id = $2`,
    [memId, instId]
  )
  if (memberCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 })
  }

  const body = await req.json()

  if (body.status !== undefined) {
    const validStatuses = ['invited', 'active', 'left', 'rejected']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }
    await query(
      `UPDATE public.institution_members SET status = $1, updated_at = NOW() WHERE id = $2`,
      [body.status, memId]
    )
  }

  if (body.mapel !== undefined) {
    await query(`DELETE FROM institution_members_assigned_mapel WHERE _parent_id = $1`, [memId])
    const mapelList = typeof body.mapel === 'string'
      ? body.mapel.split(',').map((m: string) => m.trim()).filter(Boolean)
      : Array.isArray(body.mapel) ? body.mapel.filter(Boolean) : []
    for (const m of mapelList) {
      await query(
        `INSERT INTO institution_members_assigned_mapel (_order, _parent_id, id, mapel)
         VALUES ((SELECT COALESCE(MAX(_order), 0) + 1 FROM institution_members_assigned_mapel WHERE _parent_id = $1), $1, gen_random_uuid()::text, $2)`,
        [memId, m]
      )
    }
  }

  if (body.kelas !== undefined) {
    await query(`DELETE FROM institution_members_assigned_kelas WHERE _parent_id = $1`, [memId])
    const kelasList = typeof body.kelas === 'string'
      ? body.kelas.split(',').map((k: string) => k.trim()).filter(Boolean)
      : Array.isArray(body.kelas) ? body.kelas.filter(Boolean) : []
    for (const k of kelasList) {
      await query(
        `INSERT INTO institution_members_assigned_kelas (_order, _parent_id, id, kelas)
         VALUES ((SELECT COALESCE(MAX(_order), 0) + 1 FROM institution_members_assigned_kelas WHERE _parent_id = $1), $1, gen_random_uuid()::text, $2)`,
        [memId, k]
      )
    }
  }

  if (body.subRole !== undefined) {
    await query(
      `UPDATE public.institution_members SET sub_role = $1 WHERE id = $2`,
      [body.subRole || null, memId]
    )
  }

  if (body.waliKelasOf !== undefined) {
    await query(
      `UPDATE public.institution_members SET wali_kelas_of = $1 WHERE id = $2`,
      [body.waliKelasOf || null, memId]
    )
  }

  if (body.ekskulName !== undefined) {
    await query(
      `UPDATE public.institution_members SET ekskul_name = $1 WHERE id = $2`,
      [body.ekskulName || null, memId]
    )
  }

  return NextResponse.json({ success: true, message: 'Data anggota berhasil diperbarui' })
}
