import { query } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export type InstitutionRole =
  | 'kepala_sekolah'
  | 'wakasek'
  | 'operator'
  | 'admin_sekolah'
  | 'bendahara'
  | 'guru'

export type RoleCache = Map<string, string[] | null>

function cacheKey(userId: number, institutionId: number): string {
  return `${userId}:${institutionId}`
}

export async function getUserInstitutionRole(
  userId: number | string,
  institutionId: number,
  cache?: RoleCache
): Promise<string[] | null> {
  const numId = typeof userId === 'string' ? parseInt(userId, 10) : userId
  const key = cacheKey(numId, institutionId)
  if (cache?.has(key)) {
    return cache.get(key) ?? null
  }

  try {
    // Try UUID (app_user_id) first, then integer (user_id)
    let result: any
    if (typeof userId === 'string' && userId.length > 10) {
      result = await query(
        `SELECT imr.value
         FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
        [userId, institutionId]
      )
    }
    if (!result || result.rows.length === 0) {
      result = await query(
        `SELECT imr.value
         FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         WHERE im.user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
        [numId || 0, institutionId]
      )
    }

    if (result.rows.length === 0) {
      cache?.set(key, null)
      return null
    }

    const roles: string[] = result.rows.map((r: { value: string }) => r.value)
    cache?.set(key, roles)
    return roles
  } catch (error) {
    console.error('[RBAC] getUserInstitutionRole error:', error)
    return null
  }
}

export async function isInstitutionMember(
  userId: number | string,
  institutionId: number,
  cache?: RoleCache
): Promise<boolean> {
  const roles = await getUserInstitutionRole(userId, institutionId, cache)
  return roles !== null
}

export async function canViewAllTeachers(
  userId: number | string,
  institutionId: number,
  cache?: RoleCache
): Promise<boolean> {
  try {
    const roles = await getUserInstitutionRole(userId, institutionId, cache)
    if (!roles) return false
    return roles.some(r =>
      ['kepala_sekolah', 'wakasek', 'operator', 'admin_sekolah'].includes(r)
    )
  } catch {
    return false
  }
}

export async function canApproveDocuments(
  userId: number,
  institutionId: number,
  cache?: RoleCache
): Promise<boolean> {
  try {
    const roles = await getUserInstitutionRole(userId, institutionId, cache)
    if (!roles) return false

    if (roles.includes('kepala_sekolah')) return true
    if (!roles.includes('wakasek')) return false

    const configResult = await query(
      `SELECT approval_layer_config FROM institutions WHERE id = $1`,
      [institutionId]
    )
    if (configResult.rows.length === 0) return false
    return configResult.rows[0].approval_layer_config === 'double'
  } catch (error) {
    console.error('[RBAC] canApproveDocuments error:', error)
    return false
  }
}

export async function canManageMembers(
  userId: number,
  institutionId: number,
  cache?: RoleCache
): Promise<boolean> {
  try {
    const roles = await getUserInstitutionRole(userId, institutionId, cache)
    if (!roles) return false
    return roles.some(r => r === 'operator' || r === 'admin_sekolah')
  } catch {
    return false
  }
}

export async function canManageBilling(
  userId: number,
  institutionId: number,
  cache?: RoleCache
): Promise<boolean> {
  try {
    const roles = await getUserInstitutionRole(userId, institutionId, cache)
    if (!roles) return false
    return roles.includes('bendahara')
  } catch {
    return false
  }
}

export async function canExportAccreditation(
  userId: number,
  institutionId: number,
  cache?: RoleCache
): Promise<boolean> {
  try {
    const roles = await getUserInstitutionRole(userId, institutionId, cache)
    if (!roles) return false
    return roles.some(r =>
      ['kepala_sekolah', 'wakasek', 'operator', 'admin_sekolah'].includes(r)
    )
  } catch {
    return false
  }
}

/**
 * Check if user can access Laporan Evaluasi LKPD
 * Access rules:
 * - Kepala Sekolah/Wakasek/Operator/Admin: can view all in their institution
 * - Guru pengampu: can view their own created reports
 * - Guru lain (bukan pengampu): cannot view
 */
export async function canAccessLaporanEvaluasiLkpd(
  userId: number,
  institutionId: number,
  cache?: RoleCache
): Promise<{ canAccess: boolean; canViewAll: boolean }> {
  try {
    const roles = await getUserInstitutionRole(userId, institutionId, cache)

    // Principal/Vice Principal/Operator/Admin can view all
    if (roles && roles.some(r =>
      ['kepala_sekolah', 'wakasek', 'operator', 'admin_sekolah'].includes(r)
    )) {
      return { canAccess: true, canViewAll: true };
    }

    // Guru can create but only view their own
    if (roles && roles.includes('guru')) {
      return { canAccess: true, canViewAll: false };
    }

    return { canAccess: false, canViewAll: false };
  } catch {
    return { canAccess: false, canViewAll: false };
  }
}

/**
 * Check if user is the creator of a specific Laporan Evaluasi LKPD
 */
export async function isLaporanEvaluasiCreator(
  userId: number,
  laporanId: string
): Promise<boolean> {
  try {
    const result = await query(
      `SELECT user_id FROM guru_administrasi
       WHERE id = $1 AND tipe_dokumen = 'laporan_evaluasi_lkpd'`,
      [laporanId]
    );

    if (result.rows.length === 0) return false;
    return String(result.rows[0].user_id) === String(userId);
  } catch {
    return false;
  }
}

async function extractInstitutionIdFromRequest(
  req: NextRequest,
  context?: { params?: Promise<Record<string, string>> | Record<string, string> }
): Promise<number | null> {
  if (context?.params) {
    const params = 'then' in context.params ? await context.params : context.params
    if (params.institutionId) {
      const parsed = parseInt(params.institutionId, 10)
      if (!isNaN(parsed)) return parsed
    }
  }

  const queryId = req.nextUrl.searchParams.get('institutionId')
  if (queryId) {
    const parsed = parseInt(queryId, 10)
    if (!isNaN(parsed)) return parsed
  }

  const headerId = req.headers.get('x-institution-id')
  if (headerId) {
    const parsed = parseInt(headerId, 10)
    if (!isNaN(parsed)) return parsed
  }

  if (req.method !== 'GET') {
    try {
      const body = await req.clone().json()
      if (body.institutionId) {
        const parsed = parseInt(body.institutionId, 10)
        if (!isNaN(parsed)) return parsed
      }
    } catch {}
  }

  return null
}

async function extractUserIdFromRequest(req: NextRequest): Promise<number | null> {
  const headerId = req.headers.get('x-user-id')
  if (headerId) {
    const parsed = parseInt(headerId, 10)
    if (!isNaN(parsed)) return parsed
  }
  return null
}

export type RouteHandler = (
  req: NextRequest,
  context?: { params?: Promise<Record<string, string>> | Record<string, string> }
) => Promise<NextResponse>

export function withInstitutionPermission(
  permissionCheck: (
    userId: number,
    institutionId: number,
    cache?: RoleCache
  ) => Promise<boolean>,
  options?: {
    getUserId?: (req: NextRequest) => Promise<number | null>
    getInstitutionId?: (
      req: NextRequest,
      context?: { params?: Promise<Record<string, string>> | Record<string, string> }
    ) => Promise<number | null>
  }
): (handler: RouteHandler) => RouteHandler {
  return function wrap(handler: RouteHandler): RouteHandler {
    return async (req: NextRequest, context?: any): Promise<NextResponse> => {
      const cache: RoleCache = new Map()
      try {
        const getUserId = options?.getUserId ?? extractUserIdFromRequest
        const getInstId = options?.getInstitutionId ?? extractInstitutionIdFromRequest

        const userId = await getUserId(req)
        const institutionId = await getInstId(req, context)

        if (!institutionId) {
          return NextResponse.json(
            { error: 'Institution ID diperlukan' },
            { status: 400 }
          )
        }
        if (!userId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const hasPermission = await permissionCheck(userId, institutionId, cache)
        if (!hasPermission) {
          return NextResponse.json(
            { error: 'Forbidden: Anda tidak memiliki akses' },
            { status: 403 }
          )
        }

        return handler(req, context)
      } catch (error: any) {
        console.error('[RBAC] withInstitutionPermission error:', error)
        return NextResponse.json(
          { error: error?.message || 'Internal Server Error' },
          { status: 500 }
        )
      }
    }
  }
}
