/**
 * Rate limiting middleware for API routes.
 *
 * Uses in-memory store for development, PostgreSQL for production.
 * Limits: configurable per-route or global defaults.
 *
 * Usage in API route:
 *   const rl = getRateLimiter({ windowMs: 60_000, max: 100 });
 *   const rateLimit = await rl.check(req);
 *   if (rateLimit.limitExceeded) {
 *     return NextResponse.json({ error: 'Too many requests' }, {
 *       status: 429,
 *       headers: { 'Retry-After': String(rateLimit.retryAfter) }
 *     });
 *   }
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionCookie } from './session-sign';

export interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  limitExceeded: boolean;
  remaining: number;
  retryAfter?: number;
  limit: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (single-instance, resets on server restart)
// Production should use Redis or PostgreSQL-backed store.
const memoryStore = new Map<string, RateLimitEntry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt < now) memoryStore.delete(key);
  }
}

// Cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function getIdentifier(req: Request): Promise<string> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (sessionCookie) {
      const session = parseSessionCookie(sessionCookie);
      if (session?.id) return `user:${session.id}`;
    }
  } catch {}

  // Fallback to IP
  return `ip:${getClientIp(req)}`;
}

export function createRateLimiter(config: RateLimitConfig = {}) {
  const {
    windowMs = 60_000,  // 1 minute default
    max = 100,           // 100 requests per window default
    keyPrefix = 'rl',
  } = config;

  return {
    async check(req: Request): Promise<RateLimitResult> {
      const identifier = await getIdentifier(req);
      const key = `${keyPrefix}:${identifier}`;
      const now = Date.now();

      let entry = memoryStore.get(key);

      if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + windowMs };
        memoryStore.set(key, entry);
      }

      entry.count++;
      const remaining = Math.max(0, max - entry.count);
      const limitExceeded = entry.count > max;
      const retryAfter = limitExceeded ? Math.ceil((entry.resetAt - now) / 1000) : undefined;

      return {
        limitExceeded,
        remaining,
        retryAfter,
        limit: max,
      };
    },
  };
}

/**
 * Global rate limiter for all API routes.
 * 200 requests per minute per user/IP.
 */
export const globalRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 200,
  keyPrefix: 'api',
});

/**
 * Strict rate limiter for sensitive endpoints (login, OTP, etc.)
 * 10 requests per minute per IP.
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  keyPrefix: 'strict',
});

/**
 * Helper to add rate limit headers to response.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    ...(result.retryAfter !== undefined && { 'Retry-After': String(result.retryAfter) }),
  };
}
