# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Role-Based Access Control >> grace period user should see limited features banner
- Location: tests\e2e\auth.spec.ts:212:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Masa Tenggang')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Masa Tenggang')

```

```yaml
- banner:
  - button "Toggle menu":
    - img
  - img
  - heading "GuruPRO" [level=1]
  - img
  - textbox "Cari..."
  - button "Beli Poin":
    - img
    - text: Beli Poin
  - button "Toggle Fullscreen":
    - img
  - button "Notifications":
    - img
  - button "T1 Pengguna"
- navigation:
  - link "Dasbor":
    - /url: /dashboard
  - link "Master Data":
    - /url: /dashboard?module=sekolah
  - button "Presensi":
    - text: Presensi
    - img
  - button "Administrasi":
    - text: Administrasi
    - img
  - button "Monitoring":
    - text: Monitoring
    - img
  - button "AI":
    - text: AI
    - img
  - link "Buku Nilai":
    - /url: /dashboard?module=nilai
  - button "Laporan":
    - text: Laporan
    - img
  - button "Raport":
    - text: Raport
    - img
  - button "Pengembangan Diri":
    - text: Pengembangan Diri
    - img
  - link "Perpustakaan":
    - /url: /dashboard/perpustakaan
  - button "Institusi":
    - text: Institusi
    - img
  - link "Komunitas Guru":
    - /url: /dashboard/forum
  - link "Keuangan":
    - /url: /dashboard?module=keuangan
  - link "Brankas":
    - /url: /dashboard/brankas
  - link "Pengaturan":
    - /url: /profile?tab=pengaturan
  - link "Billing":
    - /url: /dashboard/billing
- text: Sisa Poin AI 0 Poin FREE Poin habis!
- link "Top-Up":
  - /url: /dashboard/billing?tab=token
- main:
  - main:
    - heading "Selamat malam, Guru! 👋" [level=1]
    - paragraph: Berikut ringkasan aktivitas mengajar Anda hari ini
    - text: ⚡ 0 Poin 🔥
    - paragraph: 30 hari berturut-turut update jurnal
    - paragraph: "Rekor terbaik Anda: 30 hari"
    - text: ☀️ Menyiapkan briefing pagi... 👥
    - paragraph: "0"
    - paragraph: Total Siswa
    - text: 📄
    - paragraph: "0"
    - paragraph: RPP Bulan Ini
    - text: 📈
    - paragraph: —
    - paragraph: Rata-rata Nilai
    - text: ⏳
    - paragraph: "0"
    - paragraph: Tugas Belum Dinilai
    - heading "Aksi Cepat" [level=2]
    - button "📚 Buat RPP Baru Mulai →":
      - text: 📚
      - paragraph: Buat RPP Baru
      - text: Mulai →
    - button "📊 Input Nilai Mulai →":
      - text: 📊
      - paragraph: Input Nilai
      - text: Mulai →
    - button "📝 Buat Soal Mulai →":
      - text: 📝
      - paragraph: Buat Soal
      - text: Mulai →
    - button "📋 Laporan Kelas Mulai →":
      - text: 📋
      - paragraph: Laporan Kelas
      - text: Mulai →
    - button "✨ Bahan Ajar AI Mulai →":
      - text: ✨
      - paragraph: Bahan Ajar AI
      - text: Mulai →
    - text: 📅
    - heading "Tidak ada jadwal mengajar hari ini (Minggu)" [level=3]
    - heading "Aktivitas Terbaru" [level=2]
    - text: 📭
    - paragraph: Belum ada aktivitas tercatat
    - paragraph
    - button "Lihat Semua →"
    - heading "Ceklis Harian" [level=3]
    - text: 0%
    - paragraph: Belum ada tugas
    - textbox "Tambah tugas..."
    - button "Tambah"
    - button "Administration Selesai Tap untuk detail":
      - img
      - text: Administration Selesai Tap untuk detail
    - heading "🏫 Pilih Sekolah yang Dikelola" [level=3]
    - paragraph: "Anda mengajar di beberapa sekolah. Silakan pilih sekolah aktif untuk memuat RPP, Jurnal Kelas, dan Nilai Anda hari ini:"
    - 'button "🏫 TEST_SMP Negeri 1 Jakarta NPSN: TEST_0001 • Jl. Test No. 1, Jakarta ➡️"':
      - text: 🏫
      - heading "TEST_SMP Negeri 1 Jakarta" [level=4]
      - paragraph: "NPSN: TEST_0001 • Jl. Test No. 1, Jakarta"
      - text: ➡️
    - 'button "🏫 SMA IDEA 1 NPSN: 20202020 • Jl. Pendidikan No. 1, Jakarta ➡️"':
      - text: 🏫
      - heading "SMA IDEA 1" [level=4]
      - paragraph: "NPSN: 20202020 • Jl. Pendidikan No. 1, Jakarta"
      - text: ➡️
    - button "Gunakan Pilihan Terakhir"
- alert
```

# Test source

```ts
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
  185 |     await page.click('text=Keluar');
  186 | 
  187 |     await expect(page).toHaveURL(/\/$/);
  188 |   });
  189 | 
  190 |   test('should clear session on logout', async ({ page }) => {
  191 |     await login(page, testUsers.free.email, testUsers.free.password);
  192 |     await openUserMenu(page);
  193 |     await page.click('text=Keluar');
  194 |     await expect(page).toHaveURL(/\/$/);
  195 | 
  196 |     await page.goto(`${BASE_URL}/dashboard/raport-status`);
  197 | 
  198 |     await expect(page).toHaveURL(/\/login/);
  199 |   });
  200 | });
  201 | 
  202 | test.describe('Role-Based Access Control', () => {
  203 |   test('should show user dropdown with logged-in identity', async ({ page }) => {
  204 |     await login(page, testUsers.free.email, testUsers.free.password);
  205 | 
  206 |     await openUserMenu(page);
  207 | 
  208 |     await expect(page.locator('text=Profil Saya')).toBeVisible();
  209 |     await expect(page.locator('text=Keluar')).toBeVisible();
  210 |   });
  211 | 
  212 |   test('grace period user should see limited features banner', async ({ page }) => {
  213 |     await login(page, testUsers.gracePeriod.email, testUsers.gracePeriod.password);
  214 | 
> 215 |     await expect(page.locator('text=Masa Tenggang')).toBeVisible();
      |                                                      ^ Error: expect(locator).toBeVisible() failed
  216 |     await expect(page.locator('a:has-text("Perpanjang Sekarang")')).toBeVisible();
  217 |   });
  218 | });
  219 | 
  220 | test.describe('Institution Context Switching', () => {
  221 |   test('should render school switcher for user with schools', async ({ page }) => {
  222 |     await login(page, testUsers.free.email, testUsers.free.password);
  223 | 
  224 |     const schoolSwitcher = page.locator('header button:has-text("Pilih Sekolah")');
  225 |     const schoolName = page.locator('header button:has-text("TEST")').first();
  226 | 
  227 |     await expect(schoolSwitcher.or(schoolName)).toBeVisible();
  228 |   });
  229 | });
  230 | 
```