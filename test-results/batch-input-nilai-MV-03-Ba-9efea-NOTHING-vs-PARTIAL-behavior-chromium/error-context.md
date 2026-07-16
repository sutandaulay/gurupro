# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: batch-input-nilai.spec.ts >> MV-03: Batch Input Edge Cases >> should handle invalid nilai in middle of batch - ALL-OR-NOTHING vs PARTIAL behavior
- Location: tests\e2e\batch-input-nilai.spec.ts:444:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard**" until "load"
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
        - paragraph [ref=e55]: Email atau Password salah!
      - generic [ref=e56]:
        - generic [ref=e57]:
          - generic [ref=e58]: Email / Username
          - generic [ref=e59]:
            - img
            - textbox "email atau username" [ref=e60]: TEST_guru-3bulan@test.gurupro.id
        - generic [ref=e61]:
          - generic [ref=e62]: Kata Sandi
          - generic [ref=e63]:
            - img
            - textbox "••••••••" [ref=e64]: TestPassword123!
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
  1   | /**
  2   |  * E2E Test Suite: Batch Input Nilai (MV-03)
  3   |  *
  4   |  * Full end-to-end test for batch nilai input functionality:
  5   |  * 1. Login as teacher with class having 50+ dummy students
  6   |  * 2. Navigate to Buku Nilai, use batch input feature
  7   |  * 3. Submit and verify via direct database query that:
  8   |  *    - Each nilai saved to correct student row (no mix-up)
  9   |  *    - No duplicate data from double-submit
  10  |  *    - Process timing is reasonable
  11  |  * 4. Test edge cases: invalid nilai in batch, partial failures - explicitly report all-or-nothing vs partial behavior
  12  |  */
  13  | 
  14  | import { test, expect, Page } from '@playwright/test';
  15  | import { Pool } from 'pg';
  16  | import { config } from 'dotenv';
  17  | 
  18  | // Load environment variables
  19  | config();
  20  | 
  21  | const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  22  | const TEST_PREFIX = 'TEST_';
  23  | 
  24  | // Database configuration for verification
  25  | const dbConfig = {
  26  |   host: process.env.DB_HOST || 'localhost',
  27  |   port: parseInt(process.env.DB_PORT || '5432'),
  28  |   database: process.env.DATABASE_URL ? 
  29  |     process.env.DATABASE_URL.split('/').pop() : 
  30  |     process.env.DB_NAME || 'gurupro_db',
  31  |   user: process.env.DB_USER || 'postgres',
  32  |   password: process.env.DB_PASSWORD || 'nus4nt4r4',
  33  | };
  34  | 
  35  | // Helper functions
  36  | async function login(page: Page, email: string, password: string) {
  37  |   await page.goto(`${BASE_URL}/login`);
  38  |   await page.fill('input[name="email"]', email);
  39  |   await page.fill('input[name="password"]', password);
  40  |   await page.click('button[type="submit"]');
> 41  |   await page.waitForURL('**/dashboard**', { timeout: 30000 });
      |              ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  42  | }
  43  | 
  44  | async function navigateToBukuNilai(page: Page) {
  45  |   await page.goto(`${BASE_URL}/dashboard/buku-nilai`);
  46  |   await expect(page.locator('text=Buku Nilai')).toBeVisible({ timeout: 10000 });
  47  | }
  48  | 
  49  | // Database helper function
  50  | async function queryDatabase(query: string, params?: any[]) {
  51  |   const pool = new Pool(dbConfig);
  52  |   try {
  53  |     const result = await pool.query(query, params);
  54  |     return result;
  55  |   } finally {
  56  |     await pool.end();
  57  |   }
  58  | }
  59  | 
  60  | // Test suite for MV-03: Batch Input Nilai
  61  | test.describe('MV-03: Batch Input Nilai (Full E2E)', () => {
  62  |   let testClassId: string | null = null;
  63  |   let testSubjectId: string | null = null;
  64  |   let testStudents: Array<{id: string, name: string}> = [];
  65  | 
  66  |   test.beforeEach(async ({ page }) => {
  67  |     await login(page,
  68  |       `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
  69  |       'TestPassword123!'
  70  |     );
  71  |     
  72  |     // Get test data for the batch operations
  73  |     try {
  74  |       // Find a class with many students for testing
  75  |       const classResult = await queryDatabase(`
  76  |         SELECT id, name 
  77  |         FROM classes 
  78  |         WHERE name LIKE '${TEST_PREFIX}%' 
  79  |         ORDER BY id 
  80  |         LIMIT 1
  81  |       `);
  82  |       
  83  |       if (classResult.rows.length > 0) {
  84  |         testClassId = classResult.rows[0].id;
  85  |         
  86  |         // Get students from this class
  87  |         const studentResult = await queryDatabase(`
  88  |           SELECT id, name 
  89  |           FROM students 
  90  |           WHERE class_id = $1 
  91  |           LIMIT 50
  92  |         `, [testClassId]);
  93  |         
  94  |         testStudents = studentResult.rows.map(row => ({
  95  |           id: row.id,
  96  |           name: row.name
  97  |         }));
  98  |       }
  99  |       
  100 |       // Find a subject for testing
  101 |       const subjectResult = await queryDatabase(`
  102 |         SELECT id 
  103 |         FROM subjects 
  104 |         WHERE name LIKE '${TEST_PREFIX}%' 
  105 |         LIMIT 1
  106 |       `);
  107 |       
  108 |       if (subjectResult.rows.length > 0) {
  109 |         testSubjectId = subjectResult.rows[0].id;
  110 |       }
  111 |     } catch (error) {
  112 |       console.log(`Database query error (expected if test data not present): ${(error as Error).message}`);
  113 |       // Continue with test, but skip database-dependent verifications
  114 |     }
  115 |   });
  116 | 
  117 |   test('should navigate to Buku Nilai and identify batch input capability', async ({ page }) => {
  118 |     await navigateToBukuNilai(page);
  119 |     
  120 |     // Verify Buku Nilai page loads
  121 |     await expect(page.locator('text=Buku Nilai')).toBeVisible();
  122 |     
  123 |     // Look for batch input features
  124 |     const batchInputElements = [
  125 |       page.locator('text=Input Massal'),
  126 |       page.locator('text=Batch Input'),
  127 |       page.locator('text=Input Per Kelas'),
  128 |       page.locator('[data-testid="batch-input-toggle"]'),
  129 |       page.locator('button:has-text("Import")'),
  130 |       page.locator('button:has-text("Upload")'),
  131 |     ];
  132 |     
  133 |     let hasBatchFeature = false;
  134 |     for (const element of batchInputElements) {
  135 |       if (await element.isVisible()) {
  136 |         hasBatchFeature = true;
  137 |         break;
  138 |       }
  139 |     }
  140 |     
  141 |     console.log(`✓ Buku Nilai page loaded, batch input feature detected: ${hasBatchFeature}`);
```