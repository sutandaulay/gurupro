/**
 * Silabus/ATP Prompt for AI Generation
 * System prompt with context caching support
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
6. Keluarkan HANYA JSON valid sesuai schema, tanpa teks pembuka/penutup/markdown fence.`;

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

  const parsed = JSON.parse(cleanText.trim());
  return validateSilabusOutput(parsed);
}
