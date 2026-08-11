import { requireSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'

interface Props {
  children: React.ReactNode
  params: Promise<{ institutionId: string }>
}

export default async function InstitutionPageLayout({ children, params }: Props) {
  const { institutionId } = await params
  const instId = parseInt(institutionId, 10)
  if (isNaN(instId)) redirect('/dashboard')

  // Auth check
  let session
  try {
    session = await requireSession()
  } catch {
    redirect('/login')
  }

  // Verify institution exists
  let inst: { id: number; status: string } | null = null
  try {
    const instRes = await query(
      `SELECT id, status FROM institutions WHERE id = $1`,
      [instId]
    )
    if (instRes.rows.length > 0) inst = instRes.rows[0]
  } catch { /* ignore */ }

  if (!inst) redirect('/dashboard')

  // Check institution status
  if (inst.status !== 'active') {
    redirect(`/institusi/${instId}/langganan-tidak-aktif`)
  }

  // Verify user is a member with valid role
  let roles: string[] = []
  try {
    const roleRes = await query(
      `SELECT imr.value
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
      [session.id, instId]
    )
    roles = roleRes.rows.map((r: any) => r.value)
  } catch { /* ignore */ }

  const allowed = roles.some(r =>
    ['kepala_sekolah', 'operator', 'wakasek', 'bendahara', 'admin_sekolah'].includes(r)
  )
  if (!allowed) redirect('/dashboard')

  // Canonical pathway is /institusi/[id]/dashboard — redirect here
  redirect(`/institusi/${instId}/dashboard`)
}
