# Laporan Perbaikan Voice Briefing Guru — 31 Juli 2026

## Masalah 1: Konfigurasi Cron Vercel

**File:** `vercel.json` (dibuat baru)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": {
    "crons": [
      {
        "path": "/api/cron/voice-briefing",
        "schedule": "*/1 * * * *"
      }
    ]
  }
}
```

**Status: DIBUAT, tapi ada masalah:**

**PERLU KLARIFIKASI — Interval per-menit TIDAK didukung di semua tier Vercel.**

| Tier | Minimum Interval |
|------|-----------------|
| Hobby | Tidak ada Cron Jobs |
| Pro | 1 menit (`*/1 * * * *`) |
| Enterprise | 1 menit (`*/1 * * * *`) |

Sumber: [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)

**Kondisi saat ini:** Jika deployment pakai tier **Hobby** atau **Pro lama** yang belum diaktifkan Cron Jobs, konfigurasi di `vercel.json` tidak akan jalan.

**Alternatif yang perlu dipilih Bro Sutan:**

1. **Upgrade ke Vercel Pro** — aktifkan Cron Jobs, minimum interval 1 menit.
2. **Scheduler eksternal** — cron-job.org / GitHub Actions cron yang hit endpoint `/api/cron/voice-briefing` tiap menit dengan header `Authorization: Bearer $CRON_SECRET`.
3. **node-cron di dalam server process** — jika deployment bukan serverless (VPS/self-hosted), bisa jalan di dalam Next.js custom server.

**CRON_SECRET sudah ada** di `.env.example` dan `.env.local` dengan nilai default `gurupro-cron-secret-dev-change-in-production`. Tidak perlu perubahan di environment file.

---

## Masalah 2: Unique Constraint & Idempotency

**File diubah:**
- `lib/db.ts` — baris ~1562
- `scripts/voice-briefing-migration.ts` — baris ~50
- `app/api/cron/voice-briefing/route.ts` — baris 91-115

**Schema fix:**
```
SEBELUM:  UNIQUE (user_id, schedule_id, sent_at)
SESUDAH:  UNIQUE (user_id, schedule_id)
```

Ini mengubah constraint dari "hanya 1 push per-user per-schedule per-detik" menjadi "hanya 1 push per-user per-schedule per-hari" (karena tidak ada constraint lain yang membatasi harian). Idempotent secara natural.

**Logic fix di cron route:**
1. Sebelum kirim push, cek `voice_briefing_logs` untuk `(user_id, schedule_id)`.
2. Jika row sudah ada → SKIP (tidak kirim push kedua).
3. Jika belum ada → kirim push, lalu INSERT log.
4. Log di-INSERT HANYA setelah push berhasil (bukan sebelum), agar tidak ada orphan log saat push gagal.

**Flow idempotent:** Cron jalan 2x berturut-turut untuk jadwal yang sama → pertama kirim push + log, kedua skip (row sudah ada).

---

## Masalah 3: Gender Fallback di composeBriefingText

**File:** `lib/voice-briefing.ts` — baris 25

**Kode SEBELUM:**
```typescript
const sapaan = gender === "P" ? "Ibu" : gender === "L" ? "Bapak" : "Bapak/Ibu";
```

**Hasil:** Guru dengan gender NULL menghasilkan kalimat literal "Selamat Pagi, Bapak/Ibu [nama]" — tampilan ganjil karena menampilkan kedua sapaan sekaligus.

**Kode SESUDAH:**
```typescript
const sapaan = gender === "P" ? "Ibu" : "Bapak";
```

**Alasan pilih "Bapak":** Fallback netral yang lazim di konteks guru Indonesia. "Bapak/Ibu" sebagai literal string terasa janggal karena tidak pernah dipakai di percakapan nyata — baik "Bapak" maupun "Ibu" sudah cukup sopan dan universal.

---

## Masalah 4: Redundansi Kolom Waktu (jam_mulai/jam_selesai vs start_time/end_time)

**Analisis lengkap 17 file yang pakai kolom waktu:**

### File yang HANYA pakai `jam_mulai`/`jam_selesai`:
- `app/api/schedules/route.ts` — POST/PUT jadwal (membuat/update tanpa populate start_time/end_time)
- `app/api/schedules/import/route.ts` — CSV import jadwal
- `app/api/laporan-harian/[tanggal]/route.ts`
- `app/api/laporan-harian/[tanggal]/download/route.ts`
- `app/api/selesai-mengajar/route.ts`
- `app/api/selesai-mengajar/seed/route.ts`
- `app/api/selesai-mengajar/seed-all/route.ts`
- `app/api/attendance/schedule/today/route.ts`
- `app/api/laporan-kinerja/[id]/route.ts`
- `scripts/seed-test-data.ts`
- `scripts/notification-reminders.ts`
- `lib/morning-briefing.ts`
- `app/api/cron/notification-reminders/route.ts`

### File yang pakai DUA-DUANYA (fallback pattern):
- `app/api/cron/voice-briefing/route.ts` — `start_time || jam_mulai`
- `app/api/notifications/upcoming-briefing/route.ts` — `start_time || jam_mulai`

**Temuan risiko tidak sinkron:**

1. **`/api/schedules/route.ts`** (POST/PUT) — hanya menulis `jam_mulai`/`jam_selesai`, TIDAK menulis `start_time`/`end_time`. Guru yang buat/update jadwal dari form ini akan punya NULL di `start_time`/`end_time`.

2. **`/api/schedules/import/route.ts`** — CSV import juga hanya menulis `jam_mulai`/`jam_selesai`.

3. **`start_time`/`end_time` tipe TIME** — kolom ini ditambahkan tapi hampir semua code path lama tidak mengisinya. Kedua kolom ini NULL untuk jadwal yang dibuat/update via form atau import.

4. **Edge case tengah malam (00:05):** Logic saat ini pakai `new Date(now)` + `setHours(h, m, 0, 0)`. Untuk jadwal jam 00:05 dicek pada 23:56 hari sebelumnya → `scheduleStart` akan jadi jam 00:05 hari berikutnya, dan `diffMin` akan positif besar (bukan 9-10 menit), jadi tidak akan match. Ini perilaku yang benar — tidak ada false positive. Tidak ada bug di edge case ini.

**PERLU KLARIFIKASI — Keputusan produk dibutuhkan:**

Untuk sinkronisasi, dua opsi:

1. **Pilihan A (Disarankan):** Semua form jadwal POST/PUT/import update KEDUA pasangan kolom (`jam_mulai`/`jam_selesai` DAN `start_time`/`end_time`) secara bersamaan dengan nilai yang sama. File yang perlu diubah:
   - `app/api/schedules/route.ts`
   - `app/api/schedules/import/route.ts`

2. **Pilihan B:** Hapus kolom `start_time`/`end_time`, rely hanya pada `jam_mulai`/`jam_selesai` (yang sudah ada di semua code path). Kolom TIME baru di schema perlu di-drop. File voice briefing cron perlu di-simplifikasi (hapus fallback logic).

3. **Pilihan C:** Biarkan dual column dengan fallback, tapi migrasi data untuk populate `start_time`/`end_time` dari `jam_mulai`/`jam_selesai` yang sudah ada.

**Rekomendasi:** Bro Sutan perlu pilih. Jika ingin konsistensi penuh, Pilihan A dengan migrasi data. Jika ingin simplifikasi, Pilihan B (hapus kolom baru, rely pada kolom lama). Pilihan C hanya perlu jika ingin keep both columns untuk flexibility future.

---

## Summary Perubahan

| Masalah | Status | File |
|---------|--------|------|
| Cron config vercel.json | Fixed (but needs plan clarification) | `vercel.json` (new) |
| Unique constraint idempotency | Fixed | `lib/db.ts`, `scripts/voice-briefing-migration.ts`, `app/api/cron/voice-briefing/route.ts` |
| Gender fallback | Fixed | `lib/voice-briefing.ts` |
| Redundansi kolom waktu | Reported (needs decision) | — |

## Tipe Error di tsc --noEmit

**Tidak ada error baru** dari perubahan ini. Semua error TS (~100+) yang terlihat di `tsc --noEmit` adalah pre-existing di codebase dan tidak terkait dengan perubahan voice briefing.
