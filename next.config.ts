import { withSentryConfig } from '@sentry/nextjs';
import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
};

const configWithSentry = withSentryConfig(
  withPayload(nextConfig),
  {
    silent: true,
  }
);

export default configWithSentry;
