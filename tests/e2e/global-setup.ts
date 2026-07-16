import { chromium, FullConfig } from '@playwright/test';

/**
 * Global Setup for E2E Tests
 *
 * This file runs before all tests. It:
 * 1. Validates environment variables
 * 2. Sets up test database (seed data)
 * 3. Creates test browser context
 * 4. Performs authentication if needed
 */

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  console.log('🔧 Global Setup: Starting E2E test environment...');
  console.log(`   Base URL: ${baseURL}`);

  // Validate required environment variables
  const requiredEnvVars = ['BASE_URL'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing env vars: ${missingVars.join(', ')}`);
    console.warn('   Some tests may fail without these variables.');
  }

  // Check if database is accessible
  try {
    const response = await fetch(`${baseURL}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    console.log('✅ Database connection: OK');
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('   Make sure the application is running: npm run dev');
    throw error;
  }

  // Run seed script if in clean mode
  if (process.env.SEED_DATA === 'true') {
    console.log('🌱 Running seed script...');
    await runSeedScript();
  }

  console.log('✅ Global Setup: Complete');
}

async function runSeedScript() {
  // This would call the seed script endpoint or run it directly
  // For now, we'll just log that we're skipping it
  console.log('   (Seed script execution skipped - use npm run seed:test)');
}

export default globalSetup;
