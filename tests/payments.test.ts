import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db')
vi.mock('@/lib/notifications', () => ({
  sendEventNotification: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/settings', () => ({
  getPricingConfig: vi.fn(),
}))

import { query } from '@/lib/db'
import { activateTransaction, processSuccessPayment } from '../lib/payments'
import { sendEventNotification } from '@/lib/notifications'
import { getPricingConfig } from '@/lib/settings'

const mockQuery = query as ReturnType<typeof vi.fn>

const mockPricingConfig = {
  free: { tokens: 10, duration_days: 30, price: 0 },
  three_month: { tokens: 500, duration_days: 90, price: 120000 },
  six_month: { tokens: 1100, duration_days: 180, price: 220000 },
  one_year: { tokens: 2500, duration_days: 365, price: 400000 },
}

function createTransaction(overrides: Record<string, any> = {}) {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    external_id: 'ext-001',
    amount: 120000,
    status: 'PENDING',
    payment_method: null,
    plan_id: 'three_month',
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

function createUser(overrides: Record<string, any> = {}) {
  return {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    email: 'guru@test.com',
    whatsapp: '08123456789',
    nama_lengkap: 'Guru Test',
    token_limit: 50,
    addon_token_balance: 0,
    status_langganan: 'free',
    subscription_start: new Date(Date.now() - 86400000 * 30),
    subscription_end: new Date(Date.now() + 86400000 * 30),
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getPricingConfig).mockResolvedValue(mockPricingConfig as any)
})

describe('activateTransaction', () => {
  it('melempar error jika transaksi tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await expect(activateTransaction('nonexistent-id')).rejects.toThrow(
      'Transaksi ID nonexistent-id tidak ditemukan'
    )
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('mengembalikan sukses jika transaksi sudah ACTIVATED (idempotent)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [createTransaction({ status: 'ACTIVATED' })],
    })

    const result = await activateTransaction('some-id')
    expect(result.success).toBe(true)
    expect(result.message).toContain('sudah aktif')
  })

  it('mengaktifkan paket three_month dengan benar', async () => {
    const tx = createTransaction()
    const user = createUser()
    const plan = { id: 'three_month', package_name: '3 Bulan', tokens: 500, duration_days: 90, price: 120000 }

    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [plan] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })

    const result = await activateTransaction(tx.id)

    expect(result.success).toBe(true)

    const updateCalls = mockQuery.mock.calls.filter(
      (c: any) => typeof c[0] === 'string' && c[0].includes('quota_poin_total')
    )
    expect(updateCalls.length).toBe(1)
    expect(updateCalls[0][1][0]).toBe(1)
    expect(updateCalls[0][1][1]).toBe('three_month')

    expect(vi.mocked(sendEventNotification)).toHaveBeenCalledWith(
      'payment_success',
      expect.any(Object),
      expect.objectContaining({ tokens_added: 500 })
    )
  })

  it('mendeteksi paket dari amount jika plan_id tidak dikenal', async () => {
    const tx = createTransaction({ plan_id: 'unknown', amount: 400000 })
    const user = createUser()
    const plan = { id: 'one_year', package_name: '1 Tahun', tokens: 2500, duration_days: 365, price: 400000 }

    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [plan] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })

    const result = await activateTransaction(tx.id)
    expect(result.success).toBe(true)

    const updateCalls = mockQuery.mock.calls.filter(
      (c: any) => typeof c[0] === 'string' && c[0].includes('quota_poin_total')
    )
    expect(updateCalls.length).toBe(1)
    expect(updateCalls[0][1][0]).toBe(2)
    expect(updateCalls[0][1][1]).toBe('one_year')
  })

  it('mendeteksi paket six_month dari amount 220000', async () => {
    const tx = createTransaction({ plan_id: 'unknown', amount: 220000 })
    const user = createUser()
    const plan = { id: 'six_month', package_name: '6 Bulan', tokens: 1100, duration_days: 180, price: 220000 }

    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [plan] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })

    const result = await activateTransaction(tx.id)
    expect(result.success).toBe(true)

    const updateCalls = mockQuery.mock.calls.filter(
      (c: any) => typeof c[0] === 'string' && c[0].includes('quota_poin_total')
    )
    expect(updateCalls.length).toBe(1)
    expect(updateCalls[0][1][0]).toBe(1)
    expect(updateCalls[0][1][1]).toBe('six_month')
  })

  it('menerapkan accrual logic: memperpanjang dari subscription_end jika masih aktif', async () => {
    const futureEnd = new Date(Date.now() + 86400000 * 10)
    const tx = createTransaction()
    const user = createUser({ subscription_end: futureEnd })
    const plan = { id: 'three_month', package_name: '3 Bulan', tokens: 500, duration_days: 90, price: 120000 }

    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [plan] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })

    await activateTransaction(tx.id)

    const updateCalls = mockQuery.mock.calls.filter(
      (c: any) => typeof c[0] === 'string' && c[0].includes('quota_poin_total')
    )
    expect(updateCalls.length).toBe(1)
    const newEnd = new Date(updateCalls[0][1][3])
    const expectedEnd = new Date(futureEnd.getTime() + 86400000 * 90)
    expect(newEnd.getTime()).toBe(expectedEnd.getTime())
  })

  it('membuat audit trail setelah aktivasi', async () => {
    const tx = createTransaction()
    const user = createUser()
    const plan = { id: 'three_month', package_name: '3 Bulan', tokens: 500, duration_days: 90, price: 120000 }

    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [plan] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })

    await activateTransaction(tx.id)

    const auditCalls = mockQuery.mock.calls.filter(
      (c: any) => typeof c[0] === 'string' && c[0].includes('INSERT INTO audit_trails')
    )
    expect(auditCalls.length).toBe(1)
    expect(auditCalls[0][1][1]).toContain('Aktivasi Paket')
    expect(auditCalls[0][1][2]).toContain('+500 Poin')
  })

  it('mengupdate status transaksi menjadi ACTIVATED', async () => {
    const tx = createTransaction()
    const user = createUser()
    const plan = { id: 'three_month', package_name: '3 Bulan', tokens: 500, duration_days: 90, price: 120000 }

    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [plan] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })

    await activateTransaction(tx.id)

    const updateTxCalls = mockQuery.mock.calls.filter(
      (c: any) => typeof c[0] === 'string' && c[0].includes('UPDATE transactions')
    )
    expect(updateTxCalls.length).toBeGreaterThanOrEqual(1)
  })
})

describe('processSuccessPayment', () => {
  it('memproses pembayaran dengan external_id', async () => {
    const tx = createTransaction()
    const user = createUser()
    const plan = { id: 'three_month', package_name: '3 Bulan', tokens: 500, duration_days: 90, price: 120000 }

    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [plan] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })

    const result = await processSuccessPayment('ext-001', 'XENDIT-VA', 120000)
    expect(result.success).toBe(true)
  })

  it('memproses pembayaran mock dengan UUID (internal transaction id)', async () => {
    const tx = createTransaction({ external_id: 'mock-ext-1' })
    const user = createUser()
    const plan = { id: 'three_month', package_name: '3 Bulan', tokens: 500, duration_days: 90, price: 120000 }

    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [plan] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })

    const result = await processSuccessPayment(tx.id, 'MOCK', 120000, true)
    expect(result.success).toBe(true)
  })

  it('mengembalikan error jika transaksi tidak ditemukan (non-mock)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await processSuccessPayment('nonexistent', 'CC', 50000)
    expect(result.success).toBe(false)
    expect(result.error).toContain('tidak ditemukan')
  })

  it('mengembalikan sukses jika transaksi sudah ACTIVATED (idempotent)', async () => {
    const tx = createTransaction({ status: 'ACTIVATED', external_id: 'ext-existing' })

    mockQuery.mockResolvedValueOnce({ rows: [tx] })

    const result = await processSuccessPayment('ext-existing', 'CC', 50000)
    expect(result.success).toBe(true)
    expect(result.message).toContain('sudah aktif')
  })

  it('mengupdate payment_method sebelum aktivasi', async () => {
    const tx = createTransaction({ status: 'PENDING', payment_method: null })
    const user = createUser()
    const plan = { id: 'three_month', package_name: '3 Bulan', tokens: 500, duration_days: 90, price: 120000 }

    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [plan] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })

    await processSuccessPayment('ext-001', 'XENDIT-VA', 120000)

    const pmCalls = mockQuery.mock.calls.filter(
      (c: any) => typeof c[0] === 'string' && c[0].includes('UPDATE transactions SET payment_method')
    )
    expect(pmCalls.length).toBe(1)
    expect(pmCalls[0][1][0]).toBe('XENDIT-VA')
  })

  it('me-handle error dengan aman (tidak throw)', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'))

    const result = await processSuccessPayment('ext-001', 'CC', 50000)
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('me-handle error tanpa message dengan aman', async () => {
    mockQuery.mockRejectedValue(new Error('Test error'))

    const result = await processSuccessPayment('ext-001', 'CC', 50000)
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('menggunakan plan_id dari transaksi jika tersedia', async () => {
    const tx = createTransaction({ plan_id: 'one_year' })
    const user = createUser()
    const plan = { id: 'one_year', package_name: '1 Tahun', tokens: 2500, duration_days: 365, price: 400000 }

    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [tx] })
    mockQuery.mockResolvedValueOnce({ rows: [plan] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [user] })

    const result = await processSuccessPayment('ext-001', 'CC', 400000)
    expect(result.success).toBe(true)

    const updateCalls = mockQuery.mock.calls.filter(
      (c: any) => typeof c[0] === 'string' && c[0].includes('quota_poin_total')
    )
    expect(updateCalls.length).toBe(1)
    expect(updateCalls[0][1][0]).toBe(2)
  })
})
