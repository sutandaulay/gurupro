import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
vi.mock('@/lib/db', () => ({ query: (...args: any[]) => mockQuery(...args) }))

import { getApprovalLayer, hasWakasek, getLeaderRoles } from '../lib/approval-config'
import { logApprovalAction } from '../lib/approval-notifications'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getApprovalLayer', () => {
  it('default single untuk institutionId null', async () => {
    expect(await getApprovalLayer(null)).toBe('single')
  })

  it('membaca approval_layer_config dari institusi', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ approval_layer_config: 'double' }] })
    expect(await getApprovalLayer(42)).toBe('double')
  })

  it('fallback single bila kolom/query gagal', async () => {
    mockQuery.mockRejectedValueOnce(new Error('boom'))
    expect(await getApprovalLayer(42)).toBe('single')
  })
})

describe('hasWakasek', () => {
  it('true bila ada wakasek aktif', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })
    expect(await hasWakasek(7)).toBe(true)
  })

  it('false bila tidak ada', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    expect(await hasWakasek(7)).toBe(false)
  })

  it('false bila query gagal', async () => {
    mockQuery.mockRejectedValueOnce(new Error('boom'))
    expect(await hasWakasek(7)).toBe(false)
  })
})

describe('getLeaderRoles', () => {
  it('mengembalikan daftar role kepala_sekolah/wakasek', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'wakasek' }, { role: 'kepala_sekolah' }] })
    const roles = await getLeaderRoles('user-1', 9)
    expect(roles).toEqual(['wakasek', 'kepala_sekolah'])
  })
})

describe('logApprovalAction', () => {
  it('menulis baris audit trail', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await logApprovalAction({
      docId: 'doc-1',
      actorUserId: 'user-1',
      actorName: 'Budi',
      action: 'approve',
      note: 'Oke',
      institutionId: 5,
    })
    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [, params] = mockQuery.mock.calls[0]
    expect(params[3]).toBe('approve')
    expect(params[4]).toBe('Oke')
    expect(params[5]).toBe(5)
  })

  it('tidak melempar error bila insert gagal', async () => {
    mockQuery.mockRejectedValueOnce(new Error('boom'))
    await expect(
      logApprovalAction({ docId: 'doc-1', actorUserId: 'user-1', actorName: 'Budi', action: 'submit' })
    ).resolves.toBeUndefined()
  })
})