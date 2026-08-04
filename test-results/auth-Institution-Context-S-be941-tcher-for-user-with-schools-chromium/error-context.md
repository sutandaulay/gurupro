# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Institution Context Switching >> should render school switcher for user with schools
- Location: tests\e2e\auth.spec.ts:221:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
TimeoutError: page.waitForURL: Timeout 30000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - heading "GuruPRO" [level=1] [ref=e5]
      - generic [ref=e6]:
        - img [ref=e7]
        - heading "Platform Administrasi Guru Berbasis AI" [level=2] [ref=e21]:
          - text: Platform Administrasi
          - text: Guru Berbasis AI
        - paragraph [ref=e22]: Satu aplikasi untuk semua kebutuhan administrasi mengajar Anda.
      - generic [ref=e23]:
        - generic [ref=e24]:
          - img [ref=e26]
          - generic [ref=e28]:
            - paragraph [ref=e29]: Pembuat Soal AI
            - paragraph [ref=e30]: Generate soal, RPP, dan materi dalam hitungan detik.
        - generic [ref=e31]:
          - img [ref=e33]
          - generic [ref=e36]:
            - paragraph [ref=e37]: Keamanan Terjamin
            - paragraph [ref=e38]: Data sekolah dan siswa terlindungi enkripsi.
        - generic [ref=e39]:
          - img [ref=e41]
          - generic [ref=e44]:
            - paragraph [ref=e45]: Administrasi Terpadu
            - paragraph [ref=e46]: Jurnal, presensi, dan nilai dalam satu platform.
    - generic [ref=e48]:
      - generic [ref=e49]:
        - heading "Selamat Datang Kembali" [level=2] [ref=e50]
        - paragraph [ref=e51]: Masuk ke akun GuruPRO AI Anda
      - generic [ref=e52]:
        - img [ref=e53]
        - paragraph [ref=e55]: Akun Anda terkunci sementara karena terlalu banyak kegagalan login. Silakan coba lagi dalam 9 menit.
      - generic [ref=e56]:
        - generic [ref=e57]:
          - generic [ref=e58]: Email / Username
          - generic [ref=e59]:
            - img
            - textbox "email atau username" [ref=e60]: TEST_guru-free@test.gurupro.id
        - generic [ref=e61]:
          - generic [ref=e62]: Kata Sandi
          - generic [ref=e63]:
            - img
            - textbox "••••••••" [ref=e64]: test123
            - button "Tampilkan password" [ref=e66] [cursor=pointer]:
              - img [ref=e67]
        - button "Lupa password?" [ref=e71] [cursor=pointer]
        - button "Masuk" [ref=e72] [cursor=pointer]:
          - generic [ref=e73]: Masuk
          - img [ref=e74]
      - generic [ref=e79]: atau masuk dengan
      - button "Masuk dengan Google" [ref=e81] [cursor=pointer]:
        - img [ref=e82]
        - generic [ref=e87]: Masuk dengan Google
      - paragraph [ref=e88]:
        - text: Belum punya akun?
        - button "Daftar sekarang" [ref=e89] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e95] [cursor=pointer]:
    - img [ref=e96]
  - alert [ref=e99]
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | const TEST_PREFIX = 'TEST_';
  4   | const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  5   | 
  6   | const testUsers = {
  7   |   free: {
  8   |     email: `${TEST_PREFIX}guru-free@test.gurupro.id`,
  9   |     password: 'test123',
  10  |     whatsapp: '+6281234567890',
  11  |     namaLengkap: 'TEST_Guru Gratis',
  12  |   },
  13  |   premium: {
  14  |     email: `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
  15  |     password: 'test123',
  16  |     whatsapp: '+6281234567891',
  17  |     namaLengkap: 'TEST_Guru Premium',
  18  |   },
  19  |   gracePeriod: {
  20  |     email: `${TEST_PREFIX}guru-1tahun@test.gurupro.id`,
  21  |     password: 'test123',
  22  |     whatsapp: '+6281234567892',
  23  |     namaLengkap: 'TEST_Guru Grace Period',
  24  |   },
  25  | };
  26  | 
  27  | async function login(page: Page, email: string, password: string) {
  28  |   await page.goto(`${BASE_URL}/login`);
  29  |   await page.fill('input[name="email"]', email);
  30  |   await page.fill('input[name="password"]', password);
  31  |   await page.click('button[type="submit"]');
> 32  |   await page.waitForURL(/\/dashboard|\/select-context/);
      |              ^ TimeoutError: page.waitForURL: Timeout 30000ms exceeded.
  33  |   if (page.url().includes('/select-context')) {
  34  |     await page.locator('button', { hasText: 'Ruang Kerja Pribadi' }).first().click();
  35  |     await page.waitForURL(/\/dashboard/);
  36  |   }
  37  | }
  38  | 
  39  | async function openUserMenu(page: Page) {
  40  |   await page.locator('header button').last().click();
  41  | }
  42  | 
  43  | async function registerUser(page: Page, opts: {
  44  |   email: string;
  45  |   password?: string;
  46  |   confirmPassword?: string;
  47  |   whatsapp?: string;
  48  |   namaLengkap?: string;
  49  |   checkConsent?: boolean;
  50  | }) {
  51  |   await page.goto(`${BASE_URL}/register`);
  52  |   await page.fill('input[name="nama_lengkap"]', opts.namaLengkap || 'TEST User');
  53  |   await page.fill('input[name="email"]', opts.email);
  54  |   await page.fill('input[name="whatsapp"]', opts.whatsapp || '81100000001');
  55  |   await page.fill('input[name="password"]', opts.password ?? 'ValidPassword123!');
  56  |   await page.fill('input[name="confirm_password"]', opts.confirmPassword ?? opts.password ?? 'ValidPassword123!');
  57  |   if (opts.checkConsent) {
  58  |     await page.locator('input[type="checkbox"]').check();
  59  |   }
  60  |   await page.click('button[type="submit"]');
  61  | }
  62  | 
  63  | test.describe('User Registration', () => {
  64  |   test('should display registration form', async ({ page }) => {
  65  |     await page.goto(`${BASE_URL}/register`);
  66  | 
  67  |     await expect(page.locator('input[name="nama_lengkap"]')).toBeVisible();
  68  |     await expect(page.locator('input[name="email"]')).toBeVisible();
  69  |     await expect(page.locator('input[name="whatsapp"]')).toBeVisible();
  70  |     await expect(page.locator('select[name="role"]')).toBeVisible();
  71  |     await expect(page.locator('input[name="password"]')).toBeVisible();
  72  |     await expect(page.locator('input[name="confirm_password"]')).toBeVisible();
  73  |   });
  74  | 
  75  |   test('should validate password strength', async ({ page }) => {
  76  |     await registerUser(page, { email: `pw_${Date.now()}@test.gurupro.id`, password: '123', confirmPassword: '123', checkConsent: true });
  77  | 
  78  |     await expect(page.locator('text=minimal 8 karakter')).toBeVisible();
  79  |   });
  80  | 
  81  |   test('should validate password matching', async ({ page }) => {
  82  |     await registerUser(page, { email: `match_${Date.now()}@test.gurupro.id`, password: 'ValidPassword123!', confirmPassword: 'Different123!', checkConsent: true });
  83  | 
  84  |     await expect(page.locator('text=tidak cocok')).toBeVisible();
  85  |   });
  86  | 
  87  |   test('should require PDP consent', async ({ page }) => {
  88  |     await registerUser(page, { email: `pdp_${Date.now()}@test.gurupro.id` });
  89  | 
  90  |     await expect(page.locator('text=persetujuan')).toBeVisible();
  91  |   });
  92  | 
  93  |   test('should reject duplicate email', async ({ page }) => {
  94  |     await registerUser(page, {
  95  |       email: testUsers.free.email,
  96  |       whatsapp: '81100000002',
  97  |       checkConsent: true,
  98  |     });
  99  | 
  100 |     await expect(page.locator('text=terdaftar')).toBeVisible();
  101 |   });
  102 | 
  103 |   test('should show OTP verification step after registration', async ({ page }) => {
  104 |     await registerUser(page, { email: `reg_${Date.now()}@test.gurupro.id`, checkConsent: true });
  105 | 
  106 |     await expect(page.locator('input[maxlength="6"]')).toBeVisible({ timeout: 15000 });
  107 |     await expect(page.locator('button:has-text("Verifikasi & Aktifkan Akun")')).toBeVisible();
  108 |   });
  109 | });
  110 | 
  111 | test.describe('OTP Verification', () => {
  112 |   test('should reject invalid OTP', async ({ page }) => {
  113 |     await registerUser(page, { email: `otp_${Date.now()}@test.gurupro.id`, checkConsent: true });
  114 | 
  115 |     await page.locator('input[maxlength="6"]').fill('000000');
  116 |     await page.click('button:has-text("Verifikasi & Aktifkan Akun")');
  117 | 
  118 |     await expect(page.locator('text=salah')).toBeVisible({ timeout: 15000 });
  119 |   });
  120 | 
  121 |   test('should resend OTP after registration', async ({ page }) => {
  122 |     await registerUser(page, { email: `resend_${Date.now()}@test.gurupro.id`, checkConsent: true });
  123 | 
  124 |     await page.click('button:has-text("Kirim Ulang Kode OTP")');
  125 | 
  126 |     await expect(page.locator('text=OTP berhasil dikirim ulang')).toBeVisible({ timeout: 15000 });
  127 |   });
  128 | });
  129 | 
  130 | test.describe('Login', () => {
  131 |   test('should login with valid credentials (free tier)', async ({ page }) => {
  132 |     await login(page, testUsers.free.email, testUsers.free.password);
```