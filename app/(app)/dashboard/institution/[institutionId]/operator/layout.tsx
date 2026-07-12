import { requireSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'

interface Props {
  children: React.ReactNode
  params: Promise<{ institutionId: string }>
}

async function canManageMembersByAppUserId(
  appUserId: string,
  institutionId: number
): Promise<boolean> {
  try {
    const result = await query(
      `SELECT imr.value
       FROM institution_members im
       JOIN institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
      [appUserId, institutionId]
    )
    if (result.rows.length === 0) return false
    return result.rows.some((r: any) => r.value === 'operator' || r.value === 'admin_sekolah')
  } catch {
    return false
  }
}

export default async function OperatorDashboardLayout({ children, params }: Props) {
  const { institutionId } = await params
  const instId = parseInt(institutionId, 10)
  if (isNaN(instId)) redirect('/dashboard')

  let session
  try {
    session = await requireSession()
  } catch {
    redirect('/login')
  }

  const allowed = await canManageMembersByAppUserId(session.id, instId)
  if (!allowed) redirect('/dashboard')

  return <>{children}</>
}
