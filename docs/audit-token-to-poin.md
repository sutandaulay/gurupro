# LAPORAN AUDIT — Migrasi Token → Poin (GuruPRO AI)

**Tanggal audit:** 2026-07-18
**Sesi:** Audit mandiri (sebelum eksekusi perubahan)
**Status:** ⛔ BELUM EKSEKUSI — menunggu persetujuan (khususnya strategi migrasi data & scope perubahan di luar rencana awal)

---

## 1. RINGKASAN EKSEKUTIF

Prompt memintA migrasi **Token → Poin** dengan prasyarat **Fase 0** (refactor ke token mentah + abstraksi provider). Dari audit codebase, ditemukan bahwa **sebagian besar Fase 1 SUDAH ADA** (tabel `poin_transactions`, service `poin-service.ts`, `convertTokensToPoin`, `calculateEffectiveTokens`, interface `AIUsageResult`-like di `ai-usage.ts`). Namun ada **celah kritis** yang membuat sistem Poin saat ini **tidak akurat dan tidak konsisten**:

1. **Dua sistem kuota berjalan berdampingan** — sistem Poin baru (sebagian route) DAN sistem Token legacy flat (`token-system.ts`, "1 generate = 1 unit") di route lain.
2. **AI multi-vendor (`lib/ai.ts`) TIDAK mengembalikan usage metadata** → route yang pakai `lib/ai.ts` tapi legacy token hanya potong **flat 1 unit**, bukan raw token. Ini persis "1 generate = 1 unit" yang diwarnakan prompt.
3. **`lib/payments.ts` masih menulis `token_limit`** (legacy), BUKAN `quota_poin_total`. Akibatnya: saat user bayar paket/langganan, **Poin TIDAK nambah** (kolom poin tetap 0 / NULL).
4. **Migration `11_migrate_token_to_poin.sql` SUDAH ADA tapi TIDAK terdaftar** di `migrations/index.ts` dan TIDAK dijalankan oleh `lib/db.ts` → status DB aktual belum dipastikan (perlu konfirmasi, lihat §6).
5. **Config AI (model + API key) tersimpan di tabel `system_settings.ai_config`**, BUKAN Payload Collection. Field rasio Poin sebaiknya ditaruh di `system_settings` (satu tempat dangan config model) — BUKAN bikin sistem terpisah, sesuai guardrail.

---

## 2. PEMETAAN TITIK PEMANGGILAN AI & STATUS KUOTA

### 2A. Route yang SUDAH pakai sistem Poin (`consumeUserPoin` + `extractGeminiUsage`)
Sumber token diambil dari `poinCalc.rawTokens` (dari `extractGeminiUsage` / `calculatePoinFromTokens` yang baca `usageMetadata` Gemini).

| Route | Feature key | Sumber AI | Catatan |
|---|---|---|---|
| `app/api/ai/chat/route.ts` | ai-chat | `lib/ai.ts` (multi-vendor) | ⚠️ `lib/ai.ts` TDK return usage |
| `app/api/ai/journal/generate/route.ts` | ai-journal-generate | `lib/ai.ts` | ⚠️ |
| `app/api/ai/laporan-kinerja/route.ts` | ai-laporan-kinerja | `lib/ai.ts` | ⚠️ |
| `app/api/ai/rapor/generate/route.ts` | ai-rapor-generate | `lib/ai.ts` | ⚠️ |
| `app/api/assessments/ai/route.ts` | assessments-ai | `lib/ai.ts`? | perlu cek |
| `app/api/atp/generate/route.ts` | generate-atp | `lib/ai.ts` | ⚠️ |
| `app/api/chatbot/route.ts` | chatbot | `lib/ai.ts` | ⚠️ |
| `app/api/generate-administrasi/route.ts` | generate-administrasi | `lib/ai.ts` | ⚠️ |
| `app/api/generate-image/route.ts` | generate-image | `lib/ai.ts` | ⚠️ |
| `app/api/generate-laporan-evaluasi-lkpd/route.ts` | generate-laporan-evaluasi-lkpd | `lib/ai.ts` | ⚠️ |
| `app/api/generate-lkpd/route.ts` | generate-lkpd | `lib/ai.ts` | ⚠️ |
| `app/api/generate-prosem/route.ts` | generate-prosem | `lib/ai.ts` | ⚠️ |
| `app/api/generate-prota/route.ts` | generate-prota | `lib/ai.ts` | ⚠️ |
| `app/api/generate-soal/route.ts` | generate-soal | `lib/ai.ts` | ⚠️ |
| `app/api/raport/generate-deskripsi-capaian/route.ts` | generate-deskripsi-capaian | `lib/ai.ts` | ⚠️ |
| `app/api/regenerate-soal/route.ts` | regenerate-soal | `lib/ai.ts` | ⚠️ |
| `app/api/silabus/generate/route.ts` | generate-silabus | `lib/ai.ts` | ⚠️ |
| `app/api/teaching-session/complete/route.ts` | teaching-session-complete | `lib/ai.ts` | ⚠️ |

> **⚠️ Masalah Fase 0 kritis:** Hampir semua route Poin mengambil `rawTokens` dari `extractGeminiUsage`/poinCalc, TAPI `poinCalc` tersebut diisi dari **estimasi** (`estimateFeaturePoinCost`, default 2) atau dari `lib/ai.ts` response yang **TIDAK membawa usage metadata**. Perlu verifikasi per-route apakah `poinCalc.rawTokens` benar-benar berisi raw token Gemini atau cuma estimasi flat.

### 2B. Route yang MASIH pakai sistem Token LEGACY (FLAT "1 generate = 1 unit") — HARUS dikonversi
| Route | Feature | Kode kuota | Sumber AI |
|---|---|---|---|
| `app/api/bahan-ajar/generate/route.ts` | bahan-ajar | `consumeUserToken(userId, N)` | `lib/ai/generators.ts` (estimasi) |
| `app/api/bahan-ajar/[id]/export/route.ts` | bahan-ajar-export | `getUserTokenAccess` | — |
| `app/api/bahan-ajar/[id]/regenerate/route.ts` | bahan-ajar-regenerate | `getUserTokenAccess` + `consumeUserToken` | `lib/ai/generators.ts` |
| `app/api/bahan-ajar/[id]/route.ts` | bahan-ajar | `getUserTokenAccess` | — |
| `app/api/journals/ai/route.ts` | journals-ai | `consumeUserToken(userId, 1)` | `lib/ai.ts` + `generateJournal` |
| `app/api/selesai-mengajar/route.ts` | selesai-mengajar | `consumeUserToken(guruId, 1)` | `lib/ai.ts` |
| `app/api/soal/save/route.ts` | soal-save | `getUserTokenAccess` | — |

> Ini adalah **BUG KRITIS** sesuai prompt: route ini memotong **flat 1 unit**, TIDAK terhubung ke raw token = pelanggaran audit "1 generate = 1 unit".

### 2C. Route yang pakai `lib/ai.ts` TAPI TIDAK memotong kuota sama sekali?
Dari mapping: semua consumer `lib/ai.ts` sudah ter-cover di 2A/2B (ada call `consumeUserToken` atau `consumeUserPoin`). **TIDAK ditemukan route "gratis tanpa potong kuota"** selama audit statis. (Konfirmasi dinamis perlu test e2e.)

---

## 3. TEMUAN FASE 0 — APA YANG SUDAH / BELUM

### ✅ SUDAH ADA
- `src/config/billing.ts`: `convertTokensToPoin()` (ceil + min 1), `calculateEffectiveTokens()` (cached token discount 0.1), `TOKENS_PER_POIN=2000` (MASIH hardcoded — perlu jadi setting), `GEMINI_PRICING`.
- `src/lib/ai-usage.ts`: `AIUsageMetadata` + `extractGeminiUsage()` (baca `usageMetadata.promptTokenCount/candidatesTokenCount/cachedContentTokenCount`). **Ini sudah bentuk adapter Gemini standar.**
- `src/services/poin-service.ts`: `consumeUserPoin()` dengan **transaction + `SELECT ... FOR UPDATE`** (atomic ✓), urutan main→addon ✓, grace period 14 hari ✓, ledger `poin_transactions` ✓.
- `lib/ai/generators.ts`: `generateAIContent` Gemini sudah kembalikan `rawUsage` (format Gemini).
- `collections/AddonTokenPackages.ts`: SUDAH pakai `poin_amount` + label "Poin".

### ❌ BELUM / CELAH
1. **TIDAK ada interface `AIUsageResult` terpusat** seperti diminta prompt (`{inputTokens, outputTokens, cachedTokens?, provider, model}`). Yang ada: `AIUsageMetadata` (hanya Gemini) + `rawUsage` (hanya Gemini). **TIDAK ada adapter OpenAI/Claude/DeepSeek** padahal `lib/ai.ts` mendukung ke-4 vendor.
2. **`lib/ai.ts` (multi-vendor) TIDAK mengembalikan usage metadata** → semua route yang pakai `lib/ai.ts` tidak bisa dapat raw token dari OpenAI/Claude/DeepSeek. **Ini blok Fase 0 untuk non-Gemini.**
3. **Rasio `TOKENS_PER_POIN` masih hardcoded** di `billing.ts` — prompt minta jadi setting admin dashboard + cache + invalidation.
4. **TIDAK ada field `ratio_used_at_transaction`** di `poin_transactions` (hanya `poin_deducted`, `raw_tokens`, `source`). Prompt WAJIBkan ini.
5. **TIDAK ada audit log terpisah untuk perubahan rasio** (siapa/dari-ke/kapan).
6. **`consumeUserPoin` memanggil `convertTokensToPoin(rawTokens)` TANPA menerima rasio** — artinya masih pakai constant hardcoded, BUKAN rasio dari cache setting.
7. Ledger `poin_transactions` belum punya kolom `ratio_used_at_transaction`, `cached_tokens`.

---

## 4. TEMUAN KRITIS — INTEGRITAS DATA

### 🔴 C1: `lib/payments.ts` menulis kolom LEGACY `token_limit`, bukan `quota_poin_total`
`activateTransaction()` (baris 83-94) dan `processSuccessPayment()` → `token_limit = token_limit + plan.tokens`.
**Dampak:** User yang bayar paket/get langganan → `token_limit` naik, TAPI `quota_poin_total` tetap 0/NULL → user LIAT Poin 0 padahal sudah bayar. Sistem Poin "buta" terhadap top-up.
**Perlu:** ubah penulisan ke `quota_poin_total` (konversi `plan.poin` atau `plan.tokens / rasio`).

### 🔴 C2: Grant/topup add-on legacy
`grantAddonPoin()` (poin-service) SUDAH tulis `addon_poin` ✓. Tapi `grantUserTokens()` (token-system, legacy) masih tulis `token_limit`. Perlu pastikan alur top-up add-on via CMS pakai `poin-service.grantAddonPoin`.

### 🔴 C3: Migration `11_migrate_token_to_poin.sql` belum terdaftar/dijalankan
- `migrations/index.ts` HANYA mendaftarkan `20260705_090252_add_institutions`.
- `lib/db.ts` `initDb()` membuat `addon_token_balance`, `token_limit` (legacy) TAPI **TIDAK** membuat `quota_poin_total`/`addon_poin`/`poin_transactions`.
- Migration `.sql` dijalankan manual (di luar runner). **Status DB aktual BELUM dikonfirmasi** (query probe gagal karena escaping shell).

### 🟡 C4: `lib/ai/generateBahanAjar.ts` pakai estimasi token, bukan raw
`generateBahanAjar()` menghitung `accumulatedTokens` dari `TOKEN_ESTIMATES` konstan (bukan dari `usageMetadata`), lalu `consumeUserToken(accumulatedTokens)` (legacy). Ini flat-estimasi, bukan raw token.

---

## 5. STRATEGI MIGRASI DATA HISTORIS (WAJIB LAPOR SEBELUM EKSEKUSI)

Data lama (`token_limit`, `addon_token_balance`) adalah **flat unit**, BUKAN token mentah → **TIDAK bisa direkonstruksi** ke raw token (sesuai instruksi prompt: jangan coba rekonstruksi).

**Opsi yang diusulkan (sudah selaras dangan `11_migrate_token_to_poin.sql` yang ada):**
- **Legacy record dibiarkan apa adanya** sebagai snapshot (via view `v_users_token_backup` yang SUDAH didefinisikan di migration 11).
- **Data baru pakai token mentah** (pasca-Fase 0).
- **Konversi nilai kuota:** `quota_poin_total = CEIL(token_limit / rasio_default_awal)` dengan `rasio_default = 2000` (sama dangan migration 11), `MIN 1`. Begitu juga `addon_poin = CEIL(addon_token_balance / 2000)`.
- **Grace period 14 hari** diberikan ke add-on existing (sudah ada di migration 11 PART 6).
- **TIDAK mengubah** `students`, TAMS/Buku Nilai, OTP (guardrail).

**JUMLAH DATA TERDAMPAK (perlu konfirmasi DB, estimasi dari struktur):**
- `users` dengan `token_limit > 0` → dikonversi ke `quota_poin_total`.
- `users` dengan `addon_token_balance > 0` → dikonversi ke `addon_poin`.
- `pricing_plans` → kolom `poin` (sudah ada di migration 11).
- `addon_token_packages` → kolom `poin_amount` (sudah ada di migration 11 + collection CMS).

> ⚠️ **BUTUH KONFIRMASI:** Apakah migration 11 SUDAH di-apply ke DB produksi/dev? Jika BELUM, kita jalankan sebagai bagin dari eksekusi. Jika SUDAH, kita lanjut ke penambahan kolom `ratio_used_at_transaction` + audit log rasio.

---

## 6. RENCANA EKSEKUSI (DRAFT — minta persetujuan)

### Fase 0 (Prasyarat)
1. **Buat `src/lib/ai-usage.ts` → `AIUsageResult` terpusat** (provider-agnostic) + adapter per vendor:
   - `adaptGeminiUsage(raw)` (dari `usageMetadata`).
   - `adaptOpenAIUsage(...)`, `adaptClaudeUsage(...)`, `adaptDeepSeekUsage(...)` — dibutuhkan karena `lib/ai.ts` multi-vendor TIDAK return usage.
2. **Modifikasi `lib/ai.ts`** agar `generateAIContent` mengembalikan `usage` (raw token per vendor) → semua route dapat raw token.
3. **Hapus/refactor `token-system.ts`** legacy flat → redirect ke `poin-service`. Route 2B dikonversi ke `consumeUserPoin` + raw token.
4. **`lib/payments.ts`** → tulis `quota_poin_total` (C1).

### Fase 1
5. **Rasio dinamis:** tambah `system_settings` key `tokens_per_poin` (positif >0, default 2000) + in-memory cache + invalidation saat admin ubah. Field di admin settings (`app/api/admin/settings`).
6. **`convertTokensToPoin(totalTokens, ratio)`** terima rasio dari cache (bukan constant).
7. **Ledger `poin_transactions`:** tambah `ratio_used_at_transaction`, `cached_tokens`. **Audit log rasio:** tabel `poin_ratio_audit` (admin, from, to, timestamp).
8. **Migration Drizzle/SQL** baru: tambah kolom ledger + (jika belum) kolom poin users. Jalankan `11_migrate_token_to_poin.sql` jika belum.
9. **Zod schema:** `quotaPoin`/`addonPoin` (ganti `quotaTokens`/`tokenLimit` di schema relevan).
10. **UI label** "Token" → "Poin" (cek `app/(app)/admin`, dashboard user, FAQ `lib/settings.ts` default, landing copy).
11. **Unit test** `convertTokensToPoin` (rasio 2000/2500/3000) + **concurrency test** (`FOR UPDATE` no oversell).

---

## 7. PERTANYAAN UNTUK USER (BUTUH KEPUTUSAN)

1. **Apakah migration `11_migrate_token_to_poin.sql` SUDAH di-apply ke DB yang sedang dipakai?** (Menentukan apakah kita jalankan migration lama atau lanjut tambah kolom.)
2. **Setujukah strategi migrasi data (§5)** — konversi `/2000` ceil min-1, legacy dibiarkan sebagai backup view?
3. **Perilaku saat Poin tidak cukup** (prompt minta pilih):
   - (a) Tolak SEBELUM panggil API (estimasi kasar), atau
   - (b) Izinkan generation, lalu catat `over_quota` untuk ditagih siklus berikut?
4. **Vendor non-Gemini (OpenAI/Claude/DeepSeek):** karena `lib/ai.ts` multi-vendor TIDAK return usage, maukah kita **wajibkan adapter usage** untuk tiap vendor (butuh effort + tiap vendor punya format beda), atau **batasi akurasi raw token ke Gemini dulu** dan pakai estimasi untuk vendor lain?
5. **Scope:** route 2B (bahan-ajar, journals, selesai-mengajar, soal/save) berada di luar "daftar contoh" prompt tapi JELAS termasuk fitur generate → saya akan masukkan ke scope konversi. Setuju?

---

## 8. KESIMPULAN

Sistem Poin **sudah dirintis** (service, ledger, konversi, label CMS sebagian) TAPI **TIDAK konsisten dan TIDAK akurat** karena:
- Dua sistem kuota berjalan berdampingan.
- AI multi-vendor tidak return usage → raw token tidak tersedia (blok Fase 0 untuk non-Gemini).
- Payment masih tulis kolom legacy → Poin tidak nambah saat bayar.
- Rasio masih hardcoded, ledger belum simpan `ratio_used_at_transaction`.

**Rekomendasi:** Setujui §5 + jawab §7, lalu eksekusi Fase 0 (adapter + `lib/ai.ts` usage + cabut legacy) SEBELUM Fase 1. Jangan lompat ke konversi Poin sebelum Fase 0 tervalidasi.

**BELUM ADA SATUPUN PERUBAHAN KODE YANG DIEKSEKUSI.**
