import * as crypto from 'crypto'
import { createHmac, timingSafeEqual } from 'crypto'

const VERIFY_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000

function verifySecret(): string {
  return process.env.SESSION_SECRET ?? 'dev-session-secret-do-not-use-in-production'
}

/**
 * Extract real client IP from request headers.
 * Checks X-Forwarded-For, X-Real-IP, CF-Connecting-IP (Cloudflare), etc.
 */
export function getClientIP(request: Request): string {
  const headers = request.headers

  // Check X-Forwarded-For (may contain multiple IPs, first is client)
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim()
    if (ip) return ip
  }

  // Cloudflare
  const cf = headers.get('cf-connecting-ip')
  if (cf) return cf

  // X-Real-IP (nginx)
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp

  // CF-IPCountry (Cloudflare fallback)
  const cfCountry = headers.get('cf-ipcountry')
  if (cfCountry) return 'unknown'

  // Fly.io
  const fly = headers.get('fly-client-ip')
  if (fly) return fly

  // Vercel
  const vercel = headers.get('x-vercel-forwarded-for')
  if (vercel) return vercel.split(',')[0].trim()

  return 'unknown'
}

/**
 * Generate cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt() instead of Math.random().
 */
export function generateSecureOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Absolute base URL used to build email links.
 * Falls back to localhost for local development.
 */
export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  )
}

/**
 * Stateless, signed verification token for the account-activation link.
 * Format: base64url("<userId>.<issuedAt>") + "." + HMAC-SHA256.
 * Valid for 24 hours.
 */
export function createVerificationToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`
  const sig = createHmac('sha256', verifySecret())
    .update(payload)
    .digest('hex')
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

export function verifyVerificationToken(token: string): { userId: string } | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [b64, sig] = parts
  if (!/^[a-f0-9]{64}$/.test(sig)) return null

  let payload: string
  try {
    payload = Buffer.from(b64, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const [userId, ts] = payload.split('.')
  if (!userId || !ts || !/^\d+$/.test(ts)) return null

  const expected = createHmac('sha256', verifySecret())
    .update(payload)
    .digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(sig, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  if (Date.now() - Number(ts) > VERIFY_TOKEN_MAX_AGE_MS) return null
  return { userId }
}
