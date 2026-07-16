/**
 * Silabus/ATP Prompt for AI Generation
 * System prompt with context caching support
 *
 * Updated: 14 Juli 2026 - Menambahkan batas karakter, larangan markdown, dan few-shot example
 * Reference: docs/ai-generation-standard.md
 */

import { z } from 'zod';
import { silabusOutputSchema, type SilabusOutput } from '@/lib/schemas/silabus';

// ============================================
// SYSTEM PROMPT (Cached)
// ============================================

export const SILABUS_SYSTEM_PROMPT = `Kamu adalah asisten penyusun Alur Tujuan Pembelajaran (ATP) / Silabus Pembelajaran Semester untuk guru Indonesia, sesuai Permendikdasmen No. 1/2026 dan No. 13/2025.

ATURAN WAJIB:
1. ATP disusun sebagai URUTAN UNIT belajar untuk 1 semester penuh, bukan 1 topik saja.
2. Setiap unit HARUS punya estimasi pertemuan & minggu yang realistis dan totalnya harus konsisten dengan jumlahMingguEfektif yang diberikan (default 18 minggu/semester termasuk buffer ujian).
3. kataKunciMateri BUKAN uraian materi — cukup 3-5 kata kunci per unit untuk efisiensi token (uraian lengkap ada di Modul Ajar tiap unit, bukan di sini).
4. catatanKokurikuler diisi HANYA jika unit tersebut relevan dengan kolaborasi lintas mapel atau Gerakan 7 Kebiasaan Anak Indonesia Hebat — jangan dipaksakan di semua unit.
5. Jangan tumpang tindih kompetensi antar unit — tiap unit progresif dari unit sebelumnya.

BATASAN PANJANG PER-FIELD (WAJIB DIIKUTI):
- topik (setiap unit): MAKSIMAL 100 KARAKTER
- tujuanPembelajaran (setiap item): MAKSIMAL 200 KARAKTER
- kataKunciMateri (setiap item): MAKSIMAL 50 KARAKTER
- catatanKokurikuler: MAKSIMAL 300 KARAKTER
- capaianPembelajaran: MAKSIMAL 2000 KARAKTER

LARANGAN FORMAT MARKDOWN DI DALAM JSON VALUE:
- ❌ Jangan pakai **bold**, *italic*, # heading
- ❌ Jangan pakai bullet list ( - , * ) di dalam string
- ❌ Jangan pakai \`code block\` di dalam string
- ✅ Gunakan plain text biasa dengan punctuation standar Indonesia

OUTPUT JSON SCHEMA:
{
  "identitas": {
    "mataPelajaran": "string",
    "fase": "A/B/C/D/E/F",
    "kelas": "string",
    "semester": 1 | 2,
    "tahunAjaran": "string | null"
  },
  "capaianPembelajaran": "string (maks 2000 karakter)",
  "alurTujuanPembelajaran": [
    {
      "unitKe": 1,
      "topik": "string (maks 100 karakter)",
      "tujuanPembelajaran": ["TP-1: tujuan (maks 200 karakter)", "TP-2: tujuan"],
      "dimensiProfilLulusanTerhubung": ["Dimensi 1", "Dimensi 2"],
      "estimasiPertemuan": 2,
      "estimasiMinggu": 1,
      "kataKunciMateri": ["kata kunci 1 (maks 50 karakter)", "kata kunci 2"],
      "catatanKokurikuler": null | "string (maks 300 karakter)"
    }
  ],
  "totalEstimasi": {
    "totalPertemuan": number,
    "totalMinggu": number
  }
}

CONTOH OUTPUT YANG BENAR:
{
  "identitas": {
    "mataPelajaran": "Bahasa Indonesia",
    "fase": "D",
    "kelas": "Kelas VII",
    "semester": 1,
    "tahunAjaran": "2026/2027"
  },
  "capaianPembelajaran": "Peserta didik mampu memahami dan menganalisis teks narasi sederhana...",
  "alurTujuanPembelajaran": [
    {
      "unitKe": 1,
      "topik": "Teks Narasi: Ciri dan Struktur",
      "tujuanPembelajaran": [
        "TP-1: Mengidentifikasi ciri-ciri teks narasi",
        "TP-2: Menjelaskan struktur teks narasi"
      ],
      "dimensiProfilLulusanTerhubung": ["Bernalar Kritis", "Kreatif"],
      "estimasiPertemuan": 4,
      "estimasiMinggu": 2,
      "kataKunciMateri": ["narasi", "struktur teks", "alur"],
      "catatanKokurikuler": null
    }
  ],
  "totalEstimasi": {
    "totalPertemuan": 4,
    "totalMinggu": 2
  }
}

CATATAN: AI TIDAK SELALU PATUH BATASAN KARAKTER. LAKUKAN TRUNCATE DI LAYER VALIDASI.

Keluarkan HANYA JSON valid sesuai schema, tanpa teks pembuka/penutup/markdown fence.`;

// ============================================
// USER PROMPT TEMPLATE (Dynamic Input)
// ============================================

export interface SilabusPromptInput {
  // Identitas
  sekolah?: string;
  npsn?: string;
  tahunAjaran?: string;

  // Mata Pelajaran
  mataPelajaran: string;
  jenjang: string;
  fase: string;
  kelas: string;
  semester: 1 | 2;

  // Capaian Pembelajaran
  capaianPembelajaran?: string;

  // Minggu Efektif
  jumlahMingguEfektif: number;

  // Kurikulum Options
  kurikulum?: string;
  dimensi8?: string[];
  tigaPengalaman?: boolean;

  // PAI Mode
  paiMode?: 'none' | 'spiritual_only' | 'hybrid_kbc';
}

export function buildSilabusPrompt(input: SilabusPromptInput): string {
  const {
    sekolah,
    npsn,
    tahunAjaran,
    mataPelajaran,
    jenjang,
    fase,
    kelas,
    semester,
    capaianPembelajaran,
    jumlahMingguEfektif,
    kurikulum,
    dimensi8,
    tigaPengalaman,
    paiMode,
  } = input;

  const faseDesc = getFaseDescription(fase);
  const kurikulumLabel = getKurikulumLabel(kurikulum);
  const dimensi8Context = buildDimensi8Context(dimensi8);
  const paiContext = buildPaiContext(paiMode);

  const schoolInfo = sekolah
    ? `Sekolah: ${sekolah}${npsn ? ` (NPSN: ${npsn})` : ''}\nTahun Ajaran: ${tahunAjaran || '...'}`
    : '';

  const semesterBuffer = semester === 1
    ? { pts: 8, pas: 17, label: 'Ganjil' }
    : { pts: 8, pas: 16, label: 'Genap' };

  const prompt = `
${schoolInfo ? `IDENTITAS:\n${schoolInfo}\n` : ''}
SPESIFIKASI:
- Mata Pelajaran: ${mataPelajaran}
- Jenjang: ${jenjang}
- Fase: ${fase} ${faseDesc}
- Kurikulum: ${kurikulumLabel}
- Semester: ${semesterBuffer.label} (${semester === 1 ? 'Juli-Desember' : 'Januari-Juni'})
- Jumlah Minggu Efektif: ${jumlahMingguEfektif} minggu
- Buffer PTS/STS: Minggu ${semesterBuffer.pts}
- Buffer PAS/SAS: Minggu ${semesterBuffer.pas}

${capaianPembelajaran ? `CAPAIAN PEMBELAJARAN (dari input user):\n${capaianPembelajaran}\n` : ''}
${dimensi8Context}
${paiContext}

OUTPUT JSON SCHEMA:
{
  "identitas": {
    "mataPelajaran": "${mataPelajaran}",
    "fase": "${fase}",
    "kelas": "${kelas}",
    "semester": ${semester},
    "tahunAjaran": null
  },
  "capaianPembelajaran": "[CP yang relevan untuk ${mataPelajaran} fase ${fase}]",
  "alurTujuanPembelajaran": [
    {
      "unitKe": 1,
      "topik": "[Nama topik/unit 1]",
      "tujuanPembelajaran": ["TP-1: [tujuan spesifik]", "TP-2: [tujuan spesifik]"],
      "dimensiProfilLulusanTerhubung": ["Dimensi 1", "Dimensi 2"],
      "estimasiPertemuan": 2,
      "estimasiMinggu": 1,
      "kataKunciMateri": ["kata kunci 1", "kata kunci 2", "kata kunci 3"],
      "catatanKokurikuler": null
    }
    // ... lebih banyak unit sampai total ${jumlahMingguEfektif} minggu
  ],
  "totalEstimasi": {
    "totalPertemuan": [total pertemuan semua unit],
    "totalMinggu": [total minggu semua unit]
  }
}

CATATAN PENTING:
- Total minggu semua unit HARUS sama dengan atau mendekati ${jumlahMingguEfektif}
- Satu unit = 1-3 pertemuan, tergantung kompleksitas materi
- Pts/STS week ${semesterBuffer.pts} dan PAS/SAS week ${semesterBuffer.pas} sudah termasuk dalam buffer
- Tujuan pembelajaran harus progressive (unit 2 > unit 1 dalam hal kedalaman)
- Maksimal 2 dimensi profil lulusan per unit (prioritas yang paling relevan)
`;

  return prompt.trim();
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getFaseDescription(fase: string): string {
  const descriptions: Record<string, string> = {
    A: '(SD Kelas 1-2)',
    B: '(SD Kelas 3)',
    C: '(SD Kelas 4-6)',
    D: '(SMP Kelas 7-9)',
    E: '(SMA Kelas 10-11)',
    F: '(SMA/SMK Kelas 12)',
  };
  return descriptions[fase] || '';
}

function getKurikulumLabel(kurikulum?: string): string {
  const labels: Record<string, string> = {
    merdeka: 'Kurikulum Merdeka',
    k13: 'Kurikulum 2013',
    kbc: 'Kurikulum Berbasis Cinta',
    hybrid: 'Hybrid',
  };
  return kurikulum ? labels[kurikulum] || kurikulum : 'Kurikulum Merdeka';
}

function buildDimensi8Context(dimensi8?: string[]): string {
  if (!dimensi8 || dimensi8.length === 0) {
    return '';
  }

  const dimensi8Labels: Record<string, string> = {
    imtaq: 'Beriman, Bertakwa, Berakhlak Mulia',
    berkebinekaan_global: 'Berkebinekaan Global',
    bergotong_royong: 'Gotong Royong',
    merdeka: 'Merdeka',
    kreatif: 'Kreatif',
    bernalar_kritis: 'Bernalar Kritis',
    budi_pekerti_luhur: 'Mengakar pada Budi Pekerti Luhur',
    kreativitas: 'Kreativitas (Deep Learning)',
  };

  return `PROFIL PELAJAR PANCASILA — DIMENSI TERPILIH:
${dimensi8.map((k) => `- ${dimensi8Labels[k] || k}`).join('\n')}
Integrasikan dimensi ini dalam setiap unit pembelajaran.`;
}

function buildPaiContext(paiMode?: string): string {
  if (!paiMode || paiMode === 'none') {
    return '';
  }

  return `KETENTUAN GURU PAI (Kepka BKPDM No. 020/2026):
- Modus: ${paiMode === 'hybrid_kbc' ? 'Hybrid KBC' : 'Integrasi Spiritual'}
- Integrasikan nilai Imtaq, Akhlakul Karimah, Hablumminallah, Habluminannas`;
}

// ============================================
// VALIDATION
// ============================================

import { truncateText } from './validation-utils';

/**
 * Enforce character limits on Silabus output
 * - AI tidak selalu patuh batas di prompt, jadi enforce di sini
 */
export function enforceSilabusLimits(output: unknown): SilabusOutput {
  if (!output || typeof output !== 'object') {
    throw new Error('Invalid Silabus output');
  }

  const data = output as Record<string, unknown>;

  // Truncate fields
  const processed = {
    identitas: {
      mataPelajaran: String(data.identitas?.mataPelajaran || ''),
      fase: String(data.identitas?.fase || ''),
      kelas: String(data.identitas?.kelas || ''),
      semester: Number(data.identitas?.semester || 1),
      tahunAjaran: data.identitas?.tahunAjaran ?? null,
    },
    capaianPembelajaran: truncateText(
      data.capaianPembelajaran,
      2000,
      '... [catatan:超出了 batas maksimum 2000 karakter]'
    ) || 'Data capaian pembelajaran tidak tersedia',
    alurTujuanPembelajaran: Array.isArray(data.alurTujuanPembelajaran)
      ? data.alurTujuanPembelajaran.map((unit: any, idx: number) => ({
          unitKe: Number(unit?.unitKe ?? idx + 1),
          topik: truncateText(unit?.topik, 100) || `Unit ${idx + 1}`,
          tujuanPembelajaran: Array.isArray(unit?.tujuanPembelajaran)
            ? unit.tujuanPembelajaran.map((tp: string) =>
                truncateText(tp, 200) || 'Tujuan pembelajaran tidak tersedia'
              )
            : [],
          dimensiProfilLulusanTerhubung: Array.isArray(unit?.dimensiProfilLulusanTerhubung)
            ? unit.dimensiProfilLulusanTerhubung.slice(0, 2)
            : [],
          estimasiPertemuan: Number(unit?.estimasiPertemuan ?? 1),
          estimasiMinggu: Number(unit?.estimasiMinggu ?? 1),
          kataKunciMateri: Array.isArray(unit?.kataKunciMateri)
            ? unit.kataKunciMateri.slice(0, 5).map((kw: string) =>
                truncateText(kw, 50) || ''
              ).filter(Boolean)
            : [],
          catatanKokurikuler: unit?.catatanKokurikuler
            ? truncateText(unit.catatanKokurikuler, 300)
            : null,
        }))
      : [],
    totalEstimasi: {
      totalPertemuan: Number(data.totalEstimasi?.totalPertemuan ?? 0),
      totalMinggu: Number(data.totalEstimasi?.totalMinggu ?? 0),
    },
  };

  // Validate with schema
  return validateSilabusOutput(processed);
}

export function validateSilabusOutput(output: unknown): SilabusOutput {
  const result = silabusOutputSchema.safeParse(output);

  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Silabus output validation failed: ${errors}`);
  }

  return result.data;
}

// ============================================
// PARSING HELPERS
// ============================================

export function parseSilabusFromAIResponse(text: string): SilabusOutput {
  // Clean markdown code blocks
  let cleanText = text.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.slice(7);
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.slice(3);
  }
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.slice(0, -3);
  }

  try {
    const parsed = JSON.parse(cleanText.trim());
    // Enforce limits dan validate
    return enforceSilabusLimits(parsed);
  } catch (parseError) {
    console.error('[Silabus] Parse/enforce failed:', parseError);
    // Fallback - return minimal valid structure
    return {
      identitas: {
        mataPelajaran: 'Tidak tersedia',
        fase: 'E',
        kelas: 'Kelas',
        semester: 1,
        tahunAjaran: null,
      },
      capaianPembelajaran: 'Data tidak tersedia',
      alurTujuanPembelajaran: [],
      totalEstimasi: {
        totalPertemuan: 0,
        totalMinggu: 0,
      },
    };
  }
}
