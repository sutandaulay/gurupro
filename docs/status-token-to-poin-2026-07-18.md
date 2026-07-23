# STATUS EKSEKUSI — Token → Poin (HENTI SEMENTARA, PERLU ARAH)

**Tanggal:** 2026-07-18
**Status:** ⛔ DIHENTIKAN — scope meluas & berisiko breaking, perlu keputusan Anda.
**Sesuai guardrail:** "Jika perubahan menyentuh area di luar scope, STOP dan buat laporan dulu."

---

## 1. YANG SUDAH SELESAI & TERVERIFIKASI

### Fase 0 (prasyarat) ✅
- `src/lib/ai-usage-result.ts` (BARU): `AIUsageResult` terpusat + adapter `adaptGeminiUsage`/`adaptOpenAIUsage`/`adaptClaudeUsage`/`adaptDeepSeekUsage`.
- `lib/ai.ts`: return `{ success, data, error, rawUsage, usage }` — `usage: AIUsageResult` diisi dari tiap vendor (Gemini via `usageMetadata`, OpenAI/DeepSeek via `data.usage`, Claude via `data.usage`). Multi-vendor = WAJIB (DB `default_vendor="deepseek"`).
- `src/services/poin-service.ts`: `consumeUserPoin` pakai rasio dari **cache**; ledger `poin_transactions` simpan `ratio_used_at_transaction` + `cached_tokens`; helper `consumeUserPoinFromUsage(usage: AIUsageResult, ...)`; `logFailedPoinUsage` simpan rasio.
- `lib/payments.ts`: `activateTransaction` kini menulis **`quota_poin_total`** (fix C1: Poin naik saat bayar paket).

### Fase 1 (kritis) ✅
- `src/config/ratio-cache.ts` (BARU): rasio `tokens_per_poin` di-cache (TTL 5 mnt) + `invalidateTokensPerPoinCache()`.
- `src/config/billing.ts`: `convertTokensToPoin(totalTokens, ratio)` **dinamis** (fallback 2000).
- **Migration 12 dijalankan via psql — TERVERIFIKASI**: `quota_poin_total` terkonversi (9999→5, 5→1), tabel `poin_ratio_audit` + kolom ledger baru ada, `tokens_per_poin=2000` tersimpan.

---

## 2. TEMUAN KRITIS SAAT EKSEKUSI (PENYEBAB HENTI)

### 🔴 Scope meluas jauh dari estimasi
Audit awal memperkirakan ~25 route. Faktanya **~35+ file** terlibat, dengan **DUA versi `generateAIContent` yang bentrok**:
- `lib/ai.ts` → return **object** `{success, data, usage}` (dipakai generate-soal, ai/chat-via-generators, assessments, atp, silabus, lkpd, prota, prosem, administrasi, laporan-evaluasi-lkpd, chatbot, regenerate-soal, journals/ai, selesai-mengajar).
- `lib/ai/generators.ts` → return **`GenerationResult<T>`** dengan `.data`, `.rawUsage`, `.usage` (dipakai ai/chat, ai/journal, ai/rapor, teaching-session/complete, bahan-ajar via generateBahanAjar).
- Beberapa route (raport/generate-deskripsi-capaian, generate-image, teaching-session/complete) malah memanggil **Gemini SDK langsung** (`model.generateContent` → `.response.text()`).

### 🔴 Refactor route berisiko breaking
Saya sudah ubah 22 route ke `deductPoinFromAIResult(result, ...)`. Tapi ditemukan:
- `ai/chat` & `teaching-session/complete` memanggil `generators.ts` (bukan `lib/ai.ts`) → `result.data?.response` bukan `result.data`. Edit saya di `ai/chat` jadi **SALAH** (pakai `result.usage` padahal harus `journalResult.usage` dari generators).
- `raport/generate-deskripsi-capaian`, `generate-image`, `teaching-session/complete` **BELUM diubah** (masih `calculatePoinFromTokens` + `consumeUserPoin(poinCalc.rawTokens)` + `rawUsage` dari SDK langsung).
- TypeScript compile **GAGAL** (errors di ai/chat, assessments, atp, lkpd, prosem, prota, administrasi, soal, journals/ai) karena:
  - Nama fungsi `deductPoinFromAIResult` (di `ai-usage.ts`) vs import `deductPoinFromAIResult` (di routes) — sudah saya re-export dari `poin-service`, tapi ada route pakai `.trim()`/`.response` yang tidak ada di `AIResponse`.

### 🔴 Git working tree already dirty sebelum sesi ini
`git status` menunjukkan banyak file "M" yang **bukan** saya ubah hari ini (preexisting uncommitted changes dari sesi sebelumnya). Saya tidak bisa asal `git checkout` takut menghapus work orang lain. `git stash@{0}` berisi "backup sebelum reset" (`lib/ai.ts` object-version saat saya panik tadi) — bukan backup seluruh sesi.

---

## 3. KONDISI SAAT INI (RISIKO)

- **Aplikasi dalam state setengah-refactor**: sebagian route sudah pakai `deductPoinFromAIResult` (benar), sebagian masih legacy, sebagian SALAH (`ai/chat`).
- `lib/ai.ts` sudah diubah ke object-return → route yang belum diupdate & mengharapkan string akan **GAGAL** (JSON.parse object).
- **TypeScript compile error** → `next build`/`dev` akan gagal sampai diperbaiki.
- **DB sudah termigrasi** (migration 12 sukses) — itu irreversible tanpa rollback script terpisah.

---

## 4. PILIHAN UNTUK ANDA

**A. Rollback semua perubahan saya (REKOMENDASI paling aman)**
- `git stash` / `git checkout` hanya file yang **saya** ubah hari ini (harus identifikasi hati-hati vs preexisting dirty).
- Kembalikan `lib/ai.ts` ke string-return (versi aman).
- Biarkan sistem Poin tetap di state "dirintis tapi inkonsisten" seperti sebelum sesi ini.
- DB migration 12 **biarkan** (sudah aman, idempoten) ATAU rollback via script terpisah.

**B. Lanjut refactor penuh (risiko tinggi)**
- Saya perbaiki `ai/chat` & `teaching-session/complete` agar pakai `generators.ts` format (`.usage` bukan `.data?.response`).
- Update sisa 3 route (raport/deskripsi, generate-image, teaching-session) ke `deductPoinFromAIResult`.
- Fix semua TS errors, verifikasi `next build`.
- Risiko: butuh sentuh ~35 file, kemungkinan typo/breaking tinggi.

**C. Hybrid (paling praktis)**
- Rollback `lib/ai.ts` ke **string-return** (kembalikan ke aman).
- Buat **wrapper `generateAIContentWithUsage()`** yang return `{text, usage: AIUsageResult}` untuk route yang butuh usage.
- Update HANYA route yang butuh raw token ke wrapper ini (tidak ubah 35 file sekaligus).
- Inti Fase 0/1 (adapter, poin-service, billing, ratio-cache, migration DB) **tetap dipakai**.

---

## 5. FILE YANG SAYA UBAH HARI INI (untuk rollback terarah)

**BARU:** `src/lib/ai-usage-result.ts`, `src/config/ratio-cache.ts`, `migrations/12_poin_ledger_and_ratio_audit.sql`, `scratch/run-migration-12.ts`, `scratch/probe-*.ts`, `docs/audit-token-to-poin.md`, `docs/status-token-to-poin-2026-07-18.md`.

**MODIFIKASI:** `lib/ai.ts`, `src/services/poin-service.ts`, `src/config/billing.ts`, `src/lib/ai-usage.ts`, `lib/payments.ts`, `lib/ai/generateBahanAjar.ts`, + 22 route API (journals/ai, selesai-mengajar, bahan-ajar/generate, soal/save, generate-soal, ai/chat, ai/journal, ai/rapor, ai/laporan-kinerja, assessments, atp, silabus, lkpd, prota, prosem, administrasi, laporan-evaluasi-lkpd, chatbot, regenerate-soal).

**BELUM DIUBah (sisa):** raport/generate-deskripsi-capaian, generate-image, teaching-session/complete, bahan-ajar/[id]/* (pre-check legacy).

---

**Saya menunggu arahan Anda: A (rollback), B (lanjut penuh), atau C (hybrid). Saya TIDAK akan asal rollback/hapus tanpa konfirmasi karena git tree sudah dirty dari sesi sebelumnya.**
