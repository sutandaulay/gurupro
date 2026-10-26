import { withSentryConfig } from '@sentry/nextjs';
import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

const configWithSentry = withSentryConfig(
  withPayload(nextConfig),
  {
    // Source map upload auth token — set SENTRY_AUTH_TOKEN env var to enable
    authToken: process.env.SENTRY_AUTH_TOKEN,
    org: "videoclass",
    project: "javascript-nextjs",
    silent: true,
  }
);

export default configWithSentry;
