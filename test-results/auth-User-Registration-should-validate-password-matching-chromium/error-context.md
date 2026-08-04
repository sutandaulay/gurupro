# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> User Registration >> should validate password matching
- Location: tests\e2e\auth.spec.ts:81:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=tidak cocok')
Expected: visible
Error: strict mode violation: locator('text=tidak cocok') resolved to 2 elements:
    1) <p class="mt-1 text-xs font-medium text-error-600">Konfirmasi kata sandi tidak cocok.</p> aka getByText('Konfirmasi kata sandi tidak')
    2) <span class="text-[10px] font-medium text-error-600">Password tidak cocok</span> aka getByText('Password tidak cocok')

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=tidak cocok')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - heading "GuruPRO" [level=1] [ref=e5]
      - generic [ref=e6]:
        - img [ref=e7]
        - heading "Bergabung dengan ribuan guru Indonesia" [level=2] [ref=e21]:
          - text: Bergabung dengan ribuan
          - text: guru Indonesia
        - paragraph [ref=e22]: Mulai perjalanan mengajar yang lebih cerdas bersama GuruPRO AI.
      - generic [ref=e23]:
        - generic [ref=e24]:
          - img [ref=e26]
          - generic [ref=e30]:
            - paragraph [ref=e31]: Dual-Mode Fleksibel
            - paragraph [ref=e32]: Kelola akun personal & terhubung ke institusi Anda sekaligus.
        - generic [ref=e33]:
          - img [ref=e35]
          - generic [ref=e39]:
            - paragraph [ref=e40]: Penyimpanan Data Aman
            - paragraph [ref=e41]: Sesuai standar UU PDP dan tersertifikasi enkripsi SSL.
        - generic [ref=e42]:
          - img [ref=e44]
          - generic [ref=e48]:
            - paragraph [ref=e49]: Generator Soal Bloom
            - paragraph [ref=e50]: Susun administrasi, RPP & bank soal berstandar HOTS.
    - generic [ref=e52]:
      - generic [ref=e53]:
        - heading "Buat Akun Baru" [level=2] [ref=e54]
        - paragraph [ref=e55]: Mulai perjalanan mengajar yang lebih cerdas
      - generic [ref=e56]:
        - generic [ref=e57]:
          - generic [ref=e58]: Nama Lengkap & Gelar
          - generic [ref=e59]:
            - img
            - 'textbox "Contoh: ElHanum, S.Pd." [ref=e60]': TEST User
        - generic [ref=e61]:
          - generic [ref=e62]: Alamat Email Aktif
          - generic [ref=e63]:
            - img
            - textbox "nama@email.com" [ref=e64]: match_1785675913541@test.gurupro.id
        - generic [ref=e65]:
          - generic [ref=e66]: No. WhatsApp Aktif
          - generic [ref=e67]:
            - img
            - generic: "+62"
            - textbox "81234567xx" [ref=e68]: "81100000001"
          - paragraph [ref=e69]: Wajib diisi untuk pengiriman kode OTP verifikasi akun.
        - generic [ref=e70]:
          - generic [ref=e71]: Pilih Peran
          - generic [ref=e72]:
            - img
            - combobox [ref=e73] [cursor=pointer]:
              - option "Guru Mandiri" [selected]
              - option "Kepala Sekolah"
              - option "Admin Sekolah"
            - img
        - generic [ref=e74]:
          - generic [ref=e75]:
            - generic [ref=e76]: Kata Sandi
            - generic [ref=e77]:
              - img
              - textbox "Minimal 8 karakter (kombinasi huruf/angka)" [ref=e78]: ValidPassword123!
              - button "Tampilkan password" [ref=e80] [cursor=pointer]:
                - img [ref=e81]
          - paragraph [ref=e89]: "Kekuatan: Kuat"
        - generic [ref=e90]:
          - generic [ref=e91]:
            - generic [ref=e92]: Konfirmasi Kata Sandi
            - generic [ref=e93]:
              - img
              - textbox "Ulangi kata sandi Anda" [ref=e94]: Different123!
              - button "Tampilkan password" [ref=e96] [cursor=pointer]:
                - img [ref=e97]
            - paragraph [ref=e100]: Konfirmasi kata sandi tidak cocok.
          - generic [ref=e101]:
            - img [ref=e102]
            - generic [ref=e105]: Password tidak cocok
        - generic [ref=e107] [cursor=pointer]:
          - checkbox "Saya menyetujui pemrosesan data pribadi saya sesuai dengan Kebijakan Privasi dan mematuhi regulasi perlindungan data UU PDP No. 27/2022." [checked] [ref=e108]
          - generic [ref=e109]:
            - text: Saya menyetujui pemrosesan data pribadi saya sesuai dengan
            - link "Kebijakan Privasi" [ref=e110]:
              - /url: /privacy-policy
            - text: dan mematuhi regulasi perlindungan data UU PDP No. 27/2022.
        - button "Daftar & Kirim OTP" [active] [ref=e111] [cursor=pointer]:
          - generic [ref=e112]: Daftar & Kirim OTP
          - img [ref=e113]
      - generic [ref=e118]: atau daftar dengan
      - button "Daftar dengan Google" [ref=e120] [cursor=pointer]:
        - img [ref=e121]
        - generic [ref=e126]: Daftar dengan Google
      - paragraph [ref=e127]:
        - text: Sudah punya akun?
        - link "Masuk" [ref=e128] [cursor=pointer]:
          - /url: /login
  - button "Open Next.js Dev Tools" [ref=e134] [cursor=pointer]:
    - img [ref=e135]
  - alert [ref=e138]
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
  32  |   await page.waitForURL(/\/dashboard|\/select-context/);
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
> 84  |     await expect(page.locator('text=tidak cocok')).toBeVisible();
      |                                                    ^ Error: expect(locator).toBeVisible() failed
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
  133 | 
  134 |     await expect(page).toHaveURL(/\/dashboard/);
  135 |     await expect(page.locator('text=ringkasan aktivitas mengajar')).toBeVisible();
  136 |   });
  137 | 
  138 |   test('should login with valid credentials (premium)', async ({ page }) => {
  139 |     await login(page, testUsers.premium.email, testUsers.premium.password);
  140 | 
  141 |     await expect(page).toHaveURL(/\/dashboard/);
  142 |   });
  143 | 
  144 |   test('should login with valid credentials (grace period)', async ({ page }) => {
  145 |     await login(page, testUsers.gracePeriod.email, testUsers.gracePeriod.password);
  146 | 
  147 |     await expect(page).toHaveURL(/\/dashboard/);
  148 |     await expect(page.locator('text=Masa Tenggang')).toBeVisible();
  149 |   });
  150 | 
  151 |   test('should reject invalid email', async ({ page }) => {
  152 |     await page.goto(`${BASE_URL}/login`);
  153 | 
  154 |     await page.fill('input[name="email"]', 'nonexistent@test.com');
  155 |     await page.fill('input[name="password"]', 'SomePassword123!');
  156 |     await page.click('button[type="submit"]');
  157 | 
  158 |     await expect(page.locator('text=email')).toBeVisible();
  159 |   });
  160 | 
  161 |   test('should reject invalid password', async ({ page }) => {
  162 |     await page.goto(`${BASE_URL}/login`);
  163 | 
  164 |     await page.fill('input[name="email"]', testUsers.free.email);
  165 |     await page.fill('input[name="password"]', 'WrongPassword123!');
  166 |     await page.click('button[type="submit"]');
  167 | 
  168 |     await expect(page.locator('text=password')).toBeVisible();
  169 |   });
  170 | });
  171 | 
  172 | test.describe('Session Management', () => {
  173 |   test('should persist session after page reload', async ({ page }) => {
  174 |     await login(page, testUsers.free.email, testUsers.free.password);
  175 | 
  176 |     await page.reload();
  177 | 
  178 |     await expect(page).toHaveURL(/\/dashboard/);
  179 |   });
  180 | 
  181 |   test('should logout successfully', async ({ page }) => {
  182 |     await login(page, testUsers.free.email, testUsers.free.password);
  183 | 
  184 |     await openUserMenu(page);
```