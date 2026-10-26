/**
 * API Error sanitization tests — verifies errorResponse() produces safe,
 * user-facing messages for a range of error types.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

describe('errorResponse (lib/api-error)', () => {
  it('maps status 401 for Unauthorized errors', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const result = errorResponse(new Error('Unauthorized'))
    expect(result.status).toBe(401)
    expect(result.body.error).toBe('Unauthorized')
  })

  it('maps status 401 for UNAUTHORIZED code', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const err = new Error('Session expired')
    ;(err as any).code = 'UNAUTHORIZED'
    const result = errorResponse(err)
    expect(result.status).toBe(401)
  })

  it('maps status 403 when err.status is 403', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const err = new Error('Forbidden')
    ;(err as any).status = 403
    const result = errorResponse(err)
    expect(result.status).toBe(403)
  })

  it('maps status 404 from err.status field', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const err = new Error('Page not found')
    ;(err as any).status = 404
    const result = errorResponse(err)
    expect(result.status).toBe(404)
    expect(result.body.error).toBe('Not Found')
  })

  it('maps status 400 from err.status field', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const err = new Error('missing required field')
    ;(err as any).status = 400
    const result = errorResponse(err)
    expect(result.status).toBe(400)
    expect(result.body.error).toContain('missing')
  })

  it('returns 500 and sanitized message for generic errors', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const result = errorResponse(new Error('Database connection failed'))
    expect(result.status).toBe(500)
    expect(result.body.error.length).toBeGreaterThan(0)
    expect(result.body.error.length).toBeLessThanOrEqual(200)
  })

  it('truncates long error messages to 200 chars', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const longMessage = 'x'.repeat(300)
    const result = errorResponse(new Error(longMessage))
    expect(result.body.error.length).toBeLessThanOrEqual(200)
  })

  it('falls back to defaultMessage when sanitized message is too short', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    // A message that is short but not empty should still trigger the < 3 check
    const err = new Error('??')
    const result = errorResponse(err, 'Fallback message')
    expect(result.body.error).toBe('Fallback message')
  })

  it('handles errors without a message', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const result = errorResponse(new Error())
    expect(result.status).toBe(500)
    expect(result.body.error.length).toBeGreaterThan(0)
  })

  it('handles non-Error thrown values (strings, objects)', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    expect(errorResponse('just a string').status).toBe(500)
    expect(errorResponse({ reason: 'oops' }).status).toBe(500)
    expect(errorResponse(null).status).toBe(500)
  })

  it('returns correct structure: { status: number, body: { error: string } }', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const result = errorResponse(new Error('test'))
    expect(result).toHaveProperty('status')
    expect(typeof result.status).toBe('number')
    expect(result).toHaveProperty('body')
    expect(result.body).toHaveProperty('error')
    expect(typeof result.body.error).toBe('string')
  })
})
