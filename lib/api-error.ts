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

export function errorResponse(
  error: unknown,
  defaultMessage = 'Internal Server Error'
): { status: number; body: { error: string } } {
  const err = error as Error & { status?: number; code?: string; message?: string };

  let status = 500;
  let message = defaultMessage;

  if (err.message?.includes('Unauthorized') || err.message === 'Unauthorized') {
    status = 401;
    message = 'Unauthorized';
  } else if (err.message?.includes('Forbidden') || err.message === 'Forbidden') {
    status = 403;
    message = 'Forbidden';
  } else if (err.status === 401 || err.code === 'UNAUTHORIZED') {
    status = 401;
    message = 'Unauthorized';
  } else if (err.status === 403 || err.code === 'FORBIDDEN') {
    status = 403;
    message = 'Forbidden';
  } else if (err.status === 404) {
    status = 404;
    message = 'Not Found';
  } else if (err.status === 400) {
    status = 400;
    message = err.message || 'Bad Request';
  }

  return {
    status,
    body: { error: message },
  };
}
