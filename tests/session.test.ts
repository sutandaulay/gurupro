import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCookieGet = vi.fn()
const mockCookieSet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => mockCookieGet(name),
    set: (name: string, value: string, opts?: any) => mockCookieSet(name, value, opts),
  }),
}))

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
vi.mock('@/lib/auth.config', () => ({ authOptions: {} }))
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/institution-members', () => ({
  getUserActiveMemberships: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { getUserActiveMemberships } from '@/lib/institution-members'
import { query } from '@/lib/db'
const mockQuery = query as ReturnType<typeof vi.fn>

import {
  getSession,
  requireSession,
  getActiveContext,
  setActiveContext,
  setDefaultSessionCookie,
  getContextFilters,
} from '../lib/session'

function createCookie(value: string) {
  return { name: 'gurupro_session', value }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getSession', () => {
  it('membaca session dari gurupro_session cookie', async () => {
    const sessionData = { id: 'user-1', role: 'guru', activeContext: 'individual' }
    mockCookieGet.mockReturnValue(createCookie(JSON.stringify(sessionData)))

    const result = await getSession()
    expect(result).toEqual(sessionData)
  })

  it('mengembalikan null jika cookie tidak ada', async () => {
    mockCookieGet.mockReturnValue(undefined)
    const result = await getSession()
    expect(result).toBeNull()
  })

  it('mengembalikan null jika cookie invalid JSON', async () => {
    mockCookieGet.mockReturnValue(createCookie('not-json'))
    const result = await getSession()
    expect(result).toBeNull()
  })

  it('fallback ke NextAuth session jika cookie tidak ada', async () => {
    mockCookieGet.mockReturnValue(undefined)
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { email: 'guru@test.com' },
    } as any)
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'user-1', role: 'guru' }],
    })

    const result = await getSession()
    expect(result).not.toBeNull()
    expect(result!.id).toBe('user-1')
    expect(result!.role).toBe('guru')

    expect(mockCookieSet).toHaveBeenCalledWith(
      'gurupro_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: '/' })
    )
  })

  it('mengembalikan null jika NextAuth session tidak punya email', async () => {
    mockCookieGet.mockReturnValue(undefined)
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {},
    } as any)

    const result = await getSession()
    expect(result).toBeNull()
  })

  it('mengembalikan null jika NextAuth gagal', async () => {
    mockCookieGet.mockReturnValue(undefined)
    vi.mocked(getServerSession).mockRejectedValueOnce(new Error('NextAuth error'))

    const result = await getSession()
    expect(result).toBeNull()
  })

  it('mengembalikan null jika user tidak ditemukan di DB (NextAuth fallback)', async () => {
    mockCookieGet.mockReturnValue(undefined)
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { email: 'unknown@test.com' },
    } as any)
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await getSession()
    expect(result).toBeNull()
  })
})

describe('requireSession', () => {
  it('mengembalikan session jika valid', async () => {
    const sessionData = { id: 'user-1', role: 'guru', activeContext: 'individual' }
    mockCookieGet.mockReturnValue(createCookie(JSON.stringify(sessionData)))

    const result = await requireSession()
    expect(result).toEqual(sessionData)
  })

  it('melempar error jika tidak ada session', async () => {
    mockCookieGet.mockReturnValue(undefined)
    vi.mocked(getServerSession).mockResolvedValueOnce(null)

    await expect(requireSession()).rejects.toThrow('Unauthorized')
  })
})

describe('getActiveContext', () => {
  it('mengembalikan activeContext dari session', async () => {
    const sessionData = { id: 'user-1', role: 'guru', activeContext: { institutionId: 5 } }
    mockCookieGet.mockReturnValue(createCookie(JSON.stringify(sessionData)))

    const result = await getActiveContext()
    expect(result).toEqual({ institutionId: 5 })
  })

  it('mengembalikan undefined jika session tidak memiliki activeContext', async () => {
    const sessionData = { id: 'user-1', role: 'guru' }
    mockCookieGet.mockReturnValue(createCookie(JSON.stringify(sessionData)))

    const result = await getActiveContext()
    expect(result).toBeUndefined()
  })

  it('mengembalikan undefined jika session tidak ada', async () => {
    mockCookieGet.mockReturnValue(undefined)
    vi.mocked(getServerSession).mockResolvedValueOnce(null)

    const result = await getActiveContext()
    expect(result).toBeUndefined()
  })
})

describe('setActiveContext', () => {
  it('mengupdate activeContext di cookie', async () => {
    const sessionData = { id: 'user-1', role: 'guru', activeContext: 'individual' }
    mockCookieGet.mockReturnValue(createCookie(JSON.stringify(sessionData)))

    await setActiveContext({ institutionId: 10 })

    expect(mockCookieSet).toHaveBeenCalledWith(
      'gurupro_session',
      expect.stringContaining('"institutionId":10'),
      expect.objectContaining({ httpOnly: true })
    )
  })

  it('tidak melakukan apa-apa jika session cookie tidak ada', async () => {
    mockCookieGet.mockReturnValue(undefined)

    await setActiveContext({ institutionId: 10 })
    expect(mockCookieSet).not.toHaveBeenCalled()
  })

  it('dapat mengembalikan context ke individual', async () => {
    const sessionData = { id: 'user-1', role: 'guru', activeContext: { institutionId: 5 } }
    mockCookieGet.mockReturnValue(createCookie(JSON.stringify(sessionData)))

    await setActiveContext('individual')

    expect(mockCookieSet).toHaveBeenCalledWith(
      'gurupro_session',
      expect.not.stringContaining('institutionId'),
      expect.objectContaining({ httpOnly: true })
    )
  })
})

describe('setDefaultSessionCookie', () => {
  it('menyimpan session dengan default activeContext = individual', async () => {
    await setDefaultSessionCookie({ id: 'user-1', role: 'guru' })

    expect(mockCookieSet).toHaveBeenCalledWith(
      'gurupro_session',
      expect.stringContaining('"activeContext":"individual"'),
      expect.objectContaining({ maxAge: 60 * 60 * 24 * 7 })
    )
  })
})

describe('getContextFilters', () => {
  it('mengembalikan filter default jika activeContext = individual', async () => {
    const sessionData = { id: 'user-1', role: 'guru', activeContext: 'individual' }
    mockCookieGet.mockReturnValue(createCookie(JSON.stringify(sessionData)))

    const result = await getContextFilters('user-1')
    expect(result).toEqual({ institutionId: null, assignedMapel: [], assignedKelas: [] })
  })

  it('mengembalikan filter default jika tidak ada activeContext', async () => {
    const sessionData = { id: 'user-1', role: 'guru' }
    mockCookieGet.mockReturnValue(createCookie(JSON.stringify(sessionData)))

    const result = await getContextFilters('user-1')
    expect(result.institutionId).toBeNull()
  })

  it('mengisi assignedMapel dan assignedKelas jika ada membership', async () => {
    const sessionData = { id: 'user-1', role: 'guru', activeContext: { institutionId: 5 } }
    mockCookieGet.mockReturnValue(createCookie(JSON.stringify(sessionData)))

    vi.mocked(getUserActiveMemberships).mockResolvedValueOnce([
      { id: 100, institution_id: 5 },
    ] as any)

    mockQuery
      .mockResolvedValueOnce({ rows: [{ mapel: 'Matematika' }, { mapel: 'IPA' }] })
      .mockResolvedValueOnce({ rows: [{ kelas: 'VII-A' }, { kelas: 'VII-B' }] })

    const result = await getContextFilters('user-1')
    expect(result.institutionId).toBe(5)
    expect(result.assignedMapel).toEqual(['Matematika', 'IPA'])
    expect(result.assignedKelas).toEqual(['VII-A', 'VII-B'])
  })

  it('mengembalikan filter kosong jika user tidak punya membership di institution tersebut', async () => {
    const sessionData = { id: 'user-1', role: 'guru', activeContext: { institutionId: 5 } }
    mockCookieGet.mockReturnValue(createCookie(JSON.stringify(sessionData)))

    vi.mocked(getUserActiveMemberships).mockResolvedValueOnce([
      { id: 100, institution_id: 999 },
    ] as any)

    const result = await getContextFilters('user-1')
    expect(result.institutionId).toBe(5)
    expect(result.assignedMapel).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
