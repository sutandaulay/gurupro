import { test, expect, Page } from '@playwright/test';

const TEST_PREFIX = 'TEST_';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const testUsers = {
  free: {
    email: `${TEST_PREFIX}guru-free@test.gurupro.id`,
    password: 'test123',
    whatsapp: '+6281234567890',
    namaLengkap: 'TEST_Guru Gratis',
  },
  premium: {
    email: `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
    password: 'test123',
    whatsapp: '+6281234567891',
    namaLengkap: 'TEST_Guru Premium',
  },
  gracePeriod: {
    email: `${TEST_PREFIX}guru-1tahun@test.gurupro.id`,
    password: 'test123',
    whatsapp: '+6281234567892',
    namaLengkap: 'TEST_Guru Grace Period',
  },
};

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/select-context/);
  if (page.url().includes('/select-context')) {
    await page.locator('button', { hasText: 'Ruang Kerja Pribadi' }).first().click();
    await page.waitForURL(/\/dashboard/);
  }
}

async function openUserMenu(page: Page) {
  await page.locator('header button').last().click();
}

async function registerUser(page: Page, opts: {
  email: string;
  password?: string;
  confirmPassword?: string;
  whatsapp?: string;
  namaLengkap?: string;
  checkConsent?: boolean;
}) {
  await page.goto(`${BASE_URL}/register`);
  await page.fill('input[name="nama_lengkap"]', opts.namaLengkap || 'TEST User');
  await page.fill('input[name="email"]', opts.email);
  await page.fill('input[name="whatsapp"]', opts.whatsapp || '81100000001');
  await page.fill('input[name="password"]', opts.password ?? 'ValidPassword123!');
  await page.fill('input[name="confirm_password"]', opts.confirmPassword ?? opts.password ?? 'ValidPassword123!');
  if (opts.checkConsent) {
    await page.locator('input[type="checkbox"]').check();
  }
  await page.click('button[type="submit"]');
}

test.describe('User Registration', () => {
  test('should display registration form', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    await expect(page.locator('input[name="nama_lengkap"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="whatsapp"]')).toBeVisible();
    await expect(page.locator('select[name="role"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirm_password"]')).toBeVisible();
  });

  test('should validate password strength', async ({ page }) => {
    await registerUser(page, { email: `pw_${Date.now()}@test.gurupro.id`, password: '123', confirmPassword: '123', checkConsent: true });

    await expect(page.locator('text=minimal 8 karakter')).toBeVisible();
  });

  test('should validate password matching', async ({ page }) => {
    await registerUser(page, { email: `match_${Date.now()}@test.gurupro.id`, password: 'ValidPassword123!', confirmPassword: 'Different123!', checkConsent: true });

    await expect(page.locator('text=tidak cocok')).toBeVisible();
  });

  test('should require PDP consent', async ({ page }) => {
    await registerUser(page, { email: `pdp_${Date.now()}@test.gurupro.id` });

    await expect(page.locator('text=persetujuan')).toBeVisible();
  });

  test('should reject duplicate email', async ({ page }) => {
    await registerUser(page, {
      email: testUsers.free.email,
      whatsapp: '81100000002',
      checkConsent: true,
    });

    await expect(page.locator('text=terdaftar')).toBeVisible();
  });

  test('should show OTP verification step after registration', async ({ page }) => {
    await registerUser(page, { email: `reg_${Date.now()}@test.gurupro.id`, checkConsent: true });

    await expect(page.locator('input[maxlength="6"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("Verifikasi & Aktifkan Akun")')).toBeVisible();
  });
});

test.describe('OTP Verification', () => {
  test('should reject invalid OTP', async ({ page }) => {
    await registerUser(page, { email: `otp_${Date.now()}@test.gurupro.id`, checkConsent: true });

    await page.locator('input[maxlength="6"]').fill('000000');
    await page.click('button:has-text("Verifikasi & Aktifkan Akun")');

    await expect(page.locator('text=salah')).toBeVisible({ timeout: 15000 });
  });

  test('should resend OTP after registration', async ({ page }) => {
    await registerUser(page, { email: `resend_${Date.now()}@test.gurupro.id`, checkConsent: true });

    await page.click('button:has-text("Kirim Ulang Kode OTP")');

    await expect(page.locator('text=OTP berhasil dikirim ulang')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Login', () => {
  test('should login with valid credentials (free tier)', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=ringkasan aktivitas mengajar')).toBeVisible();
  });

  test('should login with valid credentials (premium)', async ({ page }) => {
    await login(page, testUsers.premium.email, testUsers.premium.password);

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should login with valid credentials (grace period)', async ({ page }) => {
    await login(page, testUsers.gracePeriod.email, testUsers.gracePeriod.password);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=Masa Tenggang')).toBeVisible();
  });

  test('should reject invalid email', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.fill('input[name="email"]', 'nonexistent@test.com');
    await page.fill('input[name="password"]', 'SomePassword123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=email')).toBeVisible();
  });

  test('should reject invalid password', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.fill('input[name="email"]', testUsers.free.email);
    await page.fill('input[name="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=password')).toBeVisible();
  });
});

test.describe('Session Management', () => {
  test('should persist session after page reload', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);

    await page.reload();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should logout successfully', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);

    await openUserMenu(page);
    await page.click('text=Keluar');

    await expect(page).toHaveURL(/\/$/);
  });

  test('should clear session on logout', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);
    await openUserMenu(page);
    await page.click('text=Keluar');
    await expect(page).toHaveURL(/\/$/);

    await page.goto(`${BASE_URL}/dashboard/raport-status`);

    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Role-Based Access Control', () => {
  test('should show user dropdown with logged-in identity', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);

    await openUserMenu(page);

    await expect(page.locator('text=Profil Saya')).toBeVisible();
    await expect(page.locator('text=Keluar')).toBeVisible();
  });

  test('grace period user should see limited features banner', async ({ page }) => {
    await login(page, testUsers.gracePeriod.email, testUsers.gracePeriod.password);

    await expect(page.locator('text=Masa Tenggang')).toBeVisible();
    await expect(page.locator('a:has-text("Perpanjang Sekarang")')).toBeVisible();
  });
});

test.describe('Institution Context Switching', () => {
  test('should render school switcher for user with schools', async ({ page }) => {
    await login(page, testUsers.free.email, testUsers.free.password);

    const schoolSwitcher = page.locator('header button:has-text("Pilih Sekolah")');
    const schoolName = page.locator('header button:has-text("TEST")').first();

    await expect(schoolSwitcher.or(schoolName)).toBeVisible();
  });
});
