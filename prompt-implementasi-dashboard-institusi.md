# Prompt Implementasi — Dashboard Institusi GuruPRO AI

> Rujukan spek lengkap: `spesifikasi-dashboard-institusi-gurupro-v2.md`
> Stack: Next.js 16.2.9 (webpack, bukan Turbopack), Payload CMS 3.x, Drizzle ORM, PostgreSQL, TypeScript, Cloudflare R2

## Aturan Kerja
- Perbaikan/implementasi dilakukan **inline per tahap**, kecuali 3 kategori sensitif berikut yang **wajib approval dulu** sebelum eksekusi:
  1. Migrasi database berisiko (perubahan skema `institution_members`, `teacher_institution_assignments`, tabel raport)
  2. Logika billing Poin (perhitungan konsumsi, saldo, proyeksi)
  3. Perubahan RBAC lintas tenant
- Setiap tahap selesai → laporkan ke Claude untuk review strategis sebelum lanjut ke tahap berikutnya.
- Semua widget presensi/assignment **wajib** membaca dari satu data layer bersama (`payload.institution_members` sebagai source of truth) — jangan buat query baru ke `teacher_institution_assignments`.

---

## Tahap 1 — Fix Bug `todaySummary` (BLOCKER)

**File:** `teacher-dashboard/route.ts`

**Tugas:**
1. Investigasi root cause bug `todaySummary` — cek apakah polanya sama dengan bug presensi lama (query ke tabel/field yang salah atau kosong).
2. Trace data flow: dari mana `todaySummary` seharusnya ambil data (presensi, jadwal, raport pending) dan bandingkan dengan query yang ada sekarang.
3. Perbaiki inline (bukan kategori sensitif) — tapi kalau perbaikan ternyata menyentuh skema tabel, **stop dan minta approval** dulu.
4. Tulis test case sederhana untuk memastikan `todaySummary` konsisten dengan data presensi & raport guru yang sebenarnya.
5. Laporkan: apa root cause-nya, apa fix-nya, dan apakah ada pola serupa di endpoint lain yang berpotensi bug sama.

**Kriteria selesai:** `todaySummary` menampilkan data akurat untuk minimal 3 guru dengan kondisi data berbeda (guru lengkap datanya, guru dengan assignment kosong, guru dengan raport pending).

---

## Tahap 2 — Widget Assignment Guru-Kelas-Mapel (Operator)

**Tugas:**
1. Buat query untuk menampilkan daftar guru yang belum ter-assign ke kelas/mapel manapun, dibaca dari `payload.institution_members`.
2. Buat form assignment: pilih guru → pilih kelas + mapel → opsional assign sub-role (Wali Kelas / Pembina Ekskul).
3. Simpan assignment **hanya** ke `payload.institution_members` — pastikan tidak ada tulisan paralel ke `teacher_institution_assignments` (tabel lama).
4. Tambahkan validasi konflik jadwal sederhana (guru yang sudah full jam mengajar).
5. Laporkan: berapa banyak guru existing yang saat ini punya data assignment tidak lengkap/konsisten (data cleanup mungkin diperlukan — **ini masuk kategori migrasi berisiko kalau butuh bulk update, minta approval**).

**Kriteria selesai:** Operator bisa assign guru ke kelas+mapel+sub-role dalam satu form, dan hasilnya langsung konsisten kalau di-query dari dashboard KS/Guru.

---

## Tahap 3 — Dashboard Kepala Sekolah: Kehadiran + Alert Panel + Progress e-Raport 3 Lapis

**Tugas:**
1. Widget Ringkasan Kehadiran — reuse data layer presensi yang sudah dipakai dashboard guru (jangan query ulang dari nol).
2. Alert Panel — logic untuk flag: guru telat berulang (≥3x/minggu), kelas kehadiran <80%, guru belum submit raport mendekati deadline, guru belum ter-assign kelas (tarik dari hasil Tahap 2).
3. Widget Progress e-Raport 3 Lapis — tampilkan posisi tiap raport ada di lapis mana (bukan cuma persentase submit).
4. Struktur Staf — hitung jumlah per role termasuk sub-role, dari data RBAC existing.

**Kriteria selesai:** KS login dan langsung lihat kondisi hari ini tanpa perlu buka menu lain, semua angka bisa di-drill-down ke daftar nama.

---

## Tahap 4 — Embed Voice Briefing & Konsumsi Poin ke Dashboard KS

**Tugas:**
1. Embed komponen Voice Briefing yang sudah ada (Web Speech API + Web Push) sebagai widget di dashboard KS — **jangan bikin ulang logic-nya**, cukup reuse komponen/service existing.
2. Widget Konsumsi Poin — tampilkan sisa Poin, breakdown pemakaian per fitur (raport AI, voice briefing, dll), proyeksi habis.
3. **Kategori sensitif** — kalau perlu ubah cara hitung/agregasi konsumsi Poin (bukan cuma nge-display data yang sudah ada), **minta approval dulu** sebelum implementasi.

**Kriteria selesai:** Widget Poin di dashboard KS menampilkan angka yang identik dengan data di sistem billing existing (validasi silang, bukan hitung ulang independen).

---

## Tahap 5 — Review Proses Mengajar Guru

**Tugas (urutan mengikuti kompleksitas — mulai dari yang datanya sudah ada):**
1. **Log Engagement Platform** — susun widget dari data existing: ketepatan submit raport, frekuensi akses Perpustakaan Digital, pemakaian fitur AI generation. Tidak perlu tracking baru, cukup agregasi.
2. **Realisasi vs Rencana** — perlu field baru untuk RPP/rencana pembelajaran kalau belum ada. Diskusikan dengan Claude dulu apakah ini disimpan di `gurupro-library` (reuse) atau butuh tabel baru sebelum implementasi (skema baru = butuh approval kalau menyentuh migrasi).
3. **Riwayat Observasi Kelas** — bangun form penilaian observasi (skor + catatan) dan tabel riwayat terhubung ke profil guru. Ini fitur baru murni, tidak ada data existing untuk direuse.
4. **Riwayat Feedback KS ke Guru** — tabel catatan sederhana terhubung ke profil guru, dengan trigger notifikasi opsional via Web Push (reuse infrastruktur).

**Kriteria selesai:** KS bisa klik satu guru → lihat tab "Proses Mengajar" lengkap (RPP, realisasi, riwayat observasi, log engagement) → bisa tambah catatan/jadwalkan observasi dari situ.

---

## Tahap 6 — Dashboard Wakasek

**Tugas:**
1. Widget approval raport di lapis "Review Wakasek".
2. Form input observasi harian yang otomatis muncul sebagai bagian dari riwayat observasi di dashboard KS (Tahap 5) — pastikan satu sumber data, bukan sistem observasi terpisah.

**Kriteria selesai:** Observasi yang diinput Wakasek langsung muncul di riwayat guru yang dilihat KS, tanpa duplikasi data.

---

## Tahap 7 — Dashboard Bendahara

**Tugas:**
1. Widget saldo & riwayat transaksi Poin — reuse data existing dari sistem billing.
2. Proyeksi kebutuhan top up berdasarkan tren pemakaian.
3. Export laporan Poin ke PDF/Excel.

**Kriteria selesai:** Bendahara bisa lihat dan export riwayat Poin tanpa perlu akses ke sistem lain.

---

## Format Laporan Setiap Tahap

Setelah setiap tahap selesai, laporkan ke Claude dengan format:
1. Apa yang dikerjakan
2. File/endpoint yang diubah
3. Apakah ada yang masuk kategori sensitif (dan kenapa)
4. Apakah ditemukan bug/inkonsistensi data lain saat implementasi (seperti pola bug `todaySummary`/presensi sebelumnya)
5. Rekomendasi lanjutan sebelum masuk tahap berikutnya
