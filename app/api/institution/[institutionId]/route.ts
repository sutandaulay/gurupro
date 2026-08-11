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
    `SELECT id, name, npsn, jenjang, naungan, subscription_tier, academic_year_active, status
     FROM institutions WHERE id = $1`,
    [instId]
  )
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Institusi tidak ditemukan' }, { status: 404 })
  }

  return NextResponse.json(result.rows[0])
}

export async function PATCH(
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

  if (body.academic_year_active !== undefined) {
    await query(
      `UPDATE institutions SET academic_year_active = $1, updated_at = NOW() WHERE id = $2`,
      [body.academic_year_active, instId]
    )
  }

  const result = await query(
    `SELECT id, name, npsn, jenjang, naungan, subscription_tier, academic_year_active, status
     FROM institutions WHERE id = $1`,
    [instId]
  )

  return NextResponse.json(result.rows[0])
}
