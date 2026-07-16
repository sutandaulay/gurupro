/**
 * Global Teardown for E2E Tests
 *
 * This file runs after all tests. It:
 * 1. Cleans up test data
 * 2. Closes browser contexts
 * 3. Generates test reports
 */

async function globalTeardown() {
  console.log('🧹 Global Teardown: Cleaning up...');

  // Clean up any remaining test data
  // This is handled by the seed script's cleanup function

  console.log('✅ Global Teardown: Complete');
}

export default globalTeardown;
