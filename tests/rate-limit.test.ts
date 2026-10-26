/**
 * Rate limiter test suite — verifies in-memory store behaviour and header generation.
 * The PostgreSQL path is tested conceptually via the factory (DB path uses the same interface).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('createRateLimiter in-memory store', () => {
  // Ensure test env uses in-memory path
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns { limitExceeded: false } on first request', async () => {
    const { createRateLimiter } = await import('@/lib/rate-limit')
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 })

    const mockReq = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })

    const result = await limiter.check(mockReq)
    expect(result.limitExceeded).toBe(false)
    expect(result.remaining).toBe(4)
    expect(result.limit).toBe(5)
  })

  it('tracks request count across multiple calls', async () => {
    const { createRateLimiter } = await import('@/lib/rate-limit')
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 })

    // Dedicated IP — the in-memory store is shared across the whole file.
    const req = () =>
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '10.0.0.21' },
      })

    for (let i = 0; i < 5; i++) {
      const result = await limiter.check(req())
      expect(result.limitExceeded).toBe(false)
      expect(result.remaining).toBe(4 - i)
    }
  })

  it('sets limitExceeded=true and correct retryAfter when max is reached', async () => {
    const { createRateLimiter } = await import('@/lib/rate-limit')
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 })

    const req = (ip: string) =>
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': ip },
      })

    // Hit the limit
    for (let i = 0; i < 3; i++) {
      await limiter.check(req('10.0.0.99'))
    }

    // 4th request should be blocked
    const result = await limiter.check(req('10.0.0.99'))
    expect(result.limitExceeded).toBe(true)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeDefined()
    expect(typeof result.retryAfter).toBe('number')
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('enforces per-IP isolation — one IP exceeding limit does not affect others', async () => {
    const { createRateLimiter } = await import('@/lib/rate-limit')
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 })

    const req = (ip: string) =>
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': ip },
      })

    // Exhaust IP A's limit
    await limiter.check(req('10.0.0.100'))
    await limiter.check(req('10.0.0.100'))

    // IP B should still be fine
    const result = await limiter.check(req('10.0.0.200'))
    expect(result.limitExceeded).toBe(false)
    expect(result.remaining).toBe(1)
  })

  it('applies keyPrefix to isolate different limiter instances', async () => {
    const { createRateLimiter } = await import('@/lib/rate-limit')
    const strict = createRateLimiter({ windowMs: 60_000, max: 2, keyPrefix: 'strict' })
    const global = createRateLimiter({ windowMs: 60_000, max: 2, keyPrefix: 'api' })

    const req = () =>
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      })

    // Exhaust strict limiter
    await strict.check(req())
    await strict.check(req())

    // Global limiter is independent — should not be affected
    const result = await global.check(req())
    expect(result.limitExceeded).toBe(false)
  })
})

describe('rateLimitHeaders helper', () => {
  it('includes limit and remaining headers', async () => {
    const { rateLimitHeaders } = await import('@/lib/rate-limit')

    const headers = rateLimitHeaders({
      limitExceeded: false,
      remaining: 199,
      limit: 200,
    })

    expect(headers['X-RateLimit-Limit']).toBe('200')
    expect(headers['X-RateLimit-Remaining']).toBe('199')
    expect(headers).not.toHaveProperty('Retry-After')
  })

  it('includes Retry-After header when limit is exceeded', async () => {
    const { rateLimitHeaders } = await import('@/lib/rate-limit')

    const headers = rateLimitHeaders({
      limitExceeded: true,
      remaining: 0,
      limit: 10,
      retryAfter: 30,
    })

    expect(headers['X-RateLimit-Limit']).toBe('10')
    expect(headers['X-RateLimit-Remaining']).toBe('0')
    expect(headers['Retry-After']).toBe('30')
  })
})

describe('Pre-configured limiters have sensible defaults', () => {
  it('globalRateLimiter allows 200 req/min', async () => {
    const { globalRateLimiter } = await import('@/lib/rate-limit')
    expect(globalRateLimiter).toBeDefined()
    // Verify the factory pattern works
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const result = await globalRateLimiter.check(req)
    expect(result.limit).toBe(200)
    expect(result.remaining).toBe(199)
  })

  it('strictRateLimiter allows 10 req/min', async () => {
    const { strictRateLimiter } = await import('@/lib/rate-limit')
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const result = await strictRateLimiter.check(req)
    expect(result.limit).toBe(10)
  })

  it('aiRateLimiter allows 60 req/min', async () => {
    const { aiRateLimiter } = await import('@/lib/rate-limit')
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const result = await aiRateLimiter.check(req)
    expect(result.limit).toBe(60)
  })
})
