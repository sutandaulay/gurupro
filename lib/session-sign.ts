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
    };
  } catch {
    return null;
  }
}