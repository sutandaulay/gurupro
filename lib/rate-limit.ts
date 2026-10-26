/**
 * Rate limiting middleware for API routes.
 *
 * Uses in-memory store for development / Edge functions,
 * PostgreSQL-backed store for production Node.js server routes.
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
import { query } from './db';
import { isEdge } from './env';

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

// ─────────────────────────────────────────────────────────────
// In-memory store (Edge / development fallback)
// ─────────────────────────────────────────────────────────────
const memoryStore = new Map<string, RateLimitEntry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt < now) memoryStore.delete(key);
  }
}

// Cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

// ─────────────────────────────────────────────────────────────
// PostgreSQL-backed store (production)
// ─────────────────────────────────────────────────────────────

/**
 * Ensures the rate_limits table exists.
 * Called lazily on first use.
 */
async function ensureRateLimitsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key          VARCHAR(255) PRIMARY KEY,
      count        INTEGER NOT NULL DEFAULT 0,
      reset_at     BIGINT NOT NULL
    )
  `);
}

/**
 * PostgreSQL-backed check. Returns result synchronously from DB query.
 * Uses UPSERT to handle concurrent requests atomically.
 */
async function pgCheck(
  key: string,
  windowMs: number,
  max: number
): Promise<RateLimitResult> {
  await ensureRateLimitsTable();

  const now = Date.now();
  const resetAt = now + windowMs;

  // Upsert atomically: increment count, reset window if expired
  const res = await query(`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES ($1, 1, $2)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.reset_at <= $2 THEN 1
        ELSE rate_limits.count + 1
      END,
      reset_at = CASE
        WHEN rate_limits.reset_at <= $2 THEN $2
        ELSE rate_limits.reset_at
      END
    WHERE rate_limits.key = $1
    RETURNING count, reset_at
  `, [key, resetAt]);

  const row = res.rows[0];
  const count = row?.count ?? 0;
  const rowResetAt = row?.reset_at ?? resetAt;

  const remaining = Math.max(0, max - count);
  const limitExceeded = count > max;
  const retryAfter = limitExceeded ? Math.ceil((rowResetAt - now) / 1000) : undefined;

  return { limitExceeded, remaining, retryAfter, limit: max };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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
  } catch {
    // cookies() may throw in Edge runtime — fall through
  }

  return `ip:${getClientIp(req)}`;
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

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

      // Edge runtime or NODE_ENV=test → in-memory fallback
      if (isEdge() || process.env.NODE_ENV === 'test') {
        let entry = memoryStore.get(key);

        if (!entry || entry.resetAt < now) {
          entry = { count: 0, resetAt: now + windowMs };
          memoryStore.set(key, entry);
        }

        entry.count++;
        const remaining = Math.max(0, max - entry.count);
        const limitExceeded = entry.count > max;
        const retryAfter = limitExceeded ? Math.ceil((entry.resetAt - now) / 1000) : undefined;

        return { limitExceeded, remaining, retryAfter, limit: max };
      }

      // Production Node.js → PostgreSQL
      return pgCheck(key, windowMs, max);
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
 * AI feature rate limiter — more permissive but still controlled.
 * 60 requests per minute per user (AI features are expensive).
 */
export const aiRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  keyPrefix: 'ai',
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
