import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Authentication & Registration
 *
 * Tests cover:
 * - User registration with valid/invalid data
 * - OTP verification flow
 * - Login with valid credentials
 * - Login with invalid credentials
 * - Session management
 * - Role-based access control
 */

const TEST_PREFIX = 'TEST_';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ============================================
// TEST DATA
// ============================================

const testUsers = {
  free: {
    email: `${TEST_PREFIX}guru-free@test.gurupro.id`,
    password: 'TestPassword123!',
    whatsapp: '+6281234567890',
    namaLengkap: 'TEST_Guru Gratis',
  },
  premium: {
    email: `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
    password: 'TestPassword123!',
    whatsapp: '+6281234567891',
    namaLengkap: 'TEST_Guru Premium',
  },
  gracePeriod: {
    email: `${TEST_PREFIX}guru-1tahun@test.gurupro.id`,
    password: 'TestPassword123!',
    whatsapp: '+6281234567892',
    namaLengkap: 'TEST_Guru Grace Period',
  },
};

// ============================================
// HELPERS
// ============================================

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**');
}

async function logout(page: Page) {
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('**/login**');
}

// ============================================
// TESTS: REGISTRATION
// ============================================

test.describe('User Registration', () => {
  test('should display registration form', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?mode=register`);

    // Check all required fields are present
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirm_password"]')).toBeVisible();
    await expect(page.locator('input[name="whatsapp"]')).toBeVisible();
    await expect(page.locator('input[name="nama_lengkap"]')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?mode=register`);

    // Enter invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'ValidPassword123!');
    await page.fill('input[name="confirm_password"]', 'ValidPassword123!');
    await page.fill('input[name="whatsapp"]', '+6281234567890');
    await page.fill('input[name="nama_lengkap"]', 'Test User');
    await page.fill('input[name="username"]', 'testuser');

    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=email')).toBeVisible();
  });

  test('should validate password matching', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?mode=register`);

    await page.fill('input[name="email"]', 'newuser@test.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="confirm_password"]', 'DifferentPassword123!');
    await page.fill('input[name="whatsapp"]', '+6281234567890');
    await page.fill('input[name="nama_lengkap"]', 'Test User');
    await page.fill('input[name="username"]', 'newuser');

    await page.click('button[type="submit"]');

    // Should show password mismatch error
    await expect(page.locator('text=sama')).toBeVisible();
  });

  test('should require PDP consent', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?mode=register`);

    await page.fill('input[name="email"]', 'newuser@test.com');
    await page.fill('input[name="password"]', 'ValidPassword123!');
    await page.fill('input[name="confirm_password"]', 'ValidPassword123!');
    await page.fill('input[name="whatsapp"]', '+6281234567890');
    await page.fill('input[name="nama_lengkap"]', 'Test User');
    await page.fill('input[name="username"]', 'newuser');
    // Do NOT check consent checkbox

    await page.click('button[type="submit"]');

    // Should show consent error
    await expect(page.locator('text=persetujuan')).toBeVisible();
  });
});

// ============================================
// TESTS: OTP VERIFICATION
// ============================================

test.describe('OTP Verification', () => {
  test('should show OTP input after registration', async ({ page }) => {
    // This test requires a real email or mock OTP
    // In production, you'd use a test email inbox
    await page.goto(`${BASE_URL}/login?mode=register`);

    // Fill valid registration form
    const uniqueEmail = `${TEST_PREFIX}reg_${Date.now()}@test.gurupro.id`;
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="password"]', 'ValidPassword123!');
    await page.fill('input[name="confirm_password"]', 'ValidPassword123!');
    await page.fill('input[name="whatsapp"]', '+6281234567890');
    await page.fill('input[name="nama_lengkap"]', 'TEST_OTP Test User');
    await page.fill('input[name="username"]', `otpuser_${Date.now()}`);

    // Check consent
    const consentCheckbox = page.locator('input[name="pdp_consent"]');
    if (await consentCheckbox.isVisible()) {
      await consentCheckbox.check();
    }

    await page.click('button[type="submit"]');

    // Should redirect to OTP verification or dashboard
    // (depends on if OTP is required for registration)
    await page.waitForURL(/\/(dashboard|verify-otp)/);
  });

  test('should reject invalid OTP', async ({ page }) => {
    await page.goto(`${BASE_URL}/verify-otp`);

    // Enter wrong OTP
    await page.fill('input[name="otp"]', '000000');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=invalid')).toBeVisible();
  });

  test('should handle expired OTP', async ({ page }) => {
    // This would require mocking time or using a pre-expired OTP
    await page.goto(`${BASE_URL}/verify-otp`);

    await page.fill('input[name="otp"]', '123456');
    await page.click('button[type="submit"]');

    // Should show expiration message
    await expect(page.locator('text=expired')).toBeVisible();
  });

  test('should resend OTP after waiting', async ({ page }) => {
    await page.goto(`${BASE_URL}/verify-otp`);

    // Wait for resend button to be enabled
    const resendButton = page.locator('button:has-text("Kirim Ulang")');
    await expect(resendButton).toBeDisabled();

    // Wait 60 seconds (in real test, use fake timers)
    // await page.waitForTimeout(60000);

    // Resend button should be enabled
    await expect(resendButton).toBeEnabled();
  });
});

// ============================================
// TESTS: LOGIN
// ============================================

test.describe('Login', () => {
  test('should login with valid credentials (free tier)', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Should show dashboard elements
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should login with valid credentials (premium)', async ({ page }) => {
    await login(page, testUsers.premium.email, testUsers.premium.password);

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should login with valid credentials (grace period)', async ({ page }) => {
    await login(page, testUsers.gracePeriod.email, testUsers.gracePeriod.password);

    await expect(page).toHaveURL(/\/dashboard/);

    // Should show grace period warning
    await expect(page.locator('text=Masa Tenggang')).toBeVisible();
  });

  test('should reject invalid email', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.fill('input[type="email"]', 'nonexistent@test.com');
    await page.fill('input[type="password"]', 'SomePassword123!');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=email')).toBeVisible();
  });

  test('should reject invalid password', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.fill('input[type="email"]', testUsers.free.email);
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=password')).toBeVisible();
  });

  test('should lock account after 5 failed attempts', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Attempt 5 failed logins
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="email"]', testUsers.free.email);
      await page.fill('input[type="password"]', 'WrongPassword!');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }

    // Account should be locked
    await expect(page.locator('text=terkunci')).toBeVisible();
  });
});

// ============================================
// TESTS: SESSION MANAGEMENT
// ============================================

test.describe('Session Management', () => {
  test('should persist session after page reload', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should logout successfully', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);

    // Find and click logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Keluar');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should clear session on logout', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);
    await logout(page);

    // Try to access protected page
    await page.goto(`${BASE_URL}/dashboard`);

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

// ============================================
// TESTS: ROLE-BASED ACCESS
// ============================================

test.describe('Role-Based Access Control', () => {
  test('teacher should not see operator menu', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);

    // Operator menu should not be visible
    await expect(page.locator('text=Operator')).not.toBeVisible();
  });

  test('teacher should not see admin menu', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);

    // Admin/Sekolah menu should not be visible
    await expect(page.locator('text=Admin')).not.toBeVisible();
  });

  test('grace period user should see limited features', async ({ page }) => {
    await login(page, testUsers.gracePeriod.email, testUsers.gracePeriod.password);

    // Should show grace period banner
    await expect(page.locator('text=Masa Tenggang')).toBeVisible();

    // AI features might still work
    // Some features might be disabled
  });
});

// ============================================
// TESTS: CONTEXT SWITCHING
// ============================================

test.describe('Institution Context Switching', () => {
  test('should switch to institution context', async ({ page }) => {
    await login(page, testUsers.premium.email, testUsers.premium.password);

    // Look for school/institution selector
    const schoolSelector = page.locator('[data-testid="school-selector"]');
    if (await schoolSelector.isVisible()) {
      await schoolSelector.click();
      await page.click('text=SMP Negeri 1 Test');

      // URL should include institution context
      await page.waitForURL(/\/institution\//);
    }
  });

  test('should switch back to individual context', async ({ page }) => {
    await login(page, testUsers.premium.email, testUsers.premium.password);

    // Switch to institution first
    const schoolSelector = page.locator('[data-testid="school-selector"]');
    if (await schoolSelector.isVisible()) {
      await schoolSelector.click();
      await page.click('text=SMP Negeri 1 Test');
      await page.waitForURL(/\/institution\//);

      // Switch back to individual
      await schoolSelector.click();
      await page.click('text=Pribadi / Individual');
    }
  });
});
