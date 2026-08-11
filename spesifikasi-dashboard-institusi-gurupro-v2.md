# Spesifikasi Dashboard Institusi GuruPRO AI (v2 — Disesuaikan Kondisi Real)

## 0. Konteks: Apa yang Sudah Ada, Apa yang Masih Bolong

Sebelum nambah fitur baru, ini pemetaan kondisi real GuruPRO AI sekarang yang harus jadi dasar desain dashboard — bukan mulai dari nol:

| Sudah Ada | Status | Implikasi ke Dashboard |
|---|---|---|
| Dashboard institusi terpisah untuk Kepala Sekolah & Operator | Sudah dibangun, tapi belum "lengkap fitur & flow" | Spek ini **melengkapi**, bukan mengganti dari awal |
| RBAC institusi: Kepala Sekolah, Wakasek, Operator, Bendahara, Guru + sub-role Wali Kelas & Pembina Ekskul | Sudah ada | Dashboard harus punya view khusus untuk 2 sub-role ini, bukan cuma 5 role utama |
| e-Raport 3 lapis | Sudah ada | Perlu widget progress yang nunjukin status di 3 lapis itu, bukan cuma "submitted/belum" |
| Sistem Poin (1 Poin = 2.000 token) | Sudah ada | Dashboard billing tinggal nge-surface data yang sudah ada, bukan bikin sistem baru |
| Voice Briefing (Web Speech API + Web Push) | Sudah ada | Tinggal di-embed sebagai widget di dashboard KS, jangan bikin fitur duplikat |
| Perpustakaan Digital (bucket `gurupro-library`, poin reward, PDF reader) | Sudah ada | Dashboard institusi butuh widget "konten paling diakses" / storage usage |
| Laporan presensi pakai Recharts | Sudah ada | Tinggal disusun ulang jadi widget di dashboard, bukan reinvent chart |
| Banner konteks sekolah persisten | Sudah ada | Semua dashboard institusi harus konsisten pakai banner ini di header |
| **Bug `todaySummary` di `teacher-dashboard/route.ts`** | **Belum selesai** | **Blocker.** Dashboard Guru individual harus fix dulu sebelum dashboard institusi agregat dibangun di atasnya — kalau summary guru salah, agregat institusi ikut salah |
| Root cause bug presensi lama: query ke `teacher_institution_assignments` (kosong) padahal data asli di `payload.institution_members` | Sudah diperbaiki di modul presensi, tapi **berisiko terulang** kalau widget dashboard baru bikin query sendiri-sendiri ke tabel yang salah | Wajib satu service/data layer bersama untuk semua widget presensi lintas dashboard |

**Prinsip utama v2: dashboard institusi bukan proyek terpisah, tapi lapisan agregasi di atas data yang sudah dan sedang dibangun.**

---

## 1. Dashboard Kepala Sekolah (Lengkap)

### 1.1 Fitur & Sumber Data

| Widget | Isi | Sumber Data (existing) | Catatan |
|---|---|---|---|
| Ringkasan Kehadiran Hari Ini | % guru & siswa hadir, izin/sakit/alpa | Modul presensi (sudah fix root cause) | Wajib pakai data layer yang sama dengan modul presensi guru individual |
| Progress e-Raport 3 Lapis | Status tiap lapis (misal: Draft → Review Wakasek → Final KS) per kelas/mapel | Sistem e-Raport existing | Bukan cuma 1 angka "% submitted" — tampilkan posisi di lapis mana |
| Voice Briefing Harian | Ringkasan otomatis + tombol play | Fitur Voice Briefing existing | Embed langsung, jangan generate ulang |
| Konsumsi Poin Institusi | Sisa Poin, proyeksi habis, breakdown pemakaian per fitur (raport AI, voice briefing, dsb) | Sistem Poin existing | Ini penting karena margin dihitung dari Gemini 2.5 Flash-Lite — KS perlu tahu fitur mana yang paling "boros" Poin |
| Alert Panel | Guru telat berulang, kelas presensi rendah, raport mendekati deadline, guru belum ter-assign kelas | Data layer presensi + assignment | Sinkron dengan Flow Operator (lihat bawah) |
| Aktivitas Perpustakaan Digital | Konten paling diakses guru, total storage terpakai di `gurupro-library` | Modul Perpustakaan Digital | Baru, tapi data sudah tersedia dari fitur existing |
| Struktur Staf | Jumlah per role termasuk sub-role Wali Kelas & Pembina Ekskul | RBAC existing | Klik → manajemen staf |

### 1.2 Flow

**Flow A — Cek kondisi harian**
1. Login → landing di dashboard KS, banner konteks sekolah dimuat.
2. Widget kehadiran load dari data layer presensi (sama dengan yang dipakai dashboard guru — no duplikasi query).
3. Klik alert "8 guru belum submit raport, deadline 3 hari lagi" → drawer nama guru + lapis raport terakhir mereka ada di mana.
4. Opsional: kirim reminder via notifikasi in-app (reuse infrastruktur Web Push yang sudah ada untuk Voice Briefing).

**Flow B — Review konsumsi Poin (karena ini langsung ke biaya operasional)**
1. Klik widget Poin → detail breakdown: berapa Poin habis untuk raport AI vs voice briefing vs fitur lain.
2. Kalau ada fitur yang tiba-tiba boros → jadi input buat tim produk (bukan cuma buat KS, tapi juga sinyal ke kalian di VIDEA soal margin).

### 1.3 Fitur Baru: Review Proses Mengajar Guru

Ini beda dengan "Progress e-Raport" (yang isinya hasil akhir/nilai). Ini soal **prosesnya** — apakah guru mengajar sesuai rencana, materinya bagaimana, dan bagaimana engagement-nya di platform.

| Widget | Isi | Sumber Data |
|---|---|---|
| **RPP / Rencana Pembelajaran** | Rencana yang diupload/dibuat guru per pertemuan, status: belum dibuat / draft / disetujui KS | Bisa reuse infrastruktur Perpustakaan Digital (`gurupro-library`) sebagai tempat penyimpanan, atau modul e-Raport kalau formatnya terintegrasi di sana |
| **Realisasi vs Rencana** | % materi yang benar-benar tersampaikan dibanding RPP, per guru/kelas/mapel | Silang antara RPP dan log presensi kelas (kelas yang berlangsung = materi tersampaikan) |
| **Riwayat Observasi Kelas** | Catatan kunjungan/observasi kelas — baik dari Wakasek maupun KS langsung, dengan skor/catatan kualitatif | **Baru** — perlu form penilaian observasi (lihat flow di bawah) |
| **Log Engagement Platform** | Ketepatan waktu submit raport, frekuensi akses Perpustakaan Digital, pemakaian fitur AI generation | Reuse data existing dari sistem Poin & e-Raport — jadi proxy metrik keaktifan guru tanpa bikin tracking baru |
| **Riwayat Feedback KS ke Guru** | Semua catatan/feedback yang pernah diberikan KS, per guru, urut waktu | Baru, tapi ringan — cukup tabel catatan terhubung ke profil guru |

**Relasi dengan Wakasek:** Wakasek sudah punya widget "Jadwal & Supervisi" (lihat bagian 3). Supaya nggak duplikat sistem — Wakasek input hasil observasi harian, dan itu otomatis muncul di dashboard KS sebagai bagian dari riwayat. KS tidak harus observasi semua guru sendiri, tapi bisa lihat rollup-nya dan **drill-down ke guru tertentu** untuk observasi langsung kalau perlu (misal guru yang alert-nya merah).

### 1.4 Flow — Review Proses Mengajar

**Flow A — KS review satu guru secara mendalam**
1. Dari dashboard, KS klik nama guru (bisa dari Struktur Staf atau dari Alert Panel kalau ada flag masalah).
2. Masuk ke **profil guru**, tab "Proses Mengajar" menampilkan: RPP terbaru, % realisasi materi, riwayat observasi (termasuk yang diinput Wakasek), log engagement platform.
3. KS baca catatan observasi terakhir dari Wakasek → kalau perlu, klik "Tambah Catatan" untuk kasih feedback sendiri.
4. Feedback tersimpan di riwayat, dan (opsional) trigger notifikasi ke guru via Web Push — reuse infrastruktur yang sudah dipakai Voice Briefing.

**Flow B — KS jadwalkan observasi kelas langsung**
1. Dari tab "Proses Mengajar" guru tertentu, klik "Jadwalkan Observasi".
2. Pilih tanggal/jam dari jadwal mengajar guru tersebut (tarik dari data jadwal existing).
3. Sistem kirim notifikasi ke guru bersangkutan.
4. Setelah observasi, KS isi form penilaian singkat (skor + catatan kualitatif) langsung dari dashboard → masuk ke riwayat observasi guru itu.

**Flow C — KS lihat ringkasan lintas guru (bukan drill-down satu-satu)**
1. Widget "Realisasi vs Rencana" di dashboard utama menampilkan heatmap semua guru — hijau (sesuai target), kuning (agak tertinggal), merah (jauh tertinggal).
2. KS klik guru yang merah → langsung masuk ke Flow A untuk investigasi lebih dalam.

---

## 2. Dashboard Operator (Lengkap — Prioritas Tinggi)

Operator adalah **fondasi kualitas data** untuk semua dashboard lain. Kalau assignment guru-kelas berantakan, KS dan Wakasek lihat data yang salah.

### 2.1 Fitur & Sumber Data

| Widget | Isi | Catatan |
|---|---|---|
| Antrian Approval | Registrasi guru baru, perubahan data | Reuse RBAC existing untuk auto-assign role setelah approve |
| **Assignment Guru-Kelas-Mapel** | Guru yang belum ter-assign, konflik jadwal | **Widget paling kritis** — ini yang jadi akar bug presensi kemarin. Harus nulis langsung ke `payload.institution_members` sebagai source of truth |
| Kelengkapan Data | Guru/siswa dengan data belum lengkap | — |
| Log Presensi Real-time | Siapa yang belum absen | Sama data layer dengan dashboard KS |
| Import/Export Massal | Upload Excel siswa/guru | Validasi baris error sebelum commit |
| Sub-role Assignment | Assign Wali Kelas & Pembina Ekskul ke guru tertentu | Baru — belum ada widget khusus untuk 2 sub-role ini di dashboard manapun |

### 2.2 Flow

**Flow A — Perbaiki assignment (paling sering dipakai, paling kritis)**
1. Dashboard tampilkan alert "12 guru belum ter-assign kelas manapun".
2. Klik → tabel guru tanpa assignment.
3. Assign kelas + mapel + (opsional) sub-role Wali Kelas/Pembina Ekskul dalam satu form.
4. Simpan → tulis ke `payload.institution_members` → semua dashboard lain (KS, presensi, raport) otomatis ter-refresh karena pakai data layer yang sama.

**Flow B — Approval registrasi guru baru**
1. Notifikasi masuk → klik antrian.
2. Verifikasi data → Approve (trigger role default) atau Minta Revisi (kirim catatan).

---

## 3. Dashboard Wakasek

### 3.1 Fitur
- Progress e-Raport lapis "Review Wakasek" — daftar raport yang perlu direview sebelum ke KS
- Progress kurikulum per mapel
- Rekap nilai & distribusi per kelas

### 3.2 Flow
1. Login → lihat antrian raport yang menunggu review di lapis Wakasek.
2. Klik satu raport → review → approve ke lapis berikutnya atau kirim balik ke guru dengan catatan.

---

## 4. Dashboard Bendahara

### 4.1 Fitur
- Saldo & riwayat transaksi Poin institusi (data sudah ada dari sistem Poin existing)
- Proyeksi kebutuhan top up berdasarkan tren pemakaian
- Export laporan Poin untuk yayasan

*(Catatan: karena GuruPRO belum tentu handle SPP/keuangan santri — itu ranah institusi sendiri — dashboard Bendahara di sini fokus murni ke Poin/billing platform, bukan keuangan sekolah secara umum.)*

---

## 5. Dashboard Guru + Sub-role (Wali Kelas, Pembina Ekskul)

### 5.1 Prasyarat
**Bug `todaySummary` harus selesai dulu** sebelum widget agregat institusi dibangun di atasnya — kalau summary guru individual salah, semua rollup ke dashboard KS ikut salah.

### 5.2 Fitur Tambahan untuk Sub-role
- **Wali Kelas**: rekap kehadiran & progress raport khusus kelas yang diampu (bukan cuma mapel sendiri)
- **Pembina Ekskul**: log aktivitas & kehadiran ekskul, terpisah dari presensi kelas reguler

---

## 6. Data Layer & Prioritas Teknis

1. **Fix `todaySummary` dulu** — ini blocker literal untuk semua widget agregat.
2. **Satu service data presensi** dipakai bareng oleh dashboard Guru, Operator, dan KS — jangan sampai ada widget baru yang query langsung ke `teacher_institution_assignments` lagi.
3. **Widget assignment guru-kelas di Operator dibangun duluan** sebelum widget alert di KS — karena KS alert-nya bergantung ke data assignment yang bersih.
4. Stack tetap: Next.js 16.2.9 (webpack), Payload CMS 3.x, Drizzle ORM, PostgreSQL — dashboard sebagai layer agregasi query, bukan tabel baru yang duplikat data existing.

## 7. Urutan Implementasi yang Disarankan

1. Fix bug `todaySummary`
2. Widget Assignment Guru-Kelas-Mapel (Operator) — termasuk sub-role Wali Kelas/Pembina Ekskul
3. Dashboard Kepala Sekolah: Kehadiran + Alert Panel + Progress e-Raport 3 Lapis
4. Embed Voice Briefing & Poin consumption ke dashboard KS (reuse existing)
5. **Review Proses Mengajar Guru** — mulai dari Log Engagement Platform & Realisasi vs Rencana (data sudah ada, tinggal disusun), baru kemudian bangun form Observasi Kelas (fitur baru murni)
6. Dashboard Wakasek (approval lapis raport + input observasi harian yang jadi sumber rollup ke KS)
7. Dashboard Bendahara (Poin billing view)
