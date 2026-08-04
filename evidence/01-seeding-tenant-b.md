# Evidence — Seeding Tenant B (TEST_SMA) & Guru

## 2026-08-02 Seeding via skrip `scripts/seed-e2e-b.ts` (idempotent)
Tujuan: melengkapi institusi TEST_SMA (payload id 2, NPSN TEST_0002) yang sebelumnya
hanya punya 1 member (ElHanum) & tanpa data public schema.

### Yang dibuat
- `public.schools`: TEST_SMA Negeri 1 Jakarta (NPSN TEST_0002), id a9c9e53c-353a-4b01-9f68-4661b5464925
- `public.subjects`: 12 mapel (MATEMATIKA ... PAI)
- `public.classes` + `students`: X-A (15), X-B (15), XI-A (15) → 45 siswa
- `public.tahun_ajaran`: 2025/2026 aktif
- Guru baru (password `test123`, verified, quota_poin 0 awal) + cms_users + membership active di institution 2:
  | Email | Nama | Role |
  |---|---|---|
  | TEST_kepsek-sma@test.gurupro.id | TEST_Kepsek SMA | kepala_sekolah |
  | TEST_operator-sma@test.gurupro.id | TEST_Operator SMA | operator |
  | TEST_wakasek-sma@test.gurupro.id | TEST_Wakasek SMA | wakasek |
  | TEST_bendahara-sma@test.gurupro.id | TEST_Bendahara SMA | bendahara |
  | TEST_guru-sma-1@test.gurupro.id | TEST_Guru SMA 1 | guru |
  | TEST_guru-sma-2@test.gurupro.id | TEST_Guru SMA 2 | guru |
- `user_school_assignments` untuk semua guru → school TEST_SMA

### Verifikasi
- Login API `POST /api/auth/login` (test123) → 200 redirect=/dashboard
  - TEST_kepsek-sma: 200 (637ms)
  - TEST_operator-sma: 200 (165ms)
  - TEST_guru-sma-1: 200 (342ms)

### Catatan / temuan seeding
- Skrip mula-mula gagal 2x (type inference `$3` text vs varchar → fix cast `::varchar`;
  kolom `user_school_assignments.userid` sebenarnya `"userId"` camelCase → fix quoted).
- Tenant B kini siap untuk Skenario C (isolasi multi-tenant) & D (RBAC institusi).

## 2026-08-02 Temuan: register flow tidak membuat cms_users
- `POST /api/auth/register` membuat user di `public.users` TAPI TIDAK membuat
  `payload.cms_users` (baru dibuat saat OTP account_verification dengan pending_invitation_token,
  atau via seed). Akibatnya `POST /api/institutions/connect` (join via NPSN) gagal
  "Akun CMS tidak ditemukan" untuk user baru yang register tanpa undangan.
- Kategori: RBAC/flow inti → ditandai `[APPROVAL]` untuk laporan (bukan fix inline).
