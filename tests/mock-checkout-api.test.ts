import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  pool: {},
  query: vi.fn(),
}))

vi.mock('@/lib/payments', () => ({
  processSuccessPayment: vi.fn(),
}))

import { query } from '@/lib/db'
import { processSuccessPayment } from '@/lib/payments'
import { GET } from '@/app/api/checkout/mock/route'
import { NextResponse } from 'next/server'

const mockQuery = query as ReturnType<typeof vi.fn>
const mockProcessSuccessPayment = processSuccessPayment as ReturnType<typeof vi.fn>

describe('Mock Checkout API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 400 when invoice_id or userId is missing', async () => {
    const req = new Request('http://localhost:3000/api/checkout/mock')
    const response = await GET(req)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing invoice_id or userId')
  })

  it('returns 404 when transaction not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    
    const req = new Request('http://localhost:3000/api/checkout/mock?invoice_id=non-existent&userId=50e096cc-9dc2-4403-b731-5506088ddc32')
    const response = await GET(req)
    const data = await response.json()
    
    expect(response.status).toBe(404)
    expect(data.error).toBe('Transaction not found')
  })

  it('returns success when transaction already paid', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'tx-1', user_id: 'user-1', plan_id: 'pro', status: 'PAID', amount: 50000 }]
    })
    
    const req = new Request('http://localhost:3000/api/checkout/mock?invoice_id=tx-1&userId=user-1')
    const response = await GET(req)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.redirect).toContain('payment=success')
  })

  it('processes mock payment successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'tx-new', user_id: 'user-1', plan_id: 'pro_monthly', status: 'PENDING', amount: 50000 }]
      })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE transactions
    
    mockProcessSuccessPayment.mockResolvedValueOnce({ success: true })
    
    const req = new Request('http://localhost:3000/api/checkout/mock?invoice_id=tx-new&userId=user-1&payment_method=QRIS')
    const response = await GET(req)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockProcessSuccessPayment).toHaveBeenCalledWith('tx-new', 'MOCK', 0, true)
  })

  it('handles processSuccessPayment failure', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'tx-fail', user_id: 'user-1', plan_id: 'pro', status: 'PENDING', amount: 50000 }]
      })
      .mockResolvedValueOnce({ rows: [] })
    
    mockProcessSuccessPayment.mockResolvedValueOnce({ success: false, error: 'Activation failed' })
    
    const req = new Request('http://localhost:3000/api/checkout/mock?invoice_id=tx-fail&userId=user-1')
    const response = await GET(req)
    const data = await response.json()
    
    expect(response.status).toBe(500)
    expect(data.error).toBe('Activation failed')
  })

  it('handles database errors gracefully', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection failed'))
    
    const req = new Request('http://localhost:3000/api/checkout/mock?invoice_id=tx-err&userId=user-1')
    const response = await GET(req)
    const data = await response.json()
    
    expect(response.status).toBe(500)
    expect(data.error).toContain('DB connection failed')
  })
})