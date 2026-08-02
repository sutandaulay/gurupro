import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: ElHanum (Wali Kelas X.1)
 *
 * User: ElHanum, M.Pd (ptgenerasidigitalindonesiaemas@gmail.com / test123)
 * Flow:
 *   - Login
 *   - Dashboard
 *   - Wali Kelas: kelas X.1 terpilih
 *   - Tab Catatan Wali Kelas
 *   - Raport / Nilai siswa X.1
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ELHANUM_EMAIL = 'ptgenerasidigitalindonesiaemas@gmail.com';
const ELHANUM_PASSWORD = 'test123';

test.beforeEach(async ({}, testInfo) => {
  test.setTimeout(120000);
});

async function loginAsElhanum(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', ELHANUM_EMAIL);
  await page.fill('input[name="password"]', ELHANUM_PASSWORD);
  await page.click('button[type="submit"]');

  // Setelah login, mungkin diminta memilih ruang kerja (context)
  await page.waitForURL(/\/dashboard|\/select-context/);
  if (page.url().includes('/select-context')) {
    await page.locator('button', { hasText: 'Ruang Kerja Pribadi' }).first().click();
    await page.waitForURL(/\/dashboard/);
  }
}

test.describe('ElHanum E2E - Wali Kelas', () => {
  test('login as elhanum and reach dashboard', async ({ page }) => {
    await loginAsElhanum(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('wali kelas page shows X.1 for elhanum', async ({ page }) => {
    await loginAsElhanum(page);
    await page.goto(`${BASE_URL}/dashboard/wali-kelas`);

    await expect(page.locator('h1', { hasText: 'Dashboard Wali Kelas' })).toBeVisible({ timeout: 60000 });

    // Kelas X.1 tersedia di dropdown
    await expect(page.locator('select option', { hasText: 'X.1' }).first()).toContainText('X.1');
  });

  test('catatan wali kelas tab is accessible', async ({ page }) => {
    await loginAsElhanum(page);
    await page.goto(`${BASE_URL}/dashboard/wali-kelas?tab=catatan`);

    await expect(page.locator('button', { hasText: 'Catatan Wali Kelas' })).toBeVisible({ timeout: 60000 });
  });
});

test.describe('ElHanum E2E - Raport Siswa', () => {
  test('raport page loads for X.1', async ({ page }) => {
    await loginAsElhanum(page);
    await page.goto(`${BASE_URL}/dashboard/raport`);
    await page.waitForLoadState('domcontentloaded');
    // Halaman raport dapat dimuat tanpa error fatal
    expect(await page.locator('body').textContent()).not.toContain('Application error');
  });
});
