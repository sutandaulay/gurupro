import { withSentryConfig } from '@sentry/nextjs';
import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Enable client-side instrumentation
  experimental: {
    instrumentClientUpgrades: true,
  },
};

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
