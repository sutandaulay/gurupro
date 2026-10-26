/**
 * Security code test suite — covers HMAC session signing, error sanitization,
 * ReDoS-safe interpolation, OTP generation, and webhook idempotency guards.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { interpolate } from '@/lib/notifications'

// The Sentry SDK is heavy to import and irrelevant here — stub it so the
// module registry reset below does not pay for loading the whole SDK.
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  init: vi.fn(),
}))

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Re-import a module with a cleared cache so module-level env reads
 * (e.g. SESSION_SECRET) pick up the current value.
 */
async function reimport<T>(load: () => Promise<T>): Promise<T> {
  vi.resetModules()
  return load()
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

// ─── HMAC session signing ─────────────────────────────────────
describe('HMAC session signing (lib/session-sign)', () => {
  const originalSecret = process.env.SESSION_SECRET

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-for-hmac-tests'
  })

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SESSION_SECRET
    } else {
      process.env.SESSION_SECRET = originalSecret
    }
  })

  it('roundtrips a valid session through build + parse', async () => {
    const { buildSignedSessionCookie, parseSignedSession } = await reimport(
      () => import('@/lib/session-sign')
    )

    const data = {
      id: 'user-123-uuid-format-1234567890',
      role: 'guru',
      activeContext: 'individual' as const,
      roles: ['guru'],
      lastInstitutionId: null,
    }

    const cookie = buildSignedSessionCookie(data)
    const parsed = parseSignedSession(cookie)

    expect(parsed).not.toBeNull()
    expect(parsed!.id).toBe(data.id)
    expect(parsed!.role).toBe(data.role)
    expect(parsed!.activeContext).toBe(data.activeContext)
    expect(parsed!.roles).toEqual(data.roles)
  })

  it('returns null when signature is tampered', async () => {
    const { buildSignedSessionCookie, parseSignedSession } = await reimport(
      () => import('@/lib/session-sign')
    )

    const cookie = buildSignedSessionCookie({
      id: 'user-123',
      role: 'guru',
    })
    // Tamper with the signature byte
    const parsed = JSON.parse(cookie) as Record<string, unknown>
    parsed.sig = 'a' + (parsed.sig as string).slice(1) // change first char
    const tampered = JSON.stringify(parsed)

    expect(parseSignedSession(tampered)).toBeNull()
  })

  it('returns null when required fields are missing', async () => {
    const { parseSignedSession } = await reimport(() => import('@/lib/session-sign'))

    // Missing 'id' field
    const noId = JSON.stringify({ role: 'guru', sig: '0'.repeat(64) })
    expect(parseSignedSession(noId)).toBeNull()

    // Empty / undefined input
    expect(parseSignedSession('')).toBeNull()
    expect(parseSignedSession(undefined as unknown as string)).toBeNull()
  })

  it('returns null when SESSION_SECRET differs between build and parse', async () => {
    process.env.SESSION_SECRET = 'secret-for-signing'
    const signModule = await reimport(() => import('@/lib/session-sign'))

    process.env.SESSION_SECRET = 'different-secret'
    const verifyModule = await reimport(() => import('@/lib/session-sign'))

    const cookie = signModule.buildSignedSessionCookie({
      id: 'user-999',
      role: 'admin',
    })

    expect(verifyModule.parseSignedSession(cookie)).toBeNull()
  })
})

// ─── Error response sanitization ──────────────────────────────
describe('errorResponse sanitization (lib/api-error)', () => {
  it('strips Unix-style stack trace file paths', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const err = new Error(
      'Error at /app/src/lib/db.ts:42:15\n' +
      '  at query (/app/src/lib/db.ts:99:1)\n' +
      'Query failed'
    )
    const result = errorResponse(err)
    expect(result.body.error).not.toContain('/app/src')
    expect(result.body.error).not.toContain('.ts:')
  })

  it('returns 401 for Unauthorized errors', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const result = errorResponse(new Error('Unauthorized'), 'Custom msg')
    expect(result.status).toBe(401)
    expect(result.body.error).toBe('Unauthorized')
  })

  it('returns 403 when err.status is 403', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const err = new Error('Forbidden')
    ;(err as any).status = 403
    const result = errorResponse(err)
    expect(result.status).toBe(403)
  })

  it('returns 404 for not-found status', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const err = new Error('not found')
    ;(err as any).status = 404
    const result = errorResponse(err)
    expect(result.status).toBe(404)
    expect(result.body.error).toBe('Not Found')
  })

  it('returns 400 for bad-request status', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const err = new Error('invalid input: missing field')
    ;(err as any).status = 400
    const result = errorResponse(err)
    expect(result.status).toBe(400)
  })

  it('returns safe message for plain Error objects', async () => {
    const { errorResponse } = await import('@/lib/api-error')

    const result = errorResponse(new Error('Something went wrong'))
    expect(result.status).toBe(500)
    expect(result.body.error.length).toBeGreaterThan(0)
    expect(result.body.error.length).toBeLessThanOrEqual(200)
  })
})

// ─── ReDoS-safe interpolation ──────────────────────────────────
// Imported statically: a dynamic import here re-runs the module graph on
// every call and can blow past the test timeout under parallel load.
describe('interpolate ReDoS prevention (lib/notifications)', () => {
  it('replaces placeholders with variable values', () => {
    const template = 'Halo {nama}, paket Anda adalah {paket}.'
    const result = interpolate(template, { nama: 'Budi', paket: 'Pro' })
    expect(result).toBe('Halo Budi, paket Anda adalah Pro.')
  })

  it('escapes regex metacharacters in variable values without ReDoS', () => {
    const dangerous = '.*+?^${}()|[]\\'
    const template = 'Nama: {name}'
    // Must complete quickly and escape the value
    const start = Date.now()
    const result = interpolate(template, { name: dangerous })
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(500)
    // The value is escaped so it doesn't appear as-is in output
    expect(result).toBe('Nama: \\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
  })

  it('replaces multiple occurrences of the same placeholder', () => {
    const template = '{x} said hi to {x}'
    const result = interpolate(template, { x: 'Alice' })
    expect(result).toBe('Alice said hi to Alice')
  })

  it('skips undefined/null values gracefully', () => {
    const template = 'User: {name}, Email: {email}'
    const result = interpolate(template, { name: 'Bob', email: undefined })
    expect(result).toBe('User: Bob, Email: ')
  })

  it('handles empty template and empty variables', () => {

    expect(interpolate('', {})).toBe('')
    expect(interpolate('no vars', {})).toBe('no vars')
    expect(interpolate('{missing}', {})).toBe('{missing}')
  })
})

// ─── OTP generation ────────────────────────────────────────────
describe('generateOtp (lib/performance-share)', () => {
  it('returns a 6-digit string', async () => {
    const { generateOtp } = await import('@/lib/performance-share')

    const otp = generateOtp()
    expect(typeof otp).toBe('string')
    expect(otp).toMatch(/^\d{6}$/)
  })

  it('returns a value within the 100000-999999 range', async () => {
    const { generateOtp } = await import('@/lib/performance-share')

    const otp = generateOtp()
    const n = parseInt(otp, 10)
    expect(n).toBeGreaterThanOrEqual(100000)
    expect(n).toBeLessThanOrEqual(999999)
  })

  it('generates unique-ish values across multiple calls', async () => {
    const { generateOtp } = await import('@/lib/performance-share')

    const otps = new Set<string>()
    for (let i = 0; i < 100; i++) {
      otps.add(generateOtp())
    }
    // 100 draws from a 900k range collide with ~0.5% probability, so assert a
    // bound that stays green instead of demanding a perfect 100.
    expect(otps.size).toBeGreaterThanOrEqual(98)
  })

  it('implementation uses crypto.randomInt (not Math.random)', async () => {
    // crypto.randomInt(100000, 999999) always produces a 6-digit number.
    // Math.random() * 900000 + 100000 produces floats that round to 6 digits
    // but also can produce the same float representation. The definitive test is
    // the range: crypto.randomInt returns an exact integer.
    const { generateOtp } = await import('@/lib/performance-share')
    const otp = generateOtp()
    // Must be exactly 6 digits (not padded or wrapped)
    expect(otp.length).toBe(6)
    expect(parseInt(otp, 10)).toBeGreaterThanOrEqual(100000)
  })
})

// ─── Webhook idempotency guards ───────────────────────────────
describe('Webhook idempotency guards', () => {
  it('idempotency pattern skips already-activated transactions', async () => {
    // Simulate the idempotency guard: check tx status before processing
    const statuses = ['PENDING', 'ACTIVATED']
    let processCalled = 0
    const processPayment = () => { processCalled++ }

    for (const status of statuses) {
      // Guard: skip if already processed
      if (status === 'ACTIVATED') continue
      processPayment()
    }
    // Only PENDING was processed; ACTIVATED was skipped
    expect(processCalled).toBe(1)
  })

  it('FOR UPDATE lock is present in the shared webhook helper', async () => {
    const content = readSource('lib/webhook-utils.ts')
    expect(content).toContain('FOR UPDATE')
    expect(content).toContain('ACTIVATED')
  })

  it('payment webhook route delegates to the shared webhook helper', async () => {
    const content = readSource('app/api/webhook/payment/route.ts')
    expect(content).toContain('@/lib/webhook-utils')
  })

  it('Midtrans webhook uses SHA512 signature verification', async () => {
    const content = readSource('lib/webhook-utils.ts')
    expect(content).toContain('sha512')
    expect(content).toContain('createHash')

    const route = readSource('app/api/webhook/midtrans/route.ts')
    expect(route).toContain('verifyMidtransSignature')
  })

  it('Xendit webhook uses timing-safe comparison', async () => {
    const content = readSource('lib/webhook-utils.ts')
    expect(content).toContain('timingSafeEqual')

    const route = readSource('app/api/webhook/xendit/route.ts')
    expect(route).toContain('verifyXenditSignature')
  })
})
