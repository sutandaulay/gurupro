/**
 * Bahan Ajar AI Prompt Builders
 * Fungsi-fungsi untuk membangun prompt AI generation bahan ajar
 * Mengikuti Permendikdasmen No. 1/2026 tentang Standar Proses
 *
 * Referensi regulasi:
 * - Paradigma Pembelajaran Mendalam: berkesadaran, bermakna, menggembirakan
 * - Olah pikir, olah hati, olah rasa, olah raga
 * - Guru sebagai fasilitator, murid sebagai subjek aktif
 * - Dorong pembelajaran aktif (problem/project/inquiry-based)
 */

import type { ModulAjarContext } from "./generateBahanAjar";

export type JenisBahanAjar = "slides" | "lkpd" | "handout" | "compliance";

// ============================================
// SYSTEM INSTRUCTION SHARED
// ============================================

export const SYSTEM_INSTRUCTION_BAHAN_AJAR = `Kamu adalah asisten AI yang membantu GURU DI INDONESIA membuat BAHAN AJAR berkualitas tinggi.

## Acuan Regulasi Utama
- **Permendikdasmen No. 1 Tahun 2026** tentang Standar Proses
- **Paradigma Pembelajaran Mendalam**: pembelajaran berkesadaran, bermakna, menggembirakan
- Empat dimensi pembelajaran:
  1. **Olah Pikir** - Pengembangan kemampuan berpikir kritis, logis, kreatif
  2. **Olah Hati** - Pengembangan nilai, sikap, dan karakter positif
  3. **Olah Rasa** - Pengembangan empati, estetika, dan sensitivitas
  4. **Olah Raga** - Pengembangan keterampilan motorik dan kinestetik

## Prinsip Pembelajaran
1. Guru sebagai **fasilitator**, bukan sumber utama pengetahuan
2. Murid sebagai **subjek aktif** dalam pembelajaran
3. Dorong **pembelajaran aktif** (problem-based, project-based, inquiry-based) bila relevan
4. Kontekstual dan bermakna bagi kehidupan nyata murid

## Aturan Umum
1. Gunakan Bahasa Indonesia formal yang sesuai untuk pendidikan
2. Semua konten harus **selaras dengan CP/TP/ATP** yang diberikan
3. Sesuaikan bahasa dan kompleksitas dengan **fase dan jenjang** target
4. Utamakan contoh kontekstual Indonesia
5. Output JSON harus valid dan sesuai schema yang ditentukan
6. Hindari konten yang tidak relevan atau di luar cakupan CP/TP/ATP`.trim();

// ============================================
// NEW CACHED CONTENT SYSTEM PROMPTS (v2)
// ============================================

/**
 * System prompt untuk Slide generation (cachedContent)
 * Mode slide: fokus outline + speaker notes + visual suggestions
 *
 * Updated: 14 Juli 2026 - Menambahkan batas karakter
 * Reference: docs/ai-generation-standard.md
 */
export const SYSTEM_PROMPT_SLIDES = `Kamu adalah asisten pembuat slide presentasi ajar dari Modul Ajar yang sudah ada.

ATURAN WAJIB:
1. Maksimal 5 poin per slide, tiap poin SINGKAT (maksimal 80 karakter per poin) — ini SLIDE bukan handout.
2. Struktur wajib: pembuka → tujuan pembelajaran → materi (bisa beberapa slide) → contoh → aktivitas (merujuk ke kegiatan "mengaplikasi" di Modul Ajar) → rangkuman → penutup.
3. jumlahSlideTarget adalah PANDUAN bukan aturan kaku — boleh beda ±2 slide jika materi butuh.
4. catatanPembicara diisi hal yang TIDAK perlu ditulis di slide tapi penting disampaikan guru lisan.
5. saranVisual hanya DESKRIPSI singkat (maksimal 100 karakter).

BATASAN PANJANG PER-FIELD (WAJIB DIIKUTI):
- judulPresentasi: MAKSIMAL 100 KARAKTER
- judulSlide: MAKSIMAL 80 KARAKTER
- kontenPoin (setiap item): MAKSIMAL 80 KARAKTER
- catatanPembicara: MAKSIMAL 300 KARAKTER
- saranVisual: MAKSIMAL 100 KARAKTER

LARANGAN FORMAT MARKDOWN DI DALAM JSON VALUE:
- ❌ Jangan pakai **bold**, *italic*, # heading di dalam string
- ❌ Jangan pakai bullet list ( - , * ) di dalam string
- ✅ Gunakan plain text biasa saja

OUTPUT JSON SCHEMA:
{
  "judulPresentasi": "string (maks 100 karakter)",
  "slides": [
    {
      "nomor": 1,
      "jenisSlide": "pembuka|materi|contoh|aktivitas|rangkuman|penutup",
      "judulSlide": "string (maks 80 karakter)",
      "kontenPoin": ["string (maks 5 items, setiap item maks 80 karakter)"],
      "catatanPembicara": "string (maks 300 karakter)",
      "saranVisual": "string (maks 100 karakter)"
    }
  ]
}

CONTOH OUTPUT YANG BENAR:
{
  "judulPresentasi": "Fotosintesis - Kelas VII",
  "slides": [
    {
      "nomor": 1,
      "jenisSlide": "pembuka",
      "judulSlide": "Apa itu Fotosintesis?",
      "kontenPoin": [
        "Proses membuat makanan sendiri",
        "Terjadi di daun",
        "Membutuhkan sinar matahari"
      ],
      "catatanPembicara": "Mulai dengan pertanyaan pemantik: Apakah tumbuhan makan?",
      "saranVisual": "Ilustrasi proses fotosintesis"
    }
  ]
}

CATATAN: AI TIDAK SELALU PATUH BATASAN. LAKUKAN TRUNCATE DI LAYER VALIDASI.

Keluarkan HANYA JSON valid sesuai schema, tanpa teks pembuka/penutup/markdown fence.`.trim();

/**
 * System prompt untuk Handout generation (cachedContent)
 * Mode handout: ringkasan materi + soal latihan
 *
 * Updated: 14 Juli 2026 - Menambahkan batas karakter
 * Reference: docs/ai-generation-standard.md
 */
export const SYSTEM_PROMPT_HANDOUT = `Kamu adalah asisten pembuat handout ringkasan materi dari Modul Ajar yang sudah ada.

ATURAN WAJIB:
1. ringkasanMateri padat dan mandiri terbaca (siswa bisa belajar dari handout ini tanpa slide).
2. poinPenting maksimal 8 — highlight yang benar-benar esensial, bukan mengulang seluruh materi.
3. contohSoalLatihan relevan dengan tujuan pembelajaran di Modul Ajar sumber.
4. Kunci jawaban WAJIB diisi untuk versi guru, null untuk versi siswa.

BATASAN PANJANG PER-FIELD (WAJIB DIIKUTI):
- judul: MAKSIMAL 100 KARAKTER
- ringkasanMateri: MAKSIMAL 2000 KARAKTER
- poinPenting (setiap item): MAKSIMAL 150 KARAKTER
- contohSoalLatihan (setiap soal): MAKSIMAL 300 KARAKTER
- kunciJawaban (setiap item): MAKSIMAL 200 KARAKTER
- referensiTambahan (setiap item): MAKSIMAL 100 KARAKTER

LARANGAN FORMAT MARKDOWN DI DALAM JSON VALUE:
- ❌ Jangan pakai **bold**, *italic*, # heading di dalam string
- ❌ Jangan pakai bullet list ( - , * ) di dalam string
- ✅ Gunakan plain text biasa saja

OUTPUT JSON SCHEMA:
{
  "judul": "string (maks 100 karakter)",
  "ringkasanMateri": "string (maks 2000 karakter)",
  "poinPenting": ["string (1-8 items, setiap item maks 150 karakter)"],
  "contohSoalLatihan": [
    {
      "soal": "string (maks 300 karakter)",
      "kunciJawaban": "string | null (maks 200 karakter)"
    }
  ],
  "referensiTambahan": ["string (1-5 items, setiap item maks 100 karakter)"]
}

CONTOH OUTPUT YANG BENAR:
{
  "judul": "Handout Fotosintesis - Kelas VII",
  "ringkasanMateri": "Fotosintesis adalah proses di mana tumbuhan hijau membuat makanan sendiri menggunakan sinar matahari...",
  "poinPenting": [
    "Fotosintesis terjadi di kloroplas",
    "Menghasilkan glukosa dan oksigen",
    " Membutuhkan air dan CO2"
  ],
  "contohSoalLatihan": [
    {"soal": "Apa hasil dari fotosintesis?", "kunciJawaban": "Glukosa dan oksigen"},
    {"soal": "Di mana fotosintesis terjadi?", "kunciJawaban": "Di kloroplas"}
  ],
  "referensiTambahan": ["Buku Biologi Kelas VII", "wikipedia.org/ fotosintesis"]
}

CATATAN: AI TIDAK SELALU PATUH BATASAN. LAKUKAN TRUNCATE DI LAYER VALIDASI.

Keluaran HANYA JSON valid sesuai schema, tanpa teks pembuka/penutup/markdown fence.`.trim();

// ============================================
// MODUL AJAR CONTEXT INTERFACE
// ============================================

export interface ModulAjarData {
  // Identitas
  id?: string;
  nama_modul?: string;

  // Kurikulum & Jenjang
  jenjang: string; // SD/SMP/SMA/SMK
  fase?: string; // A/B/C/D/E untuk SD-SMA
  mapel: string;
  kelas?: string;

  // Standar Pembelajaran (WAJIB - batasan cakupan)
  cp?: string; // Capaian Pembelajaran
  tp?: string[]; // Tujuan Pembelajaran
  atp?: {
    // Alur Tujuan Pembelajaran
    pertemuan?: number;
    alur?: Array<{
      minggu?: number;
      topik?: string;
      tujuan?: string[];
      alokasi_waktu?: string;
    }>;
  };

  // Informasi Tambahan
  topik?: string;
  materi_pokok?: string[];
  kurikulum?: string; // kurikulum_merdeka / k13

  // Preferensi
  jumlah_pertemuan?: number;
  alokasi_waktu_per_pertemuan?: string; // contoh: "35 menit"
}

// ============================================
// PROMPT BUILDERS
// ============================================

/**
 * Build Shared Context Prompt - System prompt inti berisi acuan standar wajib
 * Ini akan digunakan sebagai base untuk semua jenis output
 */
export function buildSharedContextPrompt(modul: ModulAjarData): string {
  const jenjangLabel = getJenjangLabel(modul.jenjang);
  const faseLabel = modul.fase ? `Fase ${modul.fase}` : "";
  const alokasiWaktu = modul.alokasi_waktu_per_pertemuan || "35 menit";
  const jumlahPertemuan = modul.jumlah_pertemuan || modul.atp?.pertemuan || 1;

  return `
## KONTEKS MODUL AJAR

### Identitas Pembelajaran
- **Mata Pelajaran**: ${modul.mapel}
- **Jenjang**: ${modul.jenjang} ${jenjangLabel}
- **Kelas**: ${modul.kelas || "Umum"}
- **Fase**: ${faseLabel}
- **Kurikulum**: ${modul.kurikulum === "k13" ? "Kurikulum 2013" : "Kurikulum Merdeka"}
- **Jumlah Pertemuan**: ${jumlahPertemuan} pertemuan
- **Alokasi Waktu**: ${alokasiWaktu} per pertemuan

### Capaian Pembelajaran (CP) - WAJIB DIIKUTI
${modul.cp ? modul.cp : "Tidak ada CP spesifik yang diberikan."}

### Tujuan Pembelajaran (TP) - WAJIB DICAPAI
${formatTPList(modul.tp)}

### Alur Tujuan Pembelajaran (ATP) - REFERENSI CAKUPAN
${formatATP(modul.atp)}

### Topik Pembelajaran
${modul.topik || "Topik tidak spesifik"}

### Materi Pokok
${formatMateriPokok(modul.materi_pokok)}

## BATASAN CAKUPAN
- Semua konten yang dihasilkan HARUS selaras dan berada dalam cakupan CP, TP, dan ATP di atas
- Model TIDAK BOLEH keluar dari batasan ini
- Jika ada ambiguitas, interpretasi harus konsisten dengan standar kurikulum yang berlaku
`.trim();
}

/**
 * Build Slide Prompt - Minta output JSON array slide per pertemuan
 */
export function buildSlidePrompt(modul: ModulAjarData): string {
  const sharedContext = buildSharedContextPrompt(modul);
  const jumlahPertemuan = modul.jumlah_pertemuan || modul.atp?.pertemuan || 4;
  const alokasiWaktu = modul.alokasi_waktu_per_pertemuan || "35 menit";

  return `${sharedContext}

# TUGAS: BUAT SLIDE OUTLINE

## Instruksi
Buat outline slide presentasi untuk ${jumlahPertemuan} pertemuan (@${alokasiWaktu} per pertemuan).
Output dalam format JSON array.

## Format Output JSON Schema
{
  "slides": [
    {
      "pertemuan": 1,
      "judul_slide": "Judul slide utama",
      "poin_utama": [
        "Poin 1 (maks 5 kata)",
        "Poin 2",
        "Poin 3"
      ],
      "saran_visual": "Deskripsi visual yang disarankan (gambar/diagram yang sesuai)",
      "catatan_pengajar": "Catatan untuk guru tentang slide ini",
      "alokasi_waktu": "${alokasiWaktu}"
    }
  ]
}

## Aturan Slide:
1. Setiap slide: judul, maks 5 poin utama, saran visual, estimasi menit
2. Slide harus mengikuti alur: Pembukaan → Inti → Penutup
3. Visual harus mendukung pemahaman, bukan dekorasi semata
4. Sesuaikan kompleksitas dengan fase: Fase A-C = sederhana, Fase D-E = kompleks
5. Total slide per pertemuan: ${jumlahPertemuan <= 4 ? "6-10 slide" : "4-8 slide"}

## Contoh Slide:
{
  "pertemuan": 1,
  "judul_slide": "Apa itu Fotosintesis?",
  "poin_utama": [
    "Fotosintesis: proses membuat makanan",
    "Terjadi di daun tanaman",
    "Membutuhkan cahaya matahari",
    "Menghasilkan oksigen"
  ],
  "saran_visual": "Ilustrasi proses fotosintesis dengan anak panah aliran",
  "catatan_pengajar": "Gunakan animasi untuk menunjukkan aliran zat",
  "alokasi_waktu": "10 menit"
}

## Respons:
HANYA output JSON valid, tanpa markdown code block, tanpa teks lain.
`.trim();
}

/**
 * Build LKPD Prompt - Minta output JSON aktivitas per pertemuan
 */
export function buildLkpdPrompt(modul: ModulAjarData): string {
  const sharedContext = buildSharedContextPrompt(modul);
  const jumlahPertemuan = modul.jumlah_pertemuan || modul.atp?.pertemuan || 4;

  return `${sharedContext}

# TUGAS: BUAT LKPD (Lembar Kerja Peserta Didik)

## Instruksi
Buat LKPD untuk ${jumlahPertemuan} pertemuan dengan keseimbangan:
- **Olah Pikir** (minimal 40%): pertanyaan analisis, evaluasi, kreasi
- **Olah Hati** (minimal 20%): refleksi nilai, sikap, karakter
- **Olah Rasa** (minimal 20%): ekspresi, empati, konteks emosional
- **Olah Raga** (minimal 20%): aktivitas kinestetik, praktik langsung

Output dalam format JSON.

## Format Output JSON Schema
{
  "lkpd": [
    {
      "pertemuan": 1,
      "judul": "Judul LKPD",
      "tujuan": ["Tujuan pembelajaran spesifik"],
      "keseimbangan": {
        "olah_pikir": "40%",
        "olah_hati": "20%",
        "olah_rasa": "20%",
        "olah_raga": "20%"
      },
      "aktivitas": [
        {
          "tipe": "olah_pikir|olah_hati|olah_rasa|olah_raga",
          "instruksi": "Langkah-langkah aktivitas",
          "pertanyaan_pemandu": ["Pertanyaan untuk memicu berpikir"],
          "ruang_jawaban": "Deskripsi ruang untuk jawaban murid",
          "rubrik_singkat": "Rubrik penilaian 1-4"
        }
      ],
      "waktu_estimasi": "15 menit"
    }
  ]
}

## Aturan LKPD:
1. Instruksi harus jelas dan step-by-step
2. Pertanyaan pemandu harus mendorong berpikir tingkat tinggi (C3-C6)
3. Keseimbangan 4 dimensi OLAH harus terdistribusi dalam setiap pertemuan
4. Ruang jawaban cukup untuk murid SD-SMA (sesuaikan dengan jenjang)
5. Rubrik singkat: 1=Kurang, 2=Cukup, 3=Baik, 4=Sangat Baik
6. Gunakan bahasa yang sesuai fase: Fase A-B = sederhana, Fase C-E = kompleks

## Contoh Aktivitas:
{
  "tipe": "olah_pikir",
  "instruksi": "Baca teks paragraf 1-3, lalu identifikasi ide pokok каждого paragraf.",
  "pertanyaan_pemandu": [
    "Apa ide pokok paragraf pertama?",
    "Bagaimana hubungan antar paragraf?"
  ],
  "ruang_jawaban": "Tabel dengan kolom: No, Ide Pokok, Kalimat Pendukung",
  "rubrik_singkat": "1=Tidak ada, 2=1 ide, 3=2 ide, 4=3+ ide dengan benar"
}

## Respons:
HANYA output JSON valid, tanpa markdown code block, tanpa teks lain.
`.trim();
}

/**
 * Build Handout Prompt - Minta output Markdown materi bacaan mandiri
 */
export function buildHandoutPrompt(modul: ModulAjarData): string {
  const sharedContext = buildSharedContextPrompt(modul);
  const faseLabel = modul.fase || "A";
  const jenjang = modul.jenjang;

  return `${sharedContext}

# TUGAS: BUAT HANDOUT (Bahan Ajar Cetak)

## Instruksi
Buat handout/materi bacaan mandiri untuk murid.
Output dalam format Markdown.

## Format Handout
\`\`\`markdown
# Judul Handout

## Tujuan Pembelajaran
- Tujuan 1
- Tujuan 2

## Peta Konsep
[Diagram/peta konsep dalam teks]

## Materi
### Subtopik 1
Konten materi dengan penjelasan...

### Subtopik 2
Konten materi...

## Contoh Kontekstual Indonesia
[Contoh dari kehidupan sehari-hari di Indonesia]

## Ringkasan
- Poin penting 1
- Poin penting 2

## Latihan Mandiri
1. Soal 1
2. Soal 2

## Daftar Pustaka / Sumber
- Sumber 1
- Sumber 2
\`\`\`

## Aturan Handout:
1. Bahasa harus sesuai fase:
   - Fase A-B (${jenjang} Kelas 1-2): kalimat pendek, banyak gambar/diagram
   - Fase C (${jenjang} Kelas 3): kalimat sedang, penjelasan sistematis
   - Fase D-E (${jenjang} Kelas 4-6/7-9/10-12): kompleks, referensi, analisis
2. Contoh KONTEKSTUAL Indonesia (bukan western/foreign examples)
3. Peta konsep harus membantu murid melihat hubungan antar konsep
4. Latihan mandiri harus mencakup 4 dimensi OLAH
5. Total panjang: Sesuaikan dengan alokasi waktu (maks 3-5 halaman A4)

## Contoh Konten:
# Photosynthesis (Fotosintesis)

## Tujuan Pembelajaran
- Menjelaskan proses fotosintesis
- Menunjukkan peran cahaya matahari

## Peta Konsep
Sinar Matahari → Kloroplas → Glukosa + Oksigen

## Materi
Fotosintesis adalah proses di mana tumbuhan hijau membuat makanan sendiri...
\`\`\`

## Respons:
Output Markdown valid, langsung mulai dengan heading, tanpa preamble.
`.trim();
}

/**
 * Build Compliance Check Prompt - Minta output JSON self-check
 */
export function buildComplianceCheckPrompt(summary: {
  slides?: any;
  lkpd?: any;
  handout?: string;
}): string {
  return `# TUGAS: COMPLIANCE CHECK

## Instruksi
Verifikasi kepatuhan konten yang dihasilkan terhadap standar Permendikdasmen No. 1/2026.

## Content to Review:
${formatSummaryForReview(summary)}

## Format Output JSON:
{
  "selarasCPTPATP": {
    "status": "compliant|partial|non-compliant",
    "catatan": "Penjelasan"
  },
  "mendorongPembelajaranAktif": {
    "status": "compliant|partial|non-compliant",
    "catatan": "Apakah mendorong problem/project/inquiry-based learning"
  },
  "mencakupOlahPikirHatiRasaRaga": {
    "status": "compliant|partial|non-compliant",
    "catatan": "Distribusi keempat dimensi"
  },
  "bahasaSesuaiFase": {
    "status": "compliant|partial|non-compliant",
    "catatan": "Kesesuaian dengan fase dan jenjang"
  },
  "catatan": "Catatan umum atau saran perbaikan"
}

## Kriteria Compliance:
1. **selarasCPTPATP**: Apakah konten berada dalam cakupan CP, TP, ATP yang diberikan?
2. **mendorongPembelajaranAktif**: Apakah ada aktivitas yang mendorong belajar aktif?
3. **mencakupOlahPikirHatiRasaRaga**: Apakah keempat dimensi OLAH terdistribusi?
4. **bahasaSesuaiFase**: Apakah bahasa sesuai dengan fase (A/B/C/D/E) dan jenjang?

## Respons:
HANYA output JSON valid, tanpa markdown code block, tanpa teks lain.
`.trim();
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getJenjangLabel(jenjang: string): string {
  const labels: Record<string, string> = {
    SD: "(Sekolah Dasar)",
    SMP: "(Sekolah Menengah Pertama)",
    SMA: "(Sekolah Menengah Atas)",
    SMK: "(Sekolah Menengah Kejuruan)",
  };
  return labels[jenjang] || "";
}

function formatTPList(tp?: string[]): string {
  if (!tp || tp.length === 0) {
    return "Tidak ada TP spesifik yang diberikan.";
  }
  return tp.map((t, i) => `${i + 1}. ${t}`).join("\n");
}

function formatATP(atp?: {
  pertemuan?: number;
  alur?: Array<{
    minggu?: number;
    topik?: string;
    tujuan?: string[];
    alokasi_waktu?: string;
  }>;
}): string {
  if (!atp || !atp.alur || atp.alur.length === 0) {
    return `Jumlah pertemuan: ${atp?.pertemuan || "tidak spesifik"}\nTidak ada detail ATP yang diberikan.`;
  }

  const lines = [`Jumlah pertemuan: ${atp.pertemuan || atp.alur.length}`];
  atp.alur.forEach((a, i) => {
    lines.push(
      `### Pertemuan/Minggu ${a.minggu || i + 1}: ${a.topik || "Topik"}`
    );
    if (a.tujuan) {
      lines.push(`Tujuan: ${a.tujuan.join(", ")}`);
    }
    if (a.alokasi_waktu) {
      lines.push(`Alokasi: ${a.alokasi_waktu}`);
    }
  });

  return lines.join("\n");
}

function formatMateriPokok(materi?: string[]): string {
  if (!materi || materi.length === 0) {
    return "Tidak ada materi pokok spesifik yang terdaftar.";
  }
  return materi.map((m, i) => `${i + 1}. ${m}`).join("\n");
}

function formatSummaryForReview(summary: {
  slides?: any;
  lkpd?: any;
  handout?: string;
}): string {
  const parts: string[] = [];

  if (summary.slides) {
    parts.push("## SLIDES:\n" + JSON.stringify(summary.slides, null, 2).substring(0, 2000));
  }

  if (summary.lkpd) {
    parts.push("## LKPD:\n" + JSON.stringify(summary.lkpd, null, 2).substring(0, 2000));
  }

  if (summary.handout) {
    parts.push("## HANDOUT:\n" + summary.handout.substring(0, 2000));
  }

  return parts.join("\n\n") || "Tidak ada konten untuk direview.";
}

/**
 * Build system instruction dengan context caching support
 */
export function buildCachedSystemInstruction(modul: ModulAjarData): {
  systemInstruction: string;
  cachedContext: string;
} {
  return {
    systemInstruction: SYSTEM_INSTRUCTION_BAHAN_AJAR,
    cachedContext: buildSharedContextPrompt(modul),
  };
}

// ============================================
// NEW PROMPT BUILDERS (v2 - with jumlahSlideTarget support)
// ============================================

/**
 * Build slide generation prompt (v2) dengan cachedContent support
 */
export function buildSlidePromptV2(
  modul: ModulAjarData,
  options?: {
    jumlahSlideTarget?: number;
    gayaVisual?: "minimalis" | "ilustratif" | "akademis";
  }
): {
  systemInstruction: string;
  userPrompt: string;
} {
  const jumlahSlide = options?.jumlahSlideTarget || 10;
  const gayaVisual = options?.gayaVisual || "minimalis";
  const alokasiWaktu = modul.alokasi_waktu_per_pertemuan || "35 menit";

  const sharedContext = buildSharedContextPrompt(modul);

  // Gaya visual guidance
  const gayaVisualGuide: Record<string, string> = {
    minimalis: "Clean, banyak whitespace, teks ringkas, warna solid.",
    ilustratif: "Placeholder area untuk gambar, ikon, diagram yang disarankan.",
    akademis: "Formal, teks lebih padat, referensi, sumber yang jelas.",
  };

  return {
    systemInstruction: SYSTEM_PROMPT_SLIDES,
    userPrompt: `${sharedContext}

## SLIDE GENERATION OPTIONS
- Target jumlah slide: ${jumlahSlide} (panduan, boleh ±2)
- Gaya visual: ${gayaVisual} — ${gayaVisualGuide[gayaVisual]}
- Alokasi waktu per pertemuan: ${alokasiWaktu}

## TUGAS
Buat outline slide presentasi yang sesuai dengan ${jumlahSlide} slide target.

## OUTPUT
JSON sesuai schema slidesOutputSchema.
`,
  };
}

/**
 * Build handout generation prompt (v2) dengan cachedContent support
 */
export function buildHandoutPromptV2(
  modul: ModulAjarData,
  options?: {
    versi?: "guru" | "siswa";
  }
): {
  systemInstruction: string;
  userPrompt: string;
} {
  const versi = options?.versi || "guru";
  const sharedContext = buildSharedContextPrompt(modul);

  return {
    systemInstruction: SYSTEM_PROMPT_HANDOUT,
    userPrompt: `${sharedContext}

## HANDOUT GENERATION OPTIONS
- Versi: ${versi} (${versi === "guru" ? "dengan kunci jawaban" : "tanpa kunci jawaban"})

## TUGAS
Buat handout ringkasan materi yang lengkap dan mandiri terbaca.

## OUTPUT
JSON sesuai schema handoutOutputSchema. kunciJawaban ${versi === "guru" ? "WAJIB diisi" : "null"}.

## CATATAN KHUSUS VERSI ${versi.toUpperCase()}:
${versi === "guru"
  ? "- Sertakan kunci jawaban untuk setiap soal latihan"
  : "- HANYA tampilkan soal, tanpa kunci jawaban"
}
`,
  };
}
