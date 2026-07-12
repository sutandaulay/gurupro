/**
 * Kisi-kisi Generator Utility
 * Generates formatted Kisi-kisi documents for export
 */

export interface KisikisiOptions {
  includeTipe: boolean;
  includeMateri: boolean;
  includeCP: boolean;
  includeTP: boolean;
  includeIndikator: boolean;
  includeLevel: boolean;
  includeKesulitan: boolean;
  includeKunci: boolean;
  includeSkor: boolean;
  includeSchoolHeader: boolean;
  signatureName: string;
  signatureDate: string;
}

export interface MetaInfo {
  mapel?: string;
  kelas?: string;
  topik?: string;
  kurikulum?: string;
  jenjang?: string;
  schoolName?: string;
  schoolAddress?: string;
  teacherName?: string;
  namaGuru?: string;
  namaSekolah?: string;
}

export interface SoalItem {
  nomor: number;
  tipe: string;
  elemen?: string;
  cp?: string;
  tp?: string;
  indikator?: string;
  kognitif?: string;
  tingkat?: string;
  kunci?: string | string[] | object[];
  skor?: number;
  pertanyaan: string;
}

const typeLabelsMap: Record<string, string> = {
  "pg": "Pilihan Ganda",
  "isian": "Isian Singkat",
  "essay": "Essay/Uraian",
  "pg-kompleks": "PG Kompleks",
  "bs": "Benar/Salah",
  "jodoh": "Menjodohkan",
  "urutan": "Urutan",
  "tabel": "Melengkapi Tabel",
  "sebab-akibat": "Sebab-Akibat",
};

export function getTypeLabel(tipe: string): string {
  return typeLabelsMap[tipe] || tipe;
}

export function generateKisikisiHTML(
  soalList: SoalItem[],
  meta: MetaInfo,
  options: KisikisiOptions
): string {
  const {
    includeTipe, includeMateri, includeCP, includeTP,
    includeIndikator, includeLevel, includeKesulitan, includeKunci, includeSkor,
    includeSchoolHeader, signatureName, signatureDate
  } = options;

  let headerHtml = "";
  if (includeSchoolHeader) {
    headerHtml = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-size: 16pt; font-weight: bold; margin: 0;">${meta.schoolName || meta.namaSekolah || 'Nama Sekolah'}</h1>
        <p style="margin: 2px 0; font-size: 10pt;">${meta.schoolAddress || 'Alamat Sekolah'}</p>
      </div>
      <hr style="border: 2px solid black; margin-bottom: 15px;" />
    `;
  }

  const headerColumns = [
    includeTipe ? '<th style="border: 1px solid black; padding: 8px; background: #f0f0f0; font-size: 9pt;">Tipe Soal</th>' : '',
    '<th style="border: 1px solid black; padding: 8px; background: #f0f0f0; font-size: 9pt;">No</th>',
    includeMateri ? '<th style="border: 1px solid black; padding: 8px; background: #f0f0f0; font-size: 9pt;">Materi Pokok</th>' : '',
    includeCP ? '<th style="border: 1px solid black; padding: 8px; background: #f0f0f0; font-size: 9pt;">Capaian Pembelajaran</th>' : '',
    includeTP ? '<th style="border: 1px solid black; padding: 8px; background: #f0f0f0; font-size: 9pt;">Tujuan Pembelajaran</th>' : '',
    includeIndikator ? '<th style="border: 1px solid black; padding: 8px; background: #f0f0f0; font-size: 9pt;">Indikator</th>' : '',
    includeLevel ? '<th style="border: 1px solid black; padding: 8px; background: #f0f0f0; font-size: 9pt;">Level (Bloom)</th>' : '',
    includeKesulitan ? '<th style="border: 1px solid black; padding: 8px; background: #f0f0f0; font-size: 9pt;">Tingkat Kesukaran</th>' : '',
    includeKunci ? '<th style="border: 1px solid black; padding: 8px; background: #f0f0f0; font-size: 9pt;">Kunci Jawaban</th>' : '',
    includeSkor ? '<th style="border: 1px solid black; padding: 8px; background: #f0f0f0; font-size: 9pt;">Skor</th>' : '',
  ].filter(Boolean).join('');

  const rows = soalList.map((soal, idx) => {
    const cells = [
      includeTipe ? `<td style="border: 1px solid black; padding: 6px; font-size: 9pt;">${getTypeLabel(soal.tipe)}</td>` : '',
      `<td style="border: 1px solid black; padding: 6px; font-size: 9pt; text-align: center;">${idx + 1}</td>`,
      includeMateri ? `<td style="border: 1px solid black; padding: 6px; font-size: 9pt;">${soal.elemen || '-'}</td>` : '',
      includeCP ? `<td style="border: 1px solid black; padding: 6px; font-size: 9pt;">${soal.cp || '-'}</td>` : '',
      includeTP ? `<td style="border: 1px solid black; padding: 6px; font-size: 9pt;">${soal.tp || '-'}</td>` : '',
      includeIndikator ? `<td style="border: 1px solid black; padding: 6px; font-size: 9pt;">${soal.indikator || '-'}</td>` : '',
      includeLevel ? `<td style="border: 1px solid black; padding: 6px; font-size: 9pt; text-align: center;">${soal.kognitif || '-'}</td>` : '',
      includeKesulitan ? `<td style="border: 1px solid black; padding: 6px; font-size: 9pt; text-align: center;">${(soal.tingkat || '-').charAt(0).toUpperCase()}</td>` : '',
      includeKunci ? `<td style="border: 1px solid black; padding: 6px; font-size: 9pt; text-align: center;">${formatKunci(soal.kunci)}</td>` : '',
      includeSkor ? `<td style="border: 1px solid black; padding: 6px; font-size: 9pt; text-align: center;">${soal.skor || 1}</td>` : '',
    ].filter(Boolean).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const signatureHtml = `
    <div style="margin-top: 40px; page-break-inside: avoid;">
      <table style="width: 100%; border: none; margin-top: 30px;">
        <tr>
          <td style="width: 60%; border: none;"></td>
          <td style="width: 40%; border: none; text-align: center;">
            <p style="font-size: 10pt; margin: 0;">${signatureDate || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p style="font-size: 10pt; margin: 0;">Guru Mata Pelajaran,</p>
            <div style="height: 60px;"></div>
            <p style="font-size: 10pt; margin: 0; text-decoration: underline;">${signatureName || meta.teacherName || meta.namaGuru || '_____________________'}</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Kisi-Kisi - ${meta.mapel || 'Mata Pelajaran'}</title>
      <style>
        @page { size: landscape; margin: 1cm; }
        body { font-family: 'Times New Roman', serif; font-size: 11pt; margin: 0; padding: 20px; }
        h2 { text-align: center; font-size: 14pt; margin-bottom: 5px; }
        .meta-info { text-align: center; font-size: 10pt; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid black; }
        .no-print { display: none; }
        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      ${headerHtml}

      <h2>KISI-KISI PENULISAN SOAL</h2>
      <p class="meta-info">
        <strong>Mata Pelajaran:</strong> ${meta.mapel || '-'} |
        <strong>Kelas/Semester:</strong> ${meta.kelas || '-'} |
        <strong>Kurikulum:</strong> ${meta.kurikulum || '-'} |
        <strong>Jenjang:</strong> ${meta.jenjang || '-'}
      </p>

      <table>
        <thead>
          <tr>${headerColumns}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      ${signatureHtml}
    </body>
    </html>
  `;
}

export function generateKisikisiDocx(
  soalList: SoalItem[],
  meta: MetaInfo,
  options: KisikisiOptions
): string {
  // Generate HTML with Word-compatible markup
  const html = generateKisikisiHTML(soalList, meta, options);
  // Return the same HTML as docx (browser will handle conversion)
  return html;
}

export function downloadKisikisiPdf(html: string, filename: string): void {
  // This will be called from the dashboard with html2pdf
  // The actual PDF generation happens in the dashboard
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadKisikisiWord(html: string, filename: string): void {
  const blob = new Blob(['﻿' + html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatKunci(kunci: string | string[] | object[] | undefined): string {
  if (!kunci) return '-';
  if (Array.isArray(kunci)) {
    if (typeof kunci[0] === 'string') {
      return (kunci as string[]).join(', ');
    }
    return JSON.stringify(kunci).substring(0, 50);
  }
  return String(kunci);
}

export const defaultKisikisiOptions: KisikisiOptions = {
  includeTipe: true,
  includeMateri: true,
  includeCP: true,
  includeTP: true,
  includeIndikator: true,
  includeLevel: true,
  includeKesulitan: true,
  includeKunci: true,
  includeSkor: true,
  includeSchoolHeader: true,
  signatureName: '',
  signatureDate: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
};
