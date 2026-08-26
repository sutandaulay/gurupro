import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // Session replay in production
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
  replaysOnErrorSampleRate: 1.0,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Ignore common noise
  ignoreErrors: [
    // Network errors
    'TypeError: Failed to fetch',
    'TypeError: Network request failed',
    // Auth redirects
    'NEXT_REDIRECT',
    // Payload CMS
    'PayloadError',
  ],

  // Filter breadcrumbs
  beforeSend(event) {
    // Remove PII from user data
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  },
});
