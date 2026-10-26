/**
 * Global API error handler — catches unhandled errors and reports to Sentry.
 * Import this in each API route's catch block or use as a wrapper.
 */
import * as Sentry from '@sentry/nextjs';
import { logger } from './logger';

export function captureError(error: unknown, context?: Record<string, unknown>) {
  const err = error as Error & { status?: number; code?: string };

  logger.error(err.message, {
    stack: err.stack,
    code: err.code,
    ...context,
  });

  Sentry.captureException(error, {
    extra: context,
  });
}

/** Strip internal details from user-facing error messages */
function sanitizeMessage(raw: string): string {
  const SOURCE_FILE = String.raw`(?:tsx?|jsx?|mjs|cjs)`;

  return raw
    // Stack frames: "at someFn (/abs/path/file.ts:12:3)" → drop the whole frame
    .replace(/\bat\s+[^\n(]*\([^\n)]*\)/g, '')
    // "at /abs/path/file.ts:12:3" → drop the location
    .replace(/\bat\s+(?:[A-Za-z]:)?[\\/][^\s(]+/g, '')
    // Absolute file paths with line numbers: "/app/src/lib/db.ts:42:15", "C:\app\db.ts:1:2"
    .replace(new RegExp(String.raw`(?:[A-Za-z]:)?[\\/][^\s'"()\[\]]*\.${SOURCE_FILE}:\d+(?::\d+)?`, 'g'), '')
    // Relative file paths with line numbers: "lib/db.ts:42"
    .replace(new RegExp(String.raw`\b[\w.-]+[\\/][^\s'"()\[\]]*\.${SOURCE_FILE}:\d+(?::\d+)?`, 'g'), '')
    // Absolute file paths without line numbers
    .replace(new RegExp(String.raw`(?:[A-Za-z]:)?[\\/][^\s'"()\[\]]*\.${SOURCE_FILE}\b`, 'g'), '')
    // Remove PostgreSQL stack traces
    .replace(/at\s+[\w.`"<>()[\]]+\s+\(/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .substring(0, 200) || 'Terjadi kesalahan pada server';
}

export function errorResponse(
  error: unknown,
  defaultMessage = 'Internal Server Error'
): { status: number; body: { error: string } } {
  const err = error as any;
  const raw = err?.message ?? String(error ?? '');

  let status = 500;
  let message = sanitizeMessage(raw);

  // Map known error patterns to safe responses
  if (
    raw.includes('Unauthorized') ||
    raw === 'Unauthorized' ||
    err?.status === 401 ||
    err?.code === 'UNAUTHORIZED'
  ) {
    status = 401;
    message = 'Unauthorized';
  } else if (
    raw.includes('Forbidden') ||
    raw === 'Forbidden' ||
    err?.status === 403 ||
    err?.code === 'FORBIDDEN'
  ) {
    status = 403;
    message = 'Forbidden';
  } else if (err?.status === 404) {
    status = 404;
    message = 'Not Found';
  } else if (err?.status === 400) {
    status = 400;
    message = sanitizeMessage(raw);
  }

  // Fall back to safe default for known bad messages
  if (!message || message.length < 3) {
    message = defaultMessage;
  }

  return { status, body: { error: message } };
}
