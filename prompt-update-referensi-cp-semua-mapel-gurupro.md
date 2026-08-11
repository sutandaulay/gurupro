# PROMPT: Update Referensi Capaian Pembelajaran (CP) — SELURUH Mapel & Jenjang — GuruPRO AI

> **Cara pakai:** File ini untuk dieksekusi oleh Claude Code / Qoder CN. File pendamping `cp-index-kepka-046-2025.csv` (index 265 baris: lampiran, kode romawi, nama mapel, halaman perkiraan) WAJIB dibaca dulu sebagai peta navigasi sebelum memproses dokumen sumber, supaya tidak scan ulang 1.691 halaman dari nol. Setelah eksekusi, laporkan hasil ke Claude (chat strategis) untuk direview sebelum merge ke production.

---

## 1. Latar Belakang & Sumber Regulasi

Ada 3 dokumen sumber yang harus dipakai bersama-sama (bukan saling menggantikan, tapi saling melengkapi/override sebagian):

### A. Dokumen INDUK — mencakup SEMUA mapel, SEMUA jenjang
- **Kepka BSKAP No. 046/H/KR/2025** (ditetapkan 16 Juli 2025), tentang Capaian Pembelajaran pada PAUD, Jenjang Dikdas, dan Jenjang Dikmen.
- **1.691 halaman**, terdiri dari 5 Lampiran:
  - **Lampiran I** — PAUD (Fase Fondasi): 3 elemen (Nilai Agama & Budi Pekerti, Jati Diri, Dasar-Dasar Literasi/Matematika/Sains/Teknologi/Rekayasa/Seni)
  - **Lampiran II** — SD/MI, SMP/MTs, SMA/MA (jalur akademik reguler): ~34 mapel — Agama (6 agama), Pendidikan Pancasila, Bahasa Indonesia (+ Tingkat Lanjut), Matematika (+ Tingkat Lanjut), Bahasa Inggris (+ Tingkat Lanjut), IPAS (SD), IPA, Fisika, Kimia, Biologi, Informatika, IPS, Sejarah (+ Tingkat Lanjut), Geografi, Ekonomi, Sosiologi, Antropologi, Seni (Musik/Rupa/Tari/Teater), Prakarya (4 jenis) + Prakarya Kewirausahaan (4 jenis), PJOK, Bahasa Arab, Jepang, Jerman, Korea, Mandarin, Prancis, Koding & Kecerdasan Artifisial.
  - **Lampiran III** — SMK/MAK: mapel umum (Sejarah SMK/MAK, Projek IPA, Koding & AI) + **~128 mapel kejuruan/konsentrasi** (Teknik Mesin, Otomotif, Perhotelan, Kuliner, Perbankan Syariah, Animasi, Kelistrikan, Perikanan, Pertanian, dll — lihat index CSV untuk daftar lengkap) + Kreativitas/Inovasi/Kewirausahaan + Praktik Kerja Lapangan.
  - **Lampiran IV** — Program Paket A/B/C: muatan pemberdayaan + muatan keterampilan (robotika, pertanian, barista, perikanan, tata boga, tata busana, komputer, kreator konten, koding, dll).
  - **Lampiran V** — TKLB/SDLB/SMPLB/SMALB (Pendidikan Khusus): Agama (6), Pendidikan Pancasila, Bahasa Indonesia, Matematika, Bahasa Inggris, IPA, IPS, Seni (4 jenis), PJOK, Keterampilan (banyak jenis sesuai jenis kebutuhan khusus), Program Kebutuhan Khusus per jenis disabilitas (tunanetra, tunarungu, tunagrahita, tunadaksa, dll), Fase Fondasi Program Kebutuhan Khusus.
- File sumber: `KepKaBSKAP-046_2025-ttg-CP.pdf`
- File peta navigasi: `cp-index-kepka-046-2025.csv` — **gunakan ini untuk menentukan rentang halaman tiap mapel**, jangan proses seluruh 1.691 halaman sekaligus dalam satu context/operasi (akan gagal/timeout). Proses per-mapel atau per-batch mapel sesuai rentang halaman di index.

### B. PATCH/OVERRIDE — khusus Agama & Budi Pekerti, jalur Kemendikdasmen
- **Kepka BKPDM No. 020 Tahun 2026** (ditetapkan 11 Juni 2026), tentang **Perubahan atas** Kepka BSKAP No. 046/H/KR/2025.
- Mengubah **hanya Lampiran II bagian I.1–I.6** (CP Agama & Budi Pekerti reguler, 6 agama) dan **Lampiran V bagian I.1–I.6** (CP Pendidikan Khusus Agama & Budi Pekerti, 6 agama).
- **Aturan override:** untuk kedua bagian ini, isi dari dokumen 046/2025 asli **TIDAK DIPAKAI** — gunakan isi dari 020/2026 ini. Semua mapel lain di Lampiran II dan V (non-agama) tetap pakai 046/2025 asli karena tidak diubah.
- File sumber: `Kepka_BKPDM_No_020_Tahun_2026_tentang_Perubahan_a_260620_091552.pdf`

### C. TAMBAHAN — khusus Madrasah (Kemenag), untuk mapel PAI & Bahasa Arab
- **Keputusan Dirjen Pendidikan Islam No. 9941 Tahun 2025** (ditetapkan 28 November 2025), tentang CP Mapel **PAI dan Bahasa Arab pada Madrasah** (RA, MI, MTs, MA/MAK termasuk jalur MAPK/Program Keagamaan).
- Berlaku **khusus untuk institusi berjenis madrasah/pesantren** (bukan sekolah umum), dan **strukturnya berbeda total** dari dokumen A/B: PAI di madrasah dipecah jadi mapel-mapel terpisah — Al-Qur'an Hadis, Akidah Akhlak, Fikih, Sejarah Kebudayaan Islam (SKI), Bahasa Arab — bukan 1 mapel gabungan.
- Jalur MAPK (kemungkinan dipakai Gontor) dipecah lebih detail lagi: Al-Qur'an Hadis (Tafsir), Al-Qur'an Hadis (Hadis), Ilmu Tafsir, Ilmu Hadis, Ilmu Kalam, Akhlak Tasawuf, Fikih MAPK, Bahasa Arab Program Keagamaan.
- File sumber: `Kep_Dirjen_Pendis_9941_Thn_2025_ttg_CP_Mapel_PAI_B_Arab_Madrasah.pdf`

### D. TAMBAHAN — struktur kurikulum mapel UMUM di Madrasah (Kemenag)
- **KMA (Keputusan Menteri Agama) No. 1503 Tahun 2025**, Perubahan atas KMA No. 450 Tahun 2024, tentang Pedoman Implementasi Kurikulum RA/MI/MTs/MA/MAK.
- **Ini BUKAN dokumen CP baru** — dokumen ini mengatur **struktur kurikulum**: mapel apa saja yang wajib/pilihan per jenjang madrasah, alokasi Jam Pelajaran (JP) per tahun, dan timeline transisi implementasi. Isi capaian pembelajaran (elemen & CP per fase) untuk mapel umum ini **tetap mengikuti dokumen A** (Kepka BSKAP 046/2025, Lampiran II) — jadi tidak ada CP terpisah untuk madrasah pada mapel umum, hanya status wajib/pilihan dan JP-nya yang beda.
- **Resolusi final untuk madrasah** (menggantikan open item versi sebelumnya):
  - Mapel PAI (Al-Qur'an Hadis, Akidah Akhlak, Fikih, SKI) + Bahasa Arab → CP dari **dokumen C** (Kep Dirjen Pendis 9941/2025).
  - Mapel umum (Pendidikan Pancasila, Bahasa Indonesia, Matematika, IPA/IPS/IPAS, Bahasa Inggris, PJOK, Informatika, Seni Budaya, Sejarah, Koding & AI) → CP dari **dokumen A** (Kepka BSKAP 046/2025, Lampiran II), tapi status wajib/pilihan + JP + jenjang mulai berlaku ikut **dokumen D** (KMA 1503/2025).
- Poin penting dari matriks KMA 1503/2025 yang wajib diimplementasikan sebagai metadata (bukan CP, tapi aturan penawaran mapel):
  - **RA**: PAI & Bahasa Arab jadi "elemen terintegrasi" (bukan mapel berdiri sendiri), begitu juga Pendidikan Pancasila (elemen jati diri), Bahasa Indonesia (elemen literasi), Matematika (elemen literasi), IPA/IPS (elemen sains), PJOK (elemen fisik), Seni (elemen seni).
  - **SKI**: di MI baru wajib mulai kelas III.
  - **IPA/IPS**: di MI gabung jadi IPAS mulai kelas III; di MTs sudah terpisah IPA/IPS; di MA kelas X belum pecah, baru pecah jadi Fisika/Kimia/Biologi & Sosiologi/Ekonomi/Sejarah/Geografi mulai kelas XI.
  - **Bahasa Inggris di MI**: **pilihan** sampai TA 2026/2027, jadi **wajib mulai TA 2027/2028** — butuh logic yang sadar tahun ajaran (bukan status statis).
  - **Informatika**: mapel baru, baru muncul mulai jenjang MTs (tidak ada di MI/RA).
  - **Seni dan Budaya**: gabung dengan Prakarya mulai MTs/MA (jadi "Seni, Budaya, dan Prakarya").
  - **Sejarah**: jadi mapel umum tambahan berdiri sendiri di MA khusus kelas XI-XII (Fase F); di kelas X masih menyatu dalam rumpun IPS.
  - **Koding dan Kecerdasan Artifisial**: pilihan, diselenggarakan bertahap sesuai kesiapan madrasah mulai TA 2025/2026 (pilihan mulai kelas V di MI).
  - **MA Program Keagamaan (MAPK)**: Al-Qur'an Hadis pecah jadi Tafsir & Hadis, Akidah Akhlak pecah jadi Ilmu Kalam & Akhlak Tasawuf (kelas XI-XII) — konsisten dengan detail di dokumen C.
- **Alokasi JP per mapel per jenjang** (I, III-IV, VI MI; VII, IX MTs; X, XI-XII MA) tersedia lengkap di file sumber — simpan sebagai data referensi terpisah (`jp_allocation`), berguna kalau GuruPRO punya/akan punya fitur penjadwalan atau validasi beban mengajar guru.
- **Ketentuan peralihan** (penting untuk logic bertahap, jangan di-hardcode sebagai "berlaku sekarang" tanpa cek tahun ajaran):
  - Madrasah reguler: boleh masih Kurikulum 2013 s.d. TA 2025/2026, wajib Kurikulum Merdeka paling lambat TA 2026/2027.
  - Madrasah daerah 3T: boleh Kurikulum 2013 s.d. TA 2026/2027, wajib Kurikulum Merdeka paling lambat TA 2027/2028.
  - MI/MTs: penerapan bertahap (bisa mulai kelas I/IV/VII atau serentak).
  - MA/MAK: penerapan bertahap mulai kelas X.
- File sumber: `Mapel_Umum_Madrasah_KMA1503-2025.xlsx` (3 sheet: `Matriks Mapel Umum`, `Alokasi JP per Jenjang`, `Ketentuan Peralihan`)

---

## 2. Prinsip Kunci

1. **GuruPRO harus tahu jalur institusi** (Kemendikdasmen/sekolah umum vs Kemenag/madrasah) dari data institusi yang sudah ada — data CP yang ditampilkan/dipakai AI harus otomatis mengikuti jalur yang benar, guru tidak perlu pilih manual.
2. **Semua data CP disimpan sebagai source-of-truth terstruktur** (DB/JSON), bukan dihafal atau diringkas oleh AI dari memori model saat generate konten. Skema minimal per record:
   ```json
   {
     "sumber_regulasi": "Kepka BSKAP 046/H/KR/2025" | "Kepka BKPDM 020/2026" | "Kep Dirjen Pendis 9941/2025" | "KMA 1503/2025",
     "lampiran": "I" | "II" | "III" | "IV" | "V" | null,
     "jalur": "kemendikdasmen" | "kemenag",
     "jenjang": "PAUD" | "SD/MI" | "SMP/MTs" | "SMA/MA" | "SMK/MAK" | "Paket A/B/C" | "TKLB/SDLB/SMPLB/SMALB" | "RA" | "MI" | "MTs" | "MA" | "MAK" | "MAPK",
     "tipe_pendidikan": "reguler" | "khusus",
     "mapel": "string",
     "fase": "Fondasi" | "A" | "B" | "C" | "D" | "E" | "F" | null,
     "kelas_umum": ["I","II"] | null,
     "usia_mental": "≤7 tahun" | "±8 tahun" | ... | null,
     "elemen": [{ "nama_elemen": "string", "deskripsi": "string", "capaian_pembelajaran": "string" }],
     "status_madrasah": {
       "wajib_atau_pilihan": "wajib" | "pilihan" | "elemen_terintegrasi" | null,
       "mulai_berlaku_wajib_ta": "string|null (mis. 2027/2028, untuk kasus spt Bahasa Inggris di MI)",
       "catatan": "string|null (mis. 'gabung Prakarya', 'gabung IPS sampai kelas X')"
     }
   }
   ```
   Field `status_madrasah` **hanya diisi untuk record dengan `jalur: "kemenag"`** — sumber datanya dari dokumen D (KMA 1503/2025), bukan dari isi CP itu sendiri.

   Simpan juga data JP (jam pelajaran) sebagai koleksi terpisah `jp_allocation` (jenjang, kelas, mapel, total_jp_per_tahun) dari dokumen D — dipakai sebagai referensi, bukan bagian dari CP.
3. **Versioning wajib** — simpan nomor & tanggal regulasi per record, jangan hapus data lama, soft-deprecate saja (untuk transisi & untuk keperluan audit/due diligence VideaClass yang sedang berjalan).
4. **Untuk konten Agama & Budi Pekerti**: ikuti aturan override di 1.B — pastikan tidak ada campur antara isi 046/2025 asli dan 020/2026 untuk bagian yang sama.

---

## 3. Scope Pekerjaan (Eksekusi Bertahap)

Karena scope ini sangat besar (~300+ mapel/track lintas 5 lampiran), kerjakan **bertahap per fase**, tapi tujuan akhirnya tetap **cover semuanya** — jangan skip permanen, cukup diurutkan prioritas eksekusi:

### Fase 1 — Ekstraksi & Source-of-Truth
1. Baca `cp-index-kepka-046-2025.csv` untuk peta halaman semua mapel.
2. Ekstrak isi lengkap tiap mapel dari `KepKaBSKAP-046_2025-ttg-CP.pdf` per rentang halaman di index, jadikan data terstruktur sesuai skema di 2.2. Proses per-batch (mis. per Lampiran, atau per 10–20 mapel) supaya tidak overload context.
3. Untuk bagian Agama (Lampiran II I.1–I.6, Lampiran V I.1–I.6): **override** dengan isi dari `Kepka_BKPDM_No_020_Tahun_2026...pdf` (bukan dari 046/2025).
4. Ekstrak isi lengkap `Kep_Dirjen_Pendis_9941_Thn_2025...pdf` (PAI & Bahasa Arab Madrasah) sebagai kumpulan record terpisah dengan `jalur: "kemenag"`.
5. Ekstrak `Mapel_Umum_Madrasah_KMA1503-2025.xlsx` (3 sheet) untuk mengisi field `status_madrasah` pada record mapel umum yang jalurnya "kemenag" (hasil duplikasi dari data dokumen A, bukan CP baru — lihat 1.D), plus simpan koleksi `jp_allocation` terpisah dari sheet `Alokasi JP per Jenjang`, dan simpan `Ketentuan Peralihan` sebagai data timeline (dipakai untuk logic bertahap, bukan status statis).
6. Simpan semua ke source-of-truth (DB/JSON), versioned.

### Fase 2 — Prioritas Mapel Sesuai Mitra Aktif GuruPRO
Prioritaskan urutan berikut karena paling relevan ke mitra GuruPRO saat ini (sekolah umum, madrasah/pesantren):
1. Agama & Budi Pekerti (sudah tercover jalur A/B/C di atas)
2. Mapel umum SD/MI, SMP/MTs, SMA/MA (Lampiran II — Bahasa Indonesia, Matematika, Bahasa Inggris, IPA/IPS, dst)
3. Pendidikan Khusus (Lampiran V) — untuk institusi yang punya program inklusi
4. PAUD (Lampiran I) — kalau ada mitra jenjang PAUD/RA
5. SMK/MAK (Lampiran III) — kalau ada mitra SMK; kalau belum ada, tetap ekstrak datanya (supaya tidak kerja dua kali nanti) tapi tidak perlu buru-buru diintegrasikan ke fitur
6. Program Paket A/B/C (Lampiran IV) — kalau relevan

### Fase 3 — Update Fitur yang Pakai Referensi CP

Audit dan update (sesuaikan nama file/modul aktual di codebase, cross-check dulu ke struktur real GuruPRO):

- [ ] Picker/dropdown kurikulum & elemen CP saat guru menyusun RPP/Modul Ajar — sekarang harus cover semua mapel yang relevan ke jenjang institusi, bukan cuma agama
- [ ] Modul e-Raport (tiga lapis) — referensi elemen CP untuk semua mapel yang dinilai
- [ ] Bank soal — tagging soal berdasarkan elemen/fase CP, lintas mapel
- [ ] Dashboard Kepala Sekolah/Operator — laporan progres capaian per elemen CP
- [ ] Modul Perpustakaan Digital — kategorisasi bahan ajar berdasarkan elemen CP

Tambahkan field pembeda jalur (`jalur: kemendikdasmen | kemenag`) yang di-derive otomatis dari tipe institusi.

### Fase 4 — Update `docs/ai-generation-standard.md`

- Section baru "Referensi Capaian Pembelajaran (CP)" menjelaskan:
  - Struktur 3 dokumen sumber (1.A/B/C) dan kapan masing-masing dipakai.
  - Instruksi eksplisit ke AI: **selalu retrieve elemen & capaian pembelajaran dari source-of-truth, jangan generate dari pengetahuan umum model** — berlaku untuk SEMUA mapel, bukan cuma agama (risiko halusinasi ada di semua mapel, bukan cuma yang sensitif).
  - Format sitasi minimal saat AI menyisipkan referensi CP (nomor regulasi + lampiran + fase + elemen).
  - Catatan MAPK untuk institusi seperti Gontor.
  - Catatan open item soal mapel umum madrasah (1.C, poin terakhir).

### Fase 5 — Testing / Validasi

- Generate RPP/modul ajar untuk sample mapel dari tiap lampiran (minimal: 1 mapel agama, 1 mapel umum SD/MI, 1 mapel umum SMA, 1 mapel kejuruan SMK jika berlaku, 1 mapel PAI madrasah) — verifikasi elemen & capaian pembelajaran **cocok persis** dengan dokumen asli.
- Verifikasi institusi existing (Al Jannah, Darun Najjah, Gontor) ter-mapping ke jalur yang benar.

---

## 4. Batasan & Approval

Pekerjaan ini **tidak masuk 3 kategori sensitif** (migrasi DB berisiko, billing Poin, RBAC lintas tenant) sehingga bisa dikerjakan & diperbaiki inline seperti biasa. Tetap:

1. Laporkan hasil ekstraksi Fase 1 untuk direview sebelum dipakai live — untuk cross-check akurasi konten, bukan approval teknis.
2. Jangan hapus data CP lama langsung — versioning/soft-deprecate saja.
3. Kalau menemukan gap baru (di luar yang sudah teridentifikasi di 1.A-D) — jangan diisi dengan asumsi/tebakan, tandai sebagai open item dan laporkan.
4. Khusus logic tahun-ajaran (Bahasa Inggris MI, Kurikulum 2013 vs Merdeka, dll dari dokumen D) — pastikan implementasinya sadar tanggal/TA berjalan, jangan di-hardcode sebagai kondisi permanen karena akan berubah otomatis di TA berikutnya.

---

## 5. Output yang Diharapkan

1. Source-of-truth CP terstruktur untuk seluruh 5 lampiran + patch agama + PAI madrasah + status kurikulum madrasah, versioned.
2. Koleksi `jp_allocation` dan data `Ketentuan Peralihan` tersimpan sebagai referensi terpisah.
3. Semua fitur di Fase 3 sudah pakai data baru, dengan pembeda jalur otomatis dan logic sadar-tahun-ajaran untuk mapel yang statusnya transisi (mis. Bahasa Inggris MI).
4. `docs/ai-generation-standard.md` ter-update.
5. Daftar open item baru (kalau ada gap di luar dokumen A-D) dilaporkan eksplisit.
6. Ringkasan hasil test (Fase 5) dilaporkan ke Claude untuk review strategis sebelum merge.
