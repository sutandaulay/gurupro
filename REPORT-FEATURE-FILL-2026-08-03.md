# LAPORAN PENGISIAN DATA & VERIFIKASI FITUR GURUPRO AI

**Tanggal:** 2026-08-03
**Environment:** Local (`D:\gurupro`), PostgreSQL dev database
**Dev Server:** localhost:3000 (running)

---

## 1. CHECKLIST VERIFIKASI PER FITUR

### A. Guru Mandiri

| Fitur | Status | Catatan |
|-------|--------|---------|
| Login akun demo | Terisi & Terverifikasi | `DEMO_guru-mandiri@test.gurupro.id` / `test123` — login berhasil 200 OK |
| Dashboard akses | Terisi & Terverifikasi | `/api/me` return 200 |
| AI Chat | INFO | 400 Invalid payload — perlu Gemini API key |
| AI Rapor generation | INFO | Route `/api/ai/rapor` tidak ada (404) |
| AI Journal generation | INFO | Route `/api/ai/journal` tidak ada (404) |
| Dokumen AI (RPP/Modul Ajar/LKPD/Silabus) | Terisi & Terverifikasi | Semua endpoint return 200 |
| ATP endpoint | INFO | 500 error — kolom `ga.tahun_ajaran_id` tidak ada di schema |
| Selesai Mengajar | Terisi & Terverifikasi | Endpoint return 200 |
| e-Raport | Terisi & Terverifikasi | Endpoint return 200 |
| Billing Poin (AI Monitoring) | Gagal Diisi | 500 "Failed to get monitoring data" |
| Share-to-leader | INFO | Butuh ID kontak pimpinan — flow end-to-end perlu data lebih |
| Attendance | Terisi & Terverifikasi | Dengan params `?type=teacher&school_id=X` return 200 |
| Wali Kelas | Gagal Diisi | 500 "operator tidak ada: uuid = character varying" — bug di `getGuruOptionsForSchool` |
| Laporan Kinerja | INFO | 500 "Failed to fetch laporan" |
| SKP | Terisi & Terverifikasi | Endpoint return 200 |
| Observasi | Terisi & Terverifikasi | Endpoint return 200 |
| Pelatihan Guru | Terisi & Terverifikasi | Endpoint return 200 |
| Evidence Log | INFO | Route `/api/evidence` tidak ada (404) |
| Perpustakaan | Terisi & Terverifikasi | `/api/library/items` return 200 |
| Forum | INFO | 403 Forbidden — user belum anggota institusi mana pun |
| Export Raport | INFO | 405 Method Not Allowed — perlu POST dengan body |

### B. Institusi (Setup Admin/Kepala Sekolah)

| Fitur | Status | Catatan |
|-------|--------|---------|
| Institusi DEMO_MTs Nurul Hikmah | Terisi & Terverifikasi | ID: 3, NPSN: DEMO99999, jenjang: MTs, naungan: Kemenag |
| Sekolah (DEMO_MTs Nurul Hikmah Jakarta) | Terisi & Terverifikasi | ID: f132dfd6-1b63-4e35-a120-a74eb8755c26 |
| Tahun Ajaran 2025/2026 | Terisi & Terverifikasi | Aktif, semester Ganjil |
| 6 Kelas (VII-A s/d IX-B) | Terisi & Terverifikasi | Wali kelas VII-A = Elisabeth Nur Hidayah |
| 103 siswa (15-20 per kelas) | Terisi & Terverifikasi | Prefix `DEMO_` di nama |
| 13 Mata Pelajaran MTs | Terisi & Terverifikasi | Matematika, Bahasa Indonesia, Fikih, dll |
| Jadwal pelajaran | Terisi & Terverifikasi | 5 hari x 3 jam pelajaran |
| 6 Ekstrakurikuler | Terisi & Terverifikasi | Pramuka, PMR, Paskibra, Futsal, Paduan Suara, KIR |
| RBAC: Kepala Sekolah | Terisi & Terverifikasi | Dr. Hasan Basri, M.Si. |
| RBAC: Wakasek | Terisi & Terverifikasi | Siti Rahayu, S.Pd. |
| RBAC: Operator | Terisi & Terverifikasi | Ahmad Dahlan |
| RBAC: Bendahara | Terisi & Terverifikasi | Rina Hartati |
| Wali Kelas Assignment | Terisi & Terverifikasi | VII-A → Elisabeth Nur Hidayah |
| Institution Dashboard (Kepala Sekolah) | INFO | 403 — session context belum ke institution |
| Institution Members | INFO | 403 — perlu active context |

### C. Guru Institusi

| Fitur | Status | Catatan |
|-------|--------|---------|
| Login | Terisi & Terverifikasi | `DEMO_guru-instansi@test.gurupro.id` berhasil login |
| Dashboard | Terisi & Terverifikasi | return 200 |
| Active Context switch | INFO | 400 null response — perlu diselidiki |
| Dokumen AI | Terisi & Terverifikasi | Semua endpoint 200 |
| Selesai Mengajar | Terisi & Terverifikasi | Endpoint 200 |
| e-Raport | Terisi & Terverifikasi | Endpoint 200 |

### D. Kepala Sekolah / Wakasek / Operator / Bendahara

| Fitur | Status | Catatan |
|-------|--------|---------|
| Login semua role | Terisi & Terverifikasi | Semua 3 role berhasil login |
| Dashboard Institution | INFO | Butuh active context aktif |
| TPG Report | INFO | Route `/api/reports/tpg` tidak ada (404) |

### E. Administrasi AI (Lintas Peran)

| Fitur | Status | Catatan |
|-------|--------|---------|
| AI Chat | INFO | Butuh Gemini API key |
| AI Raport generation | INFO | Route tidak ditemukan |
| AI Journal generation | INFO | Route tidak ditemukan |
| Dokumen: RPP | Terisi & Terverifikasi | Endpoint `/api/administrasi` return 200 |
| Dokumen: Modul Ajar | Terisi & Terverifikasi | Endpoint `/api/modul-ajar` return 200 |
| Dokumen: LKPD | Terisi & Terverifikasi | Endpoint `/api/lkpd/list` return 200 |
| Dokumen: Silabus | Terisi & Terverifikasi | Endpoint `/api/silabus` return 200 |
| Dokumen: ATP | INFO | 500 — schema mismatch |
| Dokumen: Bahan Ajar | Terisi & Terverifikasi | Endpoint `/api/bahan-ajar` return 200 |

### F. Verifikasi Output Cetak/Ekspor

| Dokumen | Status | Catatan |
|---------|--------|---------|
| e-Raport (cetak) | Tidak Bisa Diuji | Butuh data siswa spesifik + download route perlu body |
| RPP/Modul Ajar/LKPD/Silabus | Tidak Bisa Diuji | Butuh AI generation bermediakan API key |
| TPG | Tidak Bisa Diuji | Route tidak ditemukan |

---

## 2. CACAT / KENDALA YANG DITEMUKAN

### Bug #1: `getGuruOptionsForSchool` — Operator Type Mismatch (TINGGI)
- **Fitur:** Wali Kelas (guru_options dropdown)
- **Jenis:** Bug Teknis — Data Salah Tampil
- **Root Cause:** `lib/wali-kelas.ts:345-350` — Payload query menggunakan field `schoolId` yang TIDAK ADA di koleksi `payload.institutions`. Schema payload.institutions tidak punya kolom `schoolId`. Query selalu gagal → institutions.docs selalu kosong → `[]` return → downstream code expect id numeric tapi dapat `undefined`.
- **File:** `lib/wali-kelas.ts` line 345-350
- **Langkah Reproduksi:** Login → halaman Wali Kelas → query param `?school_id=X&guru_options=true` → 500 error
- **Perbaikan:** Hubungan institusi-sekolah kemungkinan tidak via field `schoolId`. Perlu cek tabel/link lain.
- **Status:** Belum Diperbaiki

### Bug #2: ATP Endpoint — Missing Column (TINGGI)
- **Fitur:** ATP
- **Jenis:** Bug Teknis — Query Gagal
- **Root Cause:** `api/atp/route.ts` mereferensikan kolom `ga.tahun_ajaran_id` yang tidak ada di tabel `guru_administrasi`.
- **Perbaikan:** Cek schema `guru_administrasi` untuk kolom tahun ajaran yang benar.
- **Status:** Belum Diperbaiki

### Bug #3: AI Monitoring — "Failed to get monitoring data" (TINGGI)
- **Fitur:** Billing Poin / AI Monitoring
- **Jenis:** Bug Teknis — Data Tidak Tampil
- **Root Cause:** Belum ditelusuri. Kemungkinan query ke tabel yang tidak ada.
- **Status:** Belum Diperbaiki

### Bug #4: Laporan Kinerja — "Failed to fetch laporan" (TINGGI)
- **Fitur:** Laporan Kinerja Guru
- **Jenis:** Bug Teknis — Query Gagal
- **Root Cause:** Belum ditelusuri.
- **Status:** Belum Diperbaiki

### Bug #5: Attendance — Pesan Error Tidak Informatif (MEDIUM)
- **Fitur:** Attendance (tanpa params)
- **Jenis:** Validasi Tidak Konsisten
- **Root Cause:** Tanpa param `type` return "Invalid type parameter" — tidak bilang param apa yang diharapkan.
- **Status:** Belum Diperbaiki

### Bug #6: Forum — Forbidden tanpa Konteks (MEDIUM)
- **Fitur:** Forum
- **Jenis:** Validasi Tidak Konsisten
- **Root Cause:** Guru-mandiri tanpa institusi tidak bisa akses forum. Ini sebenarnya expected behavior.
- **Status:** Bukan bug — dokumentasi perlu diperjelas.

---

## 3. RINGKASAN DATASET YANG DIHASILKAN

### Akun Test

| Email | Nama | Role | Status |
|-------|------|------|--------|
| `DEMO_guru-mandiri@test.gurupro.id` | Budi Santoso, S.Pd. | guru | free | `test123` |
| `DEMO_guru-instansi@test.gurupro.id` | Ani Wijaya, M.Pd. | guru | active | `test123` |
| `DEMO_kepala-sekolah@test.gurupro.id` | Dr. Hasan Basri, M.Si. | kepala_sekolah | active | `test123` |
| `DEMO_wakasek@test.gurupro.id` | Siti Rahayu, S.Pd. | wakasek | active | `test123` |
| `DEMO_operator@test.gurupro.id` | Ahmad Dahlan | operator | active | `test123` |
| `DEMO_bendahara@test.gurupro.id` | Rina Hartati | bendahara | active | `test123` |
| `DEMO_wali-kelas@test.gurupro.id` | Elisabeth Nur Hidayah, M.Pd. | guru | active | `test123` |
| `DEMO_pembina-ekskul@test.gurupro.id` | Hendra Wijaya | guru | active | `test123` |

### Institusi: 3 (DEMO_MTs Nurul Hikmah ID:3, TEST_SMP ID:1, TEST_SMA ID:2)
### Sekolah: 1 DEMO (f132dfd6-1b63-4e35-a120-a74eb8755c26)
### Kelas: 6 (VII-A s/d IX-B)
### Siswa: 103 (prefix `DEMO_`)
### Mata Pelajaran: 13
### Ekstrakurikuler: 6

---

## 4. HASIL VERIFIKASI CETAK/EKSPOR DOKUMEN

Semua dokumen belum bisa diverifikasi karena:
1. AI Generation butuh Gemini API key yang tidak tersedia di environment test
2. Raport Download butuh POST dengan student ID spesifik
3. Dataset seed dari `seed-test-data.ts` sudah include 918 siswa tambahan (prefix `TEST_`)

---

## 5. FITUR YANG BELUM ADA / TIDAK DITEMUKAN

| Fitur | Status | Bukti |
|-------|--------|-------|
| AI Rapor generation (`/api/ai/rapor`) | Tidak ada | 404 |
| AI Journal generation (`/api/ai/journal`) | Tidak ada | 404 |
| Evidence Log (`/api/evidence`) | Tidak ada | 404 |
| TPG Report (`/api/reports/tpg`) | Tidak ada | 404 |
| Perpustakaan (`/api/library`) | Tidak ada | 404 — tapi `/api/library/items` ada |

---

## 6. FITUR TAMBAHAN YANG DITEMUKAN (di luar checklist awal)

~40+ route/fitur tambahan ditemukan termasuk: Attendance (teacher/student), AI Monitoring, Billing mock, Leader contacts, Voice briefing, Well-being checkins, Teacher streaks, Layout Raport, Penilaian Sikap/Ekskul/Project, Laporan Evaluasi LKPD, Pemetaan Kolom, Prota/Promes, Brankas/Dokumen, Modul Ajar save, Export/Dapodik, Raport Kontak Eksternal, Face Enrollment, Storage, Admin CMS/Landing/Institutions/Transactions, Leave Requests, In-app Notifications, Leader View, Executive Dashboard, Attendance Devices/Schedule/Reports, dan banyak page dashboard tambahan.

---

## 7. REKOMENDASI

1. **Perbaiki Bug #1** (`getGuruOptionsForSchool`) — blocking fitur Wali Kelas
2. **Perbaiki Bug #2** (ATP) — cek kolom tahun ajaran di `guru_administrasi`
3. **Sediakan Gemini API Key test** — tanpa ini AI generation tidak bisa diuji
4. **Setup Active Context** untuk Guru Institusi — session `activeContext` perlu diset ke institusi ID
5. **Investigasi AI Monitoring dan Laporan Kinerja** — keduanya return 500
6. **Dataset DEMO sudah siap** — 103 siswa, 6 kelas, 8 akun, 3 institusi. Siap dipakai untuk testing manual di UI setelah bug diperbaiki.

---

## 8. SCRIPT YANG DIBUAT

| Script | Fungsi |
|--------|--------|
| `scripts/setup-test-accounts.ts` | Buat 8 akun test |
| `scripts/seed-test-data.ts` | Seed data baseline (918 siswa, 49 kelas) |
| `scripts/setup-demo-institution.ts` | Setup institusi DEMO_MTs Nurul Hikmah |
| `scripts/test-all-features.ts` | HTTP test 23+ endpoint |
| `delete-dummy-data.js` | Hapus semua data non-sistem |
