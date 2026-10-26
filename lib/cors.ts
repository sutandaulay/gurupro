/**
 * CORS utilities for GuruPRO API routes.
 *
 * Strategy:
 * - Browser-based requests: check Origin header against ALLOWED_ORIGINS.
 *   The Origin header is set automatically by the browser and cannot be spoofed
 *   by non-browser clients (CORS preflight requires an actual XMLHttpRequest/fetch
 *   from a browser origin).
 * - IP-based webhooks (payment providers): verify using x-forwarded-for IP allowlist
 *   from WEBHOOK_ALLOWED_IPS env var. Payment providers call via server IPs, not browsers,
 *   so the Origin header may be absent or unreliable.
 *
 * Env vars:
 *   ALLOWED_ORIGINS      — comma-separated list of allowed origins (default: gurupro.id, www.gurupro.id)
 *   WEBHOOK_ALLOWED_IPS  — comma-separated list of allowed webhook source IPs
 */

/* ---------------------------------------------------------------------------
 * Allowed origins — set by ALLOWED_ORIGINS env var.
 * ------------------------------------------------------------------------- */
function parseAllowedOrigins(): Set<string> {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) {
    // Safe defaults for production
    return new Set(["https://gurupro.id", "https://www.gurupro.id"]);
  }
  return new Set(
    raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  );
}

export const ALLOWED_ORIGINS: Set<string> = parseAllowedOrigins();

/* ---------------------------------------------------------------------------
 * Allowed webhook IPs — set by WEBHOOK_ALLOWED_IPS env var.
 * ------------------------------------------------------------------------- */
function parseWebhookAllowedIps(): Set<string> {
  const raw = process.env.WEBHOOK_ALLOWED_IPS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean)
  );
}

export const WEBHOOK_ALLOWED_IPS: Set<string> = parseWebhookAllowedIps();

/* ---------------------------------------------------------------------------
 * Standard CORS response headers.
 * ------------------------------------------------------------------------- */
export function corsHeaders(origin?: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-callback-token, x-server-key",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/* ---------------------------------------------------------------------------
 * Check whether an origin is in the allowlist.
 * ------------------------------------------------------------------------- */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

/* ---------------------------------------------------------------------------
 * Check whether a request IP is in the webhook IP allowlist.
 * Returns null when the allowlist is empty (IP check is disabled).
 * ------------------------------------------------------------------------- */
export function isAllowedWebhookIp(ip: string | null | undefined): boolean | null {
  if (WEBHOOK_ALLOWED_IPS.size === 0) return null; // IP check disabled
  if (!ip) return false;
  return WEBHOOK_ALLOWED_IPS.has(ip);
}

/* ---------------------------------------------------------------------------
 * Handle an OPTIONS preflight request.
 *
 * Security rules for webhook routes:
 *  - Browser Origin present AND not in ALLOWED_ORIGINS → 403
 *  - Browser Origin present AND in ALLOWED_ORIGINS    → 204 with CORS headers
 *  - No Origin header (IP-based provider call)       → pass through (null)
 *    Caller should still apply IP allowlist on the POST handler.
 *
 * Usage:
 *   if (request.method === "OPTIONS") {
 *     return handleCorsPreflight(request);
 *   }
 * ------------------------------------------------------------------------- */
export function handleCorsPreflight(request: Request): Response | null {
  const origin = request.headers.get("origin");

  if (!origin) {
    // No Origin header — likely an IP-based webhook call (payment provider).
    // Pass through and let the caller apply IP allowlist checks on POST.
    return null;
  }

  if (!isAllowedOrigin(origin)) {
    // Origin is set but not allowlisted — reject.
    return new Response("Forbidden", { status: 403 });
  }

  // Origin is allowlisted — respond with CORS headers.
  const headers = corsHeaders(origin);
  return new Response(null, { status: 204, headers });
}

/* ---------------------------------------------------------------------------
 * Extract the best-effort client IP from a request.
 * Checks x-forwarded-for first (may contain multiple comma-separated IPs),
 * then x-real-ip, then cf-connecting-ip (Cloudflare).
 * ------------------------------------------------------------------------- */
export function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the left-most (original client) IP
    return forwarded.split(",")[0].trim();
  }
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    undefined
  );
}
