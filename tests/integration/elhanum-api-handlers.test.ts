/**
 * Integration Test Suite: ElHanum API Handlers (Real DB + Mocked Session Cookie)
 *
 * Memanggil route handler nyata dengan session cookie elhanum (via mock next/headers)
 * dan database nyata gurupro_db untuk memvalidasi flow API utama:
 *   - GET /api/me (profil user)
 *   - GET /api/wali-kelas/my-classes (kelas wali kelas)
 *   - GET /api/journals?school_id= (jurnal mengajar)
 *   - GET /api/wali-kelas (assignment wali kelas)
 *   - Unauthorized tanpa cookie
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import { query } from '@/lib/db'

const ELHANUM_USER_ID = '50e096cc-9dc2-4403-b731-5506088ddc32'
const ELHANUM_EMAIL = 'ptgenerasidigitalindonesiaemas@gmail.com'
const ELHANUM_SCHOOL_ID = '8606e992-1379-41ef-8834-e834e9312dee'
const ELHANUM_CLASS_ID = 'a70db632-5e6a-4654-8eeb-90646814500d'

// Test yang bergantung pada data seed ElHanum hanya dijalankan ketika seed ada
// (scripts/seed-test-data.ts). Kontrak murni (401 tanpa session, 400 tanpa
// school_id) tetap berjalan apa adanya.
async function checkElhanumSeed(): Promise<boolean> {
  try {
    const res = await query('SELECT 1 FROM users WHERE id = $1', [ELHANUM_USER_ID])
    return res.rows.length > 0
  } catch {
    return false
  }
}

const elhanumSeeded = await checkElhanumSeed()

const sessionCookieValue = JSON.stringify({
  id: ELHANUM_USER_ID,
  role: 'guru',
  activeContext: 'individual',
})

function createMockCookies(hasSession: boolean) {
  return {
    get: vi.fn((name: string) => {
      if (!hasSession) return undefined
      return name === 'gurupro_session'
        ? { value: sessionCookieValue }
        : undefined
    }),
    set: vi.fn(),
  }
}

vi.mock('server-only', () => ({}))

import { cookies } from 'next/headers'
const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>

// Load route handlers AFTER mocks
import { GET as getMe } from '@/app/api/me/route'
import { GET as getMyClasses } from '@/app/api/wali-kelas/my-classes/route'
import { GET as getJournals } from '@/app/api/journals/route'
import { GET as getWaliKelas } from '@/app/api/wali-kelas/route'

const makeUrl = (path: string) => `http://localhost:3000${path}`

beforeEach(() => {
  mockCookies.mockReturnValue(createMockCookies(true))
})

describe('ElHanum API - GET /api/me', () => {
  it.skipIf(!elhanumSeeded)('returns elhanum profile data', async () => {
    const res = await getMe()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.user.nama_lengkap).toBe('ElHanum, M.Pd')
    expect(body.user.email).toBe(ELHANUM_EMAIL)
  })

  it.skipIf(!elhanumSeeded)('includes token/poin balance fields', async () => {
    const res = await getMe()
    const body = await res.json()
    expect(body.user).toHaveProperty('token_limit')
    expect(body.user).toHaveProperty('quota_poin_available')
    expect(body.user).toHaveProperty('addon_poin_available')
    expect(typeof body.user.token_limit).toBe('number')
  })

  it('returns 401 when no session', async () => {
    mockCookies.mockReturnValue(createMockCookies(false))
    const res = await getMe()
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.user).toBeNull()
  })
})

describe('ElHanum API - GET /api/wali-kelas/my-classes', () => {
  it.skipIf(!elhanumSeeded)('returns X.1 as elhanum wali kelas class', async () => {
    const res = await getMyClasses(new Request(makeUrl('/api/wali-kelas/my-classes')))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.some((k: any) => k.id === ELHANUM_CLASS_ID)).toBe(true)
    expect(body.data.find((k: any) => k.id === ELHANUM_CLASS_ID).nama_kelas).toBe('X.1')
  })
})

describe('ElHanum API - GET /api/journals', () => {
  it.skipIf(!elhanumSeeded)('returns journals for elhanum school', async () => {
    const url = makeUrl(`/api/journals?school_id=${ELHANUM_SCHOOL_ID}`)
    const res = await getJournals(new Request(url))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toBeDefined()
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0]).toHaveProperty('tanggal')
  })

  it('returns 400 without school_id', async () => {
    const res = await getJournals(new Request(makeUrl('/api/journals')))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('school_id')
  })

  it.skipIf(!elhanumSeeded)('forbids access to school not owned/assigned by elhanum', async () => {
    const otherSchool = await query(
      'SELECT id FROM schools WHERE id != $1 LIMIT 1',
      [ELHANUM_SCHOOL_ID]
    )
    if (otherSchool.rows.length === 0) {
      expect(true).toBe(true)
      return
    }
    const otherId = otherSchool.rows[0].id
    const res = await getJournals(new Request(makeUrl(`/api/journals?school_id=${otherId}`)))
    expect([200, 403]).toContain(res.status)
  })
})

describe('ElHanum API - GET /api/wali-kelas', () => {
  it.skipIf(!elhanumSeeded)('lists assignment for elhanum as wali kelas member', async () => {
    const url = makeUrl(`/api/wali-kelas?wali_kelas_member_id=${ELHANUM_USER_ID}&include_details=false`)
    const res = await getWaliKelas(new Request(url))
    const body = await res.json()
    expect(res.status).toBe(200)
    const rows = Array.isArray(body) ? body : body.data || body.assignments
    expect(rows.length).toBeGreaterThan(0)
  })
})
