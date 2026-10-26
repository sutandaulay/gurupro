import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* ---------------------------------------------------------------------------
 * Session secret — same value as lib/session-sign.ts.
 * Proxy runs on the Node.js runtime (Next 16 default), so process.env is
 * available directly. We fall back to the dev default; in production the env
 * var MUST be set or the proxy will reject all sessions.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * SESSION REVOCATION STRATEGY
 *
 * The proxy is STATELESS at the edge layer — it verifies the HMAC
 * signature on the gurupro_session cookie, but cannot query the DB to check
 * whether that session has been revoked (logout) or expired.
 *
 * Two-layer revocation model:
 *  1. Edge layer (proxy.ts)  — HMAC signature verification.
 *     The cookie is valid for up to 7 days (SESSION_SECRET + cookie expiry).
 *     If the user changes their password, the client must also clear the cookie.
 *  2. Server layer (lib/session.ts + /api/auth/session-status) —
 *     The sid embedded in the cookie is checked against user_sessions (DB).
 *     Revocation (logout) sets revoked_at; expiration is checked via expires_at.
 *     API routes use requireSession() or isSessionRevoked() for this.
 *     The frontend SessionValidator calls /api/auth/session-status on mount
 *     and on route changes; if valid=false it triggers logout.
 *
 * This hybrid approach avoids a DB round-trip on every edge request while still
 * enabling near-instant session revocation for logout and password changes.
 * ------------------------------------------------------------------------- */
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-session-secret-do-not-use-in-production";

/* ---------------------------------------------------------------------------
 * Routes that bypass authentication.
 * ------------------------------------------------------------------------- */
const PUBLIC_PREFIXES = [
  "/",                          // landing page
  "/login",
  "/register",
  "/forgot-password",
  "/monitoring",
  "/api/auth",
  "/api/cron",
  "/api/webhook",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/admin",                     // Payload CMS admin panel
];

/* ---------------------------------------------------------------------------
 * Web-Crypto HMAC-SHA256 (runtime-compatible replacement for Node.js crypto).
 * ------------------------------------------------------------------------- */
async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Canonical JSON representation used for signing — must match
 * the canonicalisation in lib/session-sign.ts.
 */
function canonicalPayload(fields: Record<string, unknown>): string {
  return JSON.stringify({
    id: fields.id,
    role: fields.role,
    activeContext: fields.activeContext ?? null,
    roles: fields.roles ?? [],
    lastInstitutionId: fields.lastInstitutionId ?? null,
  });
}

async function verifySignature(
  fields: Record<string, unknown>,
  signature: string
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = await hmacSha256(SESSION_SECRET, canonicalPayload(fields));
  // Constant-time comparison to prevent timing attacks.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/* ---------------------------------------------------------------------------
 * Cookie parsing (no cookies() API from next/headers at the proxy layer).
 * ------------------------------------------------------------------------- */
function getRawCookie(request: NextRequest, name: string): string | undefined {
  const raw = request.cookies.get(name)?.value;
  if (!raw) return undefined;

  // The value may be URL-encoded by Next.js when Set-Cookie is sent.
  try {
    if (raw.includes("%")) {
      const decoded = decodeURIComponent(raw);
      if (decoded.includes("{") && decoded.includes("}")) return decoded;
    }
  } catch {
    // Not URL-encoded — return as-is.
  }
  return raw;
}

interface ParsedSession {
  id: string;
  role: string;
  activeContext?: string;
  roles?: string[];
  lastInstitutionId?: number | null;
  sid?: string;
}

async function parseSessionFromRequest(request: NextRequest): Promise<ParsedSession | null> {
  const raw = getRawCookie(request, "gurupro_session");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;

    const { sig, ...fields } = parsed;
    if (!sig) return null;

    const valid = await verifySignature(fields, sig);
    if (!valid) return null;

    return {
      id: String(parsed.id),
      role: parsed.role || "guru",
      activeContext: parsed.activeContext,
      roles: parsed.roles ?? [],
      lastInstitutionId: parsed.lastInstitutionId ?? null,
      sid: typeof parsed.sid === "string" ? parsed.sid : undefined,
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * Security headers applied to every response.
 * ------------------------------------------------------------------------- */
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.sentry.io wss: https://generativelanguage.googleapis.com; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/* ---------------------------------------------------------------------------
 * Determine whether a path requires authentication.
 * ------------------------------------------------------------------------- */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?")
  );
}

/* ---------------------------------------------------------------------------
 * Proxy entry point.
 * ------------------------------------------------------------------------- */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate correlation ID for this request
  const requestId = crypto.randomUUID();

  /* ---- 1. Auth check --------------------------------------------------- */
  if (!isPublicPath(pathname)) {
    const session = await parseSessionFromRequest(request);

    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("x-request-id", requestId);
      return applySecurityHeaders(response);
    }

    /* Attach session data to request headers so downstream route handlers
     * (server components / API routes) can read it without re-parsing. */
    const sessionHeader = Buffer.from(JSON.stringify(session)).toString("base64");
    const headers = new Headers(request.headers);
    headers.set("x-session-data", sessionHeader);
    headers.set("x-request-id", requestId);

    // Rewrite instead of passthrough so headers are available to the handler.
    const response = NextResponse.next({ request: { headers } });
    return applySecurityHeaders(response);
  }

  /* ---- 2. Security headers on all responses ---------------------------- */
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return applySecurityHeaders(response);
}

/* ---------------------------------------------------------------------------
 * Matcher: all routes EXCEPT Next.js internals that never need processing.
 * ------------------------------------------------------------------------- */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   - _next/static (static assets)
     *   - _next/image (image optimisation)
     *   - favicon.ico
     *
     * NOTE: We do NOT exclude /monitoring here because the isPublicPath()
     * check above handles it. Keeping it in the matcher lets the proxy
     * apply security headers to it as well.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
