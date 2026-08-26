import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  enabled: true,
  environment: process.env.NODE_ENV || 'development',

  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
  replaysOnErrorSampleRate: 1.0,

  // Client-side ignores
  ignoreErrors: [
    'TypeError: Failed to fetch',
    'TypeError: Network request failed',
  ],
});
