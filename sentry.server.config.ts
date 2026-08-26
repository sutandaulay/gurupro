import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "",
  enabled: true,

  dataCollection: {
    userInfo: false,
  },

  // 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Attach local variable values to stack frames
  includeLocalVariables: true,

  // Environment
  environment: process.env.NODE_ENV || "development",

  enableLogs: true,

  // Ignore common noise
  ignoreErrors: [
    "TypeError: Failed to fetch",
    "TypeError: Network request failed",
    "NEXT_REDIRECT",
    "PayloadError",
  ],

  // Filter PII from user data
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  },
});
