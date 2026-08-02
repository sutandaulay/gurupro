import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { query } from '@/lib/db'
import {
  getUserInstitutionRole,
  isInstitutionMember,
  canViewAllTeachers,
  canApproveDocuments,
  canManageMembers,
  canManageBilling,
  canExportAccreditation,
  canAccessLaporanEvaluasiLkpd,
  isLaporanEvaluasiCreator,
  withInstitutionPermission,
} from '@/lib/rbac/institution-permissions'

const mockQuery = query as ReturnType<typeof vi.fn>

describe('institution-permissions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('getUserInstitutionRole', () => {
    it('returns roles from cache when available', async () => {
      const cache = new Map()
      cache.set('1:5', ['kepala_sekolah'])
      
      const roles = await getUserInstitutionRole(1, 5, cache)
      expect(roles).toEqual(['kepala_sekolah'])
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('returns null when cache has null value', async () => {
      const cache = new Map()
      cache.set('1:5', null)
      
      const roles = await getUserInstitutionRole(1, 5, cache)
      expect(roles).toBeNull()
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('queries database when not in cache', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'guru' }, { value: 'wakasek' }],
      })
      
      const roles = await getUserInstitutionRole(1, 5)
      expect(roles).toEqual(['guru', 'wakasek'])
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT imr.value'),
        [1, 5]
      )
    })

    it('returns null when user has no roles', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })
      
      const roles = await getUserInstitutionRole(1, 5)
      expect(roles).toBeNull()
    })

    it('caches result after query', async () => {
      const cache = new Map()
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'guru' }],
      })
      
      const roles = await getUserInstitutionRole(1, 5, cache)
      expect(roles).toEqual(['guru'])
      expect(cache.get('1:5')).toEqual(['guru'])
    })

    it('handles database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'))
      
      const roles = await getUserInstitutionRole(1, 5)
      expect(roles).toBeNull()
    })
  })

  describe('isInstitutionMember', () => {
    it('returns true when user has roles', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'guru' }],
      })
      
      const result = await isInstitutionMember(1, 5)
      expect(result).toBe(true)
    })

    it('returns false when user has no roles', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })
      
      const result = await isInstitutionMember(1, 5)
      expect(result).toBe(false)
    })
  })

  describe('canViewAllTeachers', () => {
    it('returns true for kepala_sekolah', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'kepala_sekolah' }],
      })
      
      const result = await canViewAllTeachers(1, 5)
      expect(result).toBe(true)
    })

    it('returns true for wakasek', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'wakasek' }],
      })
      
      const result = await canViewAllTeachers(1, 5)
      expect(result).toBe(true)
    })

    it('returns true for operator', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'operator' }],
      })
      
      const result = await canViewAllTeachers(1, 5)
      expect(result).toBe(true)
    })

    it('returns true for admin_sekolah', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'admin_sekolah' }],
      })
      
      const result = await canViewAllTeachers(1, 5)
      expect(result).toBe(true)
    })

    it('returns false for guru', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'guru' }],
      })
      
      const result = await canViewAllTeachers(1, 5)
      expect(result).toBe(false)
    })

    it('returns false for bendahara', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'bendahara' }],
      })
      
      const result = await canViewAllTeachers(1, 5)
      expect(result).toBe(false)
    })

    it('returns false when user has no roles', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })
      
      const result = await canViewAllTeachers(1, 5)
      expect(result).toBe(false)
    })
  })

  describe('canApproveDocuments', () => {
    it('returns true for kepala_sekolah regardless of config', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ value: 'kepala_sekolah' }] })
        .mockResolvedValueOnce({ rows: [{ approval_layer_config: 'single' }] })
      
      const result = await canApproveDocuments(1, 5)
      expect(result).toBe(true)
    })

    it('returns true for wakasek with double approval config', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ value: 'wakasek' }] })
        .mockResolvedValueOnce({ rows: [{ approval_layer_config: 'double' }] })
      
      const result = await canApproveDocuments(1, 5)
      expect(result).toBe(true)
    })

    it('returns false for wakasek with single approval config', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ value: 'wakasek' }] })
        .mockResolvedValueOnce({ rows: [{ approval_layer_config: 'single' }] })
      
      const result = await canApproveDocuments(1, 5)
      expect(result).toBe(false)
    })

    it('returns false for guru', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ value: 'guru' }] })
      
      const result = await canApproveDocuments(1, 5)
      expect(result).toBe(false)
    })

    it('returns false when institution not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ value: 'wakasek' }] })
        .mockResolvedValueOnce({ rows: [] })
      
      const result = await canApproveDocuments(1, 5)
      expect(result).toBe(false)
    })
  })

  describe('canManageMembers', () => {
    it('returns true for operator', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'operator' }],
      })
      
      const result = await canManageMembers(1, 5)
      expect(result).toBe(true)
    })

    it('returns true for admin_sekolah', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'admin_sekolah' }],
      })
      
      const result = await canManageMembers(1, 5)
      expect(result).toBe(true)
    })

    it('returns false for guru', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'guru' }],
      })
      
      const result = await canManageMembers(1, 5)
      expect(result).toBe(false)
    })

    it('returns false for kepala_sekolah', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'kepala_sekolah' }],
      })
      
      const result = await canManageMembers(1, 5)
      expect(result).toBe(false)
    })
  })

  describe('canManageBilling', () => {
    it('returns true for bendahara', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'bendahara' }],
      })
      
      const result = await canManageBilling(1, 5)
      expect(result).toBe(true)
    })

    it('returns false for other roles', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'kepala_sekolah' }],
      })
      
      const result = await canManageBilling(1, 5)
      expect(result).toBe(false)
    })
  })

  describe('canExportAccreditation', () => {
    it('returns true for kepala_sekolah', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'kepala_sekolah' }],
      })
      
      const result = await canExportAccreditation(1, 5)
      expect(result).toBe(true)
    })

    it('returns true for wakasek', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'wakasek' }],
      })
      
      const result = await canExportAccreditation(1, 5)
      expect(result).toBe(true)
    })

    it('returns false for guru', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'guru' }],
      })
      
      const result = await canExportAccreditation(1, 5)
      expect(result).toBe(false)
    })
  })

  describe('canAccessLaporanEvaluasiLkpd', () => {
    it('returns canAccess=true, canViewAll=true for kepala_sekolah', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'kepala_sekolah' }],
      })
      
      const result = await canAccessLaporanEvaluasiLkpd(1, 5)
      expect(result).toEqual({ canAccess: true, canViewAll: true })
    })

    it('returns canAccess=true, canViewAll=false for guru', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'guru' }],
      })
      
      const result = await canAccessLaporanEvaluasiLkpd(1, 5)
      expect(result).toEqual({ canAccess: true, canViewAll: false })
    })

    it('returns canAccess=false, canViewAll=false for bendahara', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ value: 'bendahara' }],
      })
      
      const result = await canAccessLaporanEvaluasiLkpd(1, 5)
      expect(result).toEqual({ canAccess: false, canViewAll: false })
    })

    it('returns false when user has no roles', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })
      
      const result = await canAccessLaporanEvaluasiLkpd(1, 5)
      expect(result).toEqual({ canAccess: false, canViewAll: false })
    })
  })

  describe('isLaporanEvaluasiCreator', () => {
    it('returns true when user is creator', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: '1' }],
      })
      
      const result = await isLaporanEvaluasiCreator(1, 'laporan-1')
      expect(result).toBe(true)
    })

    it('returns false when user is not creator', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: '2' }],
      })
      
      const result = await isLaporanEvaluasiCreator(1, 'laporan-1')
      expect(result).toBe(false)
    })

    it('returns false when report not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })
      
      const result = await isLaporanEvaluasiCreator(1, 'laporan-1')
      expect(result).toBe(false)
    })
  })

  describe('withInstitutionPermission', () => {
    it('creates middleware that checks permission', async () => {
      const mockPermissionCheck = vi.fn().mockResolvedValue(true)
      const mockHandler = vi.fn().mockResolvedValue({ success: true })
      
      const middleware = withInstitutionPermission(mockPermissionCheck)
      const wrappedHandler = middleware(mockHandler)
      
      const req = {
        nextUrl: { searchParams: new URLSearchParams('institutionId=5') },
        headers: { get: vi.fn().mockReturnValue('1') },
        method: 'GET',
        clone: () => ({ json: vi.fn().mockResolvedValue({}) }),
      } as any
      
      const result = await wrappedHandler(req)
      expect(result).toEqual({ success: true })
      expect(mockPermissionCheck).toHaveBeenCalledWith(1, 5, expect.any(Map))
    })

    it('returns 400 when institutionId is missing', async () => {
      const mockPermissionCheck = vi.fn().mockResolvedValue(true)
      const mockHandler = vi.fn()
      
      const middleware = withInstitutionPermission(mockPermissionCheck)
      const wrappedHandler = middleware(mockHandler)
      
      const req = {
        nextUrl: { searchParams: new URLSearchParams('') },
        headers: { get: vi.fn().mockReturnValue(null) },
        method: 'GET',
        clone: () => ({ json: vi.fn().mockResolvedValue({}) }),
      } as any
      
      const result = await wrappedHandler(req)
      expect(result.status).toBe(400)
      expect(await result.json()).toEqual({ error: 'Institution ID diperlukan' })
    })

    it('returns 401 when userId is missing', async () => {
      const mockPermissionCheck = vi.fn().mockResolvedValue(true)
      const mockHandler = vi.fn()
      
      const middleware = withInstitutionPermission(mockPermissionCheck)
      const wrappedHandler = middleware(mockHandler)
      
      const req = {
        nextUrl: { searchParams: new URLSearchParams('institutionId=5') },
        headers: { get: vi.fn().mockReturnValue(null) },
        method: 'GET',
        clone: () => ({ json: vi.fn().mockResolvedValue({}) }),
      } as any
      
      const result = await wrappedHandler(req)
      expect(result.status).toBe(401)
    })

    it('returns 403 when permission check fails', async () => {
      const mockPermissionCheck = vi.fn().mockResolvedValue(false)
      const mockHandler = vi.fn()
      
      const middleware = withInstitutionPermission(mockPermissionCheck)
      const wrappedHandler = middleware(mockHandler)
      
      const req = {
        nextUrl: { searchParams: new URLSearchParams('institutionId=5') },
        headers: { get: vi.fn().mockReturnValue('1') },
        method: 'GET',
        clone: () => ({ json: vi.fn().mockResolvedValue({}) }),
      } as any
      
      const result = await wrappedHandler(req)
      expect(result.status).toBe(403)
      expect(await result.json()).toEqual({ error: 'Forbidden: Anda tidak memiliki akses' })
    })
  })
})