import * as crypto from 'crypto'

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
