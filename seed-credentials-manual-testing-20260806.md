# Seed Data Credentials — GuruPRO Manual Testing

**Batch:** `manual-testing-20260806`
**Password for all accounts:** `Password123!`
**Tahun Ajaran:** 2026/2027 Semester 1
**Paket:** `one_year` — 1000 Poin, Rp 150.000
**tokens_per_poin:** 2000 (1 Poin = 2000 token)

---

## 11 Akun Guru (App — login via /login)

| # | Nama | Email |
|---|------|-------|
| 1 | Hasan Wijaya, S.Pd. | guru.inst1@mtsbilingual.sch.id |
| 2 | Nur Fadilah, S.Pd. | guru.inst2@mtsbilingual.sch.id |
| 3 | Asep Saepudin, M.Si. | guru.inst3@mtsbilingual.sch.id |
| 4 | Dr. Maya Sari, M.Sc. | guru.inst4@sman3inspirasi.sch.id |
| 5 | Hendra Gunawan, S.Pd. | guru.inst5@sman3inspirasi.sch.id |
| 6 | Rina Hartati, S.Pd. | guru.inst6@sman3inspirasi.sch.id |
| 7 | Dedi Kuswanto, S.Pd. | guru1@sekolahmandiri.sch.id |
| 8 | Ratna Sari Dewi, M.Pd. | guru2@sekolahmandiri.sch.id |
| 9 | Ahmad Fauzan, S.Pd.I | guru3@mtsnurulimmi.sch.id |
| 10 | Nurhayati, S.Si. | guru4@smaplusmadani.sch.id |
| 11 | Heri Supriyanto, M.Pd. | guru5@tunasbangsa.sch.id |

## 15 Akun Payload CMS (Institusi — login via /admin/login)

### MTs Islamiyah Bilingual Boarding

| # | Nama | Email | Role |
|---|------|-------|------|
| 1 | Dr. H. Abdul Malik, M.Pd.I | kepala.sekolah1@mtsbilingual.sch.id | Admin |
| 2 | Hj. Nurul Hidayah, S.Pd. | wakasek.kurikulum1@mtsbilingual.sch.id | Editor |
| 3 | Ahmad Fauzi, S.Kom. | operator1@mtsbilingual.sch.id | Editor |
| 4 | Siti Aminah, S.E. | bendahara1@mtsbilingual.sch.id | Editor |
| 5 | Hasan Wijaya, S.Pd. | guru.inst1@mtsbilingual.sch.id | Editor |
| 6 | Nur Fadilah, S.Pd. | guru.inst2@mtsbilingual.sch.id | Editor |
| 7 | Asep Saepudin, M.Si. | guru.inst3@mtsbilingual.sch.id | Editor |

### SMA Negeri 3 Inspirasi Bangsa

| # | Nama | Email | Role |
|---|------|-------|------|
| 1 | Dr. Ratna Kumala Dewi, M.Si. | kepala.sekolah2@sman3inspirasi.sch.id | Admin |
| 2 | Budi Santoso, M.Pd. | wakasek.kesiswaan2@sman3inspirasi.sch.id | Editor |
| 3 | Dewi Kusuma Ningrum, S.Pd. | wakasek.saranaprasarana2@sman3inspirasi.sch.id | Editor |
| 4 | Rizki Ramadhan, A.Md. | operator2@sman3inspirasi.sch.id | Editor |
| 5 | Tri Wahyuni, S.E. | bendahara2@sman3inspirasi.sch.id | Editor |
| 6 | Dr. Maya Sari, M.Sc. | guru.inst4@sman3inspirasi.sch.id | Editor |
| 7 | Hendra Gunawan, S.Pd. | guru.inst5@sman3inspirasi.sch.id | Editor |
| 8 | Rina Hartati, S.Pd. | guru.inst6@sman3inspirasi.sch.id | Editor |

---

## Cleanup

```sql
-- Hapus semua seed data berdasarkan batch
DELETE FROM users WHERE seed_batch = 'manual-testing-20260806';

-- Payload tables (hapus berdasarkan email domain)
DELETE FROM payload.institution_members WHERE app_user_id IN (SELECT id FROM users WHERE seed_batch = 'manual-testing-20260806');
DELETE FROM payload.cms_users WHERE email LIKE '%@mtsbilingual.sch.id' OR email LIKE '%@sman3inspirasi.sch.id' OR email LIKE '%@sekolahmandiri.sch.id' OR email LIKE '%@mtsnurulimmi.sch.id' OR email LIKE '%@smaplusmadani.sch.id' OR email LIKE '%@tunasbangsa.sch.id';
DELETE FROM payload.institutions WHERE name = 'MTs Islamiyah Bilingual Boarding' OR name = 'SMA Negeri 3 Inspirasi Bangsa';
```
