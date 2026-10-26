/**
 * Environment detection utilities.
 */

/**
 * Returns true when running in a serverless/edge runtime where Node.js
 * built-ins (like `pg`, `crypto`) are not available.
 */
export function isEdge(): boolean {
  const edgeRuntime = (globalThis as { EdgeRuntime?: string }).EdgeRuntime;
  return (
    typeof edgeRuntime !== 'undefined' ||
    process.env.NEXT_RUNTIME === 'edge' ||
    // Vercel Edge Functions
    (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Cloudflare-Workers'))
  );
}

/**
 * Returns true when running in production environment.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Returns true when running in development environment.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
