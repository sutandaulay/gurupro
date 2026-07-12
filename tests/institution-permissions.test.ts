import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()

vi.mock('../lib/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
}))

const mockJson = vi.fn()
const mockClone = vi.fn()
const mockHeaders = { get: vi.fn() }
const mockNextUrl = { searchParams: { get: vi.fn() } }

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({
      body,
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
  NextRequest: vi.fn(),
}))

const {
  getUserInstitutionRole,
  isInstitutionMember,
  canViewAllTeachers,
  canApproveDocuments,
  canManageMembers,
  canManageBilling,
  canExportAccreditation,
  withInstitutionPermission,
} = await import('../lib/rbac/institution-permissions')

function createMockRequest(overrides?: {
  method?: string
  headers?: Record<string, string>
  query?: Record<string, string>
  body?: any
}) {
  const headers = new Map(Object.entries(overrides?.headers ?? {}))
  return {
    method: overrides?.method ?? 'GET',
    headers: {
      get: (name: string) => headers.get(name) ?? null,
    },
    nextUrl: {
      searchParams: {
        get: (name: string) => overrides?.query?.[name] ?? null,
      },
    },
    clone: () => ({
      json: async () => overrides?.body ?? {},
    }),
  } as any
}

function createQueryResult(rows: any[]) {
  return { rows, rowCount: rows.length }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ========================================
// getUserInstitutionRole
// ========================================

describe('getUserInstitutionRole', () => {
  it('mengembalikan array role untuk member aktif', async () => {
    mockQuery.mockResolvedValue(
      createQueryResult([{ value: 'guru' }, { value: 'bendahara' }])
    )
    const result = await getUserInstitutionRole(1, 10)
    expect(result).toEqual(['guru', 'bendahara'])
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT imr.value'),
      [1, 10]
    )
  })

  it('mengembalikan null jika bukan member', async () => {
    mockQuery.mockResolvedValue(createQueryResult([]))
    const result = await getUserInstitutionRole(1, 10)
    expect(result).toBeNull()
  })

  it('mengembalikan null jika query error (fail-safe)', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'))
    const result = await getUserInstitutionRole(1, 10)
    expect(result).toBeNull()
  })

  it('mengembalikan null jika institusi tidak ditemukan', async () => {
    mockQuery.mockResolvedValue(createQueryResult([]))
    const result = await getUserInstitutionRole(1, 999)
    expect(result).toBeNull()
  })

  it('menggunakan cache untuk menghindari query berulang', async () => {
    const cache = new Map<string, string[] | null>()
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'guru' }]))

    const first = await getUserInstitutionRole(1, 10, cache)
    const second = await getUserInstitutionRole(1, 10, cache)

    expect(first).toEqual(['guru'])
    expect(second).toEqual(['guru'])
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('cache tetap mengembalikan null dengan benar', async () => {
    const cache = new Map<string, string[] | null>()
    mockQuery.mockResolvedValue(createQueryResult([]))

    const first = await getUserInstitutionRole(2, 20, cache)
    const second = await getUserInstitutionRole(2, 20, cache)

    expect(first).toBeNull()
    expect(second).toBeNull()
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('cache berbeda untuk userId+institutionId berbeda', async () => {
    const cache = new Map<string, string[] | null>()
    mockQuery
      .mockResolvedValueOnce(createQueryResult([{ value: 'guru' }]))
      .mockResolvedValueOnce(createQueryResult([{ value: 'kepala_sekolah' }]))

    const result1 = await getUserInstitutionRole(1, 10, cache)
    const result2 = await getUserInstitutionRole(2, 20, cache)

    expect(result1).toEqual(['guru'])
    expect(result2).toEqual(['kepala_sekolah'])
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })
})

// ========================================
// isInstitutionMember
// ========================================

describe('isInstitutionMember', () => {
  it('true jika user memiliki role', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'guru' }]))
    const result = await isInstitutionMember(1, 10)
    expect(result).toBe(true)
  })

  it('false jika user tidak memiliki role (bukan member)', async () => {
    mockQuery.mockResolvedValue(createQueryResult([]))
    const result = await isInstitutionMember(1, 10)
    expect(result).toBe(false)
  })

  it('false jika query error (fail-safe)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'))
    const result = await isInstitutionMember(1, 10)
    expect(result).toBe(false)
  })
})

// ========================================
// canViewAllTeachers
// ========================================

describe('canViewAllTeachers', () => {
  const allowedRoles = ['kepala_sekolah', 'wakasek', 'operator', 'admin_sekolah']

  for (const role of allowedRoles) {
    it(`true untuk role ${role}`, async () => {
      mockQuery.mockResolvedValue(createQueryResult([{ value: role }]))
      const result = await canViewAllTeachers(1, 10)
      expect(result).toBe(true)
    })
  }

  it('false untuk role bendahara', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'bendahara' }]))
    const result = await canViewAllTeachers(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk role guru', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'guru' }]))
    const result = await canViewAllTeachers(1, 10)
    expect(result).toBe(false)
  })

  it('false jika bukan member', async () => {
    mockQuery.mockResolvedValue(createQueryResult([]))
    const result = await canViewAllTeachers(1, 10)
    expect(result).toBe(false)
  })

  it('false jika query error (fail-safe)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'))
    const result = await canViewAllTeachers(1, 10)
    expect(result).toBe(false)
  })

  it('true jika user memiliki multiple role termasuk yang diizinkan', async () => {
    mockQuery.mockResolvedValue(
      createQueryResult([{ value: 'guru' }, { value: 'operator' }])
    )
    const result = await canViewAllTeachers(1, 10)
    expect(result).toBe(true)
  })
})

// ========================================
// canApproveDocuments
// ========================================

describe('canApproveDocuments', () => {
  it('true untuk kepala_sekolah (tanpa mengecek config)', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'kepala_sekolah' }]))
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(true)
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('true untuk wakasek jika approvalLayerConfig = double', async () => {
    mockQuery
      .mockResolvedValueOnce(createQueryResult([{ value: 'wakasek' }]))
      .mockResolvedValueOnce(
        createQueryResult([{ approval_layer_config: 'double' }])
      )
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(true)
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  it('false untuk wakasek jika approvalLayerConfig = single', async () => {
    mockQuery
      .mockResolvedValueOnce(createQueryResult([{ value: 'wakasek' }]))
      .mockResolvedValueOnce(
        createQueryResult([{ approval_layer_config: 'single' }])
      )
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk role operator', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'operator' }]))
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk role bendahara', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'bendahara' }]))
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk role guru', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'guru' }]))
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(false)
  })

  it('false jika bukan member', async () => {
    mockQuery.mockResolvedValue(createQueryResult([]))
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(false)
  })

  it('false jika institusi tidak ditemukan saat cek config', async () => {
    mockQuery
      .mockResolvedValueOnce(createQueryResult([{ value: 'wakasek' }]))
      .mockResolvedValueOnce(createQueryResult([]))
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(false)
  })

  it('false jika query error di langkah config (fail-safe)', async () => {
    mockQuery
      .mockResolvedValueOnce(createQueryResult([{ value: 'wakasek' }]))
      .mockRejectedValueOnce(new Error('DB error'))
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(false)
  })

  it('true untuk user dengan multiple role termasuk kepala_sekolah', async () => {
    mockQuery.mockResolvedValue(
      createQueryResult([{ value: 'guru' }, { value: 'kepala_sekolah' }])
    )
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(true)
  })

  it('false jika query error di langkah awal (fail-safe)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'))
    const result = await canApproveDocuments(1, 10)
    expect(result).toBe(false)
  })
})

// ========================================
// canManageMembers
// ========================================

describe('canManageMembers', () => {
  it('true untuk operator', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'operator' }]))
    const result = await canManageMembers(1, 10)
    expect(result).toBe(true)
  })

  it('true untuk admin_sekolah', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'admin_sekolah' }]))
    const result = await canManageMembers(1, 10)
    expect(result).toBe(true)
  })

  it('false untuk kepala_sekolah', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'kepala_sekolah' }]))
    const result = await canManageMembers(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk wakasek', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'wakasek' }]))
    const result = await canManageMembers(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk bendahara', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'bendahara' }]))
    const result = await canManageMembers(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk guru', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'guru' }]))
    const result = await canManageMembers(1, 10)
    expect(result).toBe(false)
  })

  it('false jika bukan member', async () => {
    mockQuery.mockResolvedValue(createQueryResult([]))
    const result = await canManageMembers(1, 10)
    expect(result).toBe(false)
  })

  it('false jika query error (fail-safe)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'))
    const result = await canManageMembers(1, 10)
    expect(result).toBe(false)
  })
})

// ========================================
// canManageBilling
// ========================================

describe('canManageBilling', () => {
  it('true untuk bendahara', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'bendahara' }]))
    const result = await canManageBilling(1, 10)
    expect(result).toBe(true)
  })

  it('false untuk kepala_sekolah (view-only, bukan manage)', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'kepala_sekolah' }]))
    const result = await canManageBilling(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk operator', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'operator' }]))
    const result = await canManageBilling(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk admin_sekolah', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'admin_sekolah' }]))
    const result = await canManageBilling(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk wakasek', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'wakasek' }]))
    const result = await canManageBilling(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk guru', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'guru' }]))
    const result = await canManageBilling(1, 10)
    expect(result).toBe(false)
  })

  it('false jika bukan member', async () => {
    mockQuery.mockResolvedValue(createQueryResult([]))
    const result = await canManageBilling(1, 10)
    expect(result).toBe(false)
  })

  it('false jika query error (fail-safe)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'))
    const result = await canManageBilling(1, 10)
    expect(result).toBe(false)
  })
})

// ========================================
// canExportAccreditation
// ========================================

describe('canExportAccreditation', () => {
  const allowedRoles = ['kepala_sekolah', 'wakasek', 'operator', 'admin_sekolah']

  for (const role of allowedRoles) {
    it(`true untuk role ${role}`, async () => {
      mockQuery.mockResolvedValue(createQueryResult([{ value: role }]))
      const result = await canExportAccreditation(1, 10)
      expect(result).toBe(true)
    })
  }

  it('false untuk bendahara', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'bendahara' }]))
    const result = await canExportAccreditation(1, 10)
    expect(result).toBe(false)
  })

  it('false untuk guru', async () => {
    mockQuery.mockResolvedValue(createQueryResult([{ value: 'guru' }]))
    const result = await canExportAccreditation(1, 10)
    expect(result).toBe(false)
  })

  it('false jika bukan member', async () => {
    mockQuery.mockResolvedValue(createQueryResult([]))
    const result = await canExportAccreditation(1, 10)
    expect(result).toBe(false)
  })

  it('false jika query error (fail-safe)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'))
    const result = await canExportAccreditation(1, 10)
    expect(result).toBe(false)
  })
})

// ========================================
// withInstitutionPermission Middleware
// ========================================

describe('withInstitutionPermission', () => {
  it('meneruskan ke handler jika permission check lulus', async () => {
    const handler = vi
      .fn()
      .mockResolvedValue({ body: { data: 'ok' }, status: 200 })
    const permissionCheck = vi.fn().mockResolvedValue(true)
    const req = createMockRequest({
      headers: { 'x-user-id': '1', 'x-institution-id': '10' },
    })

    const wrapped = withInstitutionPermission(permissionCheck)(handler)
    const result = await wrapped(req)

    expect(result.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(permissionCheck).toHaveBeenCalledWith(1, 10, expect.any(Map))
  })

  it('mengembalikan 403 jika permission check gagal', async () => {
    const handler = vi.fn()
    const permissionCheck = vi.fn().mockResolvedValue(false)
    const req = createMockRequest({
      headers: { 'x-user-id': '1', 'x-institution-id': '10' },
    })

    const wrapped = withInstitutionPermission(permissionCheck)(handler)
    const result = await wrapped(req)

    expect(result.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('mengembalikan 400 jika institutionId tidak ditemukan', async () => {
    const handler = vi.fn()
    const permissionCheck = vi.fn()
    const req = createMockRequest({ headers: { 'x-user-id': '1' } })

    const wrapped = withInstitutionPermission(permissionCheck)(handler)
    const result = await wrapped(req)

    expect(result.status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
  })

  it('mengembalikan 401 jika userId tidak ditemukan', async () => {
    const handler = vi.fn()
    const permissionCheck = vi.fn()
    const req = createMockRequest({
      headers: { 'x-institution-id': '10' },
    })

    const wrapped = withInstitutionPermission(permissionCheck)(handler)
    const result = await wrapped(req)

    expect(result.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('menggunakan custom getUserId dan getInstitutionId jika diberikan', async () => {
    const handler = vi
      .fn()
      .mockResolvedValue({ body: { data: 'ok' }, status: 200 })
    const permissionCheck = vi.fn().mockResolvedValue(true)

    const getUserId = vi.fn().mockResolvedValue(42)
    const getInstitutionId = vi.fn().mockResolvedValue(99)

    const req = createMockRequest()

    const wrapped = withInstitutionPermission(permissionCheck, {
      getUserId,
      getInstitutionId,
    })(handler)
    const result = await wrapped(req)

    expect(result.status).toBe(200)
    expect(getUserId).toHaveBeenCalledWith(req)
    expect(getInstitutionId).toHaveBeenCalledWith(req, undefined)
    expect(permissionCheck).toHaveBeenCalledWith(42, 99, expect.any(Map))
  })

  it('membuat cache baru per request', async () => {
    const handler = vi
      .fn()
      .mockResolvedValue({ body: { data: 'ok' }, status: 200 })
    const permissionCheck = vi.fn().mockResolvedValue(true)
    const req = createMockRequest({
      headers: { 'x-user-id': '1', 'x-institution-id': '10' },
    })

    const wrapped = withInstitutionPermission(permissionCheck)(handler)

    await wrapped(req)
    await wrapped(req)

    const firstCache = permissionCheck.mock.calls[0][2]
    const secondCache = permissionCheck.mock.calls[1][2]
    expect(firstCache).not.toBe(secondCache)
  })

  it('mengembalikan 500 jika terjadi error di middleware', async () => {
    const handler = vi.fn()
    const permissionCheck = vi.fn().mockRejectedValue(new Error('Unexpected'))
    const req = createMockRequest({
      headers: { 'x-user-id': '1', 'x-institution-id': '10' },
    })

    const wrapped = withInstitutionPermission(permissionCheck)(handler)
    const result = await wrapped(req)

    expect(result.status).toBe(500)
    const data = await result.json()
    expect(data.error).toBe('Unexpected')
  })

  it('mengembalikan 500 jika error tanpa message', async () => {
    const handler = vi.fn()
    const permissionCheck = vi.fn().mockRejectedValue(undefined)
    const req = createMockRequest({
      headers: { 'x-user-id': '1', 'x-institution-id': '10' },
    })

    const wrapped = withInstitutionPermission(permissionCheck)(handler)
    const result = await wrapped(req)

    expect(result.status).toBe(500)
  })

  it('mendukung custom extractor yang mengembalikan null', async () => {
    const handler = vi.fn()
    const permissionCheck = vi.fn()
    const getUserId = vi.fn().mockResolvedValue(null)

    const req = createMockRequest({
      headers: { 'x-institution-id': '10' },
    })

    const wrapped = withInstitutionPermission(permissionCheck, {
      getUserId,
    })(handler)
    const result = await wrapped(req)

    expect(result.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('extract institutionId dari query params', async () => {
    const handler = vi
      .fn()
      .mockResolvedValue({ body: { data: 'ok' }, status: 200 })
    const permissionCheck = vi.fn().mockResolvedValue(true)
    const req = createMockRequest({
      headers: { 'x-user-id': '1' },
      query: { institutionId: '20' },
    })

    const wrapped = withInstitutionPermission(permissionCheck)(handler)
    const result = await wrapped(req)

    expect(result.status).toBe(200)
    expect(permissionCheck).toHaveBeenCalledWith(1, 20, expect.any(Map))
  })

  it('extract institutionId dari request body (POST)', async () => {
    const handler = vi
      .fn()
      .mockResolvedValue({ body: { data: 'ok' }, status: 200 })
    const permissionCheck = vi.fn().mockResolvedValue(true)
    const req = createMockRequest({
      method: 'POST',
      headers: { 'x-user-id': '1' },
      body: { institutionId: '30' },
    })

    const wrapped = withInstitutionPermission(permissionCheck)(handler)
    const result = await wrapped(req)

    expect(result.status).toBe(200)
    expect(permissionCheck).toHaveBeenCalledWith(1, 30, expect.any(Map))
  })
})
