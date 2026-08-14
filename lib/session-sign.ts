import { createHmac, timingSafeEqual } from 'crypto';

export type ActiveContext =
  | 'individual'
  | { institutionId: number };

export interface SessionData {
  id: string;
  role: string;
  activeContext?: ActiveContext;
  roles?: string[];
  lastInstitutionId?: number | null;
  /** Server-side session id (for revocation). NOT part of the HMAC payload —
   *  safe as a non-signed claim because it is cross-checked against the DB
   *  (user_id must match session.id) before it grants anything. */
  sid?: string;
}

const SESSION_SECRET = process.env.SESSION_SECRET ?? (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }
  return 'dev-session-secret-do-not-use-in-production';
})();

/** HMAC-SHA256 signature over the session fields (excluding the sig itself). */
function signPayload(fields: Record<string, unknown>): string {
  const canonical = JSON.stringify({
    id: fields.id,
    role: fields.role,
    activeContext: fields.activeContext ?? null,
    roles: fields.roles ?? [],
    lastInstitutionId: fields.lastInstitutionId ?? null,
  });
  return createHmac('sha256', SESSION_SECRET).update(canonical).digest('hex');
}

function verifySignature(fields: Record<string, unknown>, signature: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = signPayload(fields);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  // timingSafeEqual throws on different lengths — guard for safety
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Build a signed gurupro_session cookie value (still valid JSON, so existing
 * legacy JSON.parse consumers keep working — they just ignore the sig field).
 */
export function buildSignedSessionCookie(data: SessionData & { activeContext?: ActiveContext }): string {
  const payload: Record<string, unknown> = {
    id: data.id,
    role: data.role,
    activeContext: data.activeContext ?? 'individual',
    roles: data.roles ?? [],
    lastInstitutionId: data.lastInstitutionId ?? null,
  };
  payload.sig = signPayload(payload);
  if (data.sid) payload.sid = data.sid;
  return JSON.stringify(payload);
}

export function parseSignedSession(data?: string): SessionData | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (!parsed?.id) return null;
    const { sig, ...fields } = parsed;
    if (!sig || !verifySignature(fields, sig)) return null;
    return {
      id: String(parsed.id),
      role: parsed.role || 'guru',
      activeContext: parsed.activeContext,
      roles: parsed.roles ?? [],
      lastInstitutionId: parsed.lastInstitutionId ?? null,
      sid: typeof parsed.sid === 'string' ? parsed.sid : undefined,
    };
  } catch {
    return null;
  }
}

function normalizeCookieValue(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    // Next.js cookies().get() already returns a decoded value; when the value
    // comes from a raw header we must strip a trailing URL-encoding.
    if (value.includes('%')) {
      const decoded = decodeURIComponent(value);
      if (decoded.includes('{') && decoded.includes('}')) return decoded;
    }
  } catch {
    // not URL-encoded — leave as-is
  }
  return value;
}

/**
 * Drop-in replacement for the legacy `JSON.parse(sessionCookie)` pattern.
 * Returns `any` (same typing comfort) but only returns the payload when the
 * HMAC signature verifies; returns null for unsigned/forged cookies.
 */
export function parseSessionCookie(value?: string): any {
  return parseSignedSession(normalizeCookieValue(value));
}

/**
 * Extract + verify the gurupro_session from a raw `cookie` request header
 * (the `req.headers.get("cookie")?.split(...).find(...)` pattern).
 */
export function getSessionFromCookieHeader(header?: string | null): any {
  if (!header) return null;
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('gurupro_session='));
  if (!match) return null;
  const value = match.slice('gurupro_session='.length);
  return parseSignedSession(normalizeCookieValue(value));
}