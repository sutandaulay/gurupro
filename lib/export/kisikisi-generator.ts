/**
 * Kisi-kisi Generator Utility
 * Generates formatted Kisi-kisi documents for export
 * Standar dokumen resmi Indonesia
 */

import {
  buildKopSekolahHTML,
  buildIdentitasTableHTML,
  buildSignatureBlockHTML,
  buildDocumentFooterHTML,
  buildWordDocTemplate,
  escapeHtml,
  formatTanggalIndonesia,
} from './document-shared';

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
  guruNip?: string;
}

export interface MetaInfo {
  mapel?: string;
  kelas?: string;
  topik?: string;
  kurikulum?: string;
  jenjang?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolNpsn?: string;
  schoolLogo?: string;
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
    includeSchoolHeader, signatureName, signatureDate, guruNip,
  } = options;

  // --- Kop Sekolah ---
  let kopHtml = '';
  if (includeSchoolHeader) {
    kopHtml = buildKopSekolahHTML({
      nama_sekolah: meta.schoolName || meta.namaSekolah || 'Nama Sekolah',
      alamat: meta.schoolAddress,
      npsn: meta.schoolNpsn,
      logo: meta.schoolLogo,
    });
  }

  // --- Meta info bar ---
  const metaBarHtml = `
  <p style="text-align:center;font-size:10pt;margin:8px 0 12px;">
    <strong>Mata Pelajaran:</strong> ${escapeHtml(meta.mapel || '-')} |
    <strong>Kelas:</strong> ${escapeHtml(meta.kelas || '-')} |
    <strong>Kurikulum:</strong> ${escapeHtml(meta.kurikulum || '-')} |
    <strong>Jenjang:</strong> ${escapeHtml(meta.jenjang || '-')}
  </p>`;

  // --- Table headers ---
  const headerColumns = [
    includeTipe ? '<th style="border:1px solid #000;padding:8px;background:#f3f4f6;font-size:9pt;text-align:center;font-weight:bold;vertical-align:middle;">Tipe Soal</th>' : '',
    '<th style="border:1px solid #000;padding:8px;background:#f3f4f6;font-size:9pt;text-align:center;font-weight:bold;vertical-align:middle;">No</th>',
    includeMateri ? '<th style="border:1px solid #000;padding:8px;background:#f3f4f6;font-size:9pt;font-weight:bold;vertical-align:middle;">Materi Pokok</th>' : '',
    includeCP ? '<th style="border:1px solid #000;padding:8px;background:#f3f4f6;font-size:9pt;font-weight:bold;vertical-align:middle;">Capaian Pembelajaran</th>' : '',
    includeTP ? '<th style="border:1px solid #000;padding:8px;background:#f3f4f6;font-size:9pt;font-weight:bold;vertical-align:middle;">Tujuan Pembelajaran</th>' : '',
    includeIndikator ? '<th style="border:1px solid #000;padding:8px;background:#f3f4f6;font-size:9pt;font-weight:bold;vertical-align:middle;">Indikator</th>' : '',
    includeLevel ? '<th style="border:1px solid #000;padding:8px;background:#f3f4f6;font-size:9pt;text-align:center;font-weight:bold;vertical-align:middle;">Level (Bloom)</th>' : '',
    includeKesulitan ? '<th style="border:1px solid #000;padding:8px;background:#f3f4f6;font-size:9pt;text-align:center;font-weight:bold;vertical-align:middle;">Tingkat Kesukaran</th>' : '',
    includeKunci ? '<th style="border:1px solid #000;padding:8px;background:#f3f4f6;font-size:9pt;text-align:center;font-weight:bold;vertical-align:middle;">Kunci Jawaban</th>' : '',
    includeSkor ? '<th style="border:1px solid #000;padding:8px;background:#f3f4f6;font-size:9pt;text-align:center;font-weight:bold;vertical-align:middle;">Skor</th>' : '',
  ].filter(Boolean).join('');

  // --- Table rows ---
  const rows = soalList.map((soal, idx) => {
    const rowBg = idx % 2 === 0 ? '#fff' : '#f9fafb';
    const cells = [
      includeTipe ? `<td style="border:1px solid #000;padding:6px;font-size:9pt;vertical-align:top;background:${rowBg};">${escapeHtml(getTypeLabel(soal.tipe))}</td>` : '',
      `<td style="border:1px solid #000;padding:6px;font-size:9pt;text-align:center;vertical-align:middle;background:${rowBg};">${idx + 1}</td>`,
      includeMateri ? `<td style="border:1px solid #000;padding:6px;font-size:9pt;vertical-align:top;background:${rowBg};">${escapeHtml(soal.elemen || '-')}</td>` : '',
      includeCP ? `<td style="border:1px solid #000;padding:6px;font-size:9pt;vertical-align:top;background:${rowBg};">${escapeHtml(soal.cp || '-')}</td>` : '',
      includeTP ? `<td style="border:1px solid #000;padding:6px;font-size:9pt;vertical-align:top;background:${rowBg};">${escapeHtml(soal.tp || '-')}</td>` : '',
      includeIndikator ? `<td style="border:1px solid #000;padding:6px;font-size:9pt;vertical-align:top;background:${rowBg};">${escapeHtml(soal.indikator || '-')}</td>` : '',
      includeLevel ? `<td style="border:1px solid #000;padding:6px;font-size:9pt;text-align:center;vertical-align:middle;background:${rowBg};">${escapeHtml(soal.kognitif || '-')}</td>` : '',
      includeKesulitan ? `<td style="border:1px solid #000;padding:6px;font-size:9pt;text-align:center;vertical-align:middle;background:${rowBg};">${(soal.tingkat || '-').charAt(0).toUpperCase()}</td>` : '',
      includeKunci ? `<td style="border:1px solid #000;padding:6px;font-size:9pt;text-align:center;vertical-align:middle;background:${rowBg};">${escapeHtml(formatKunci(soal.kunci))}</td>` : '',
      includeSkor ? `<td style="border:1px solid #000;padding:6px;font-size:9pt;text-align:center;vertical-align:middle;background:${rowBg};">${soal.skor || 1}</td>` : '',
    ].filter(Boolean).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const tableHtml = `
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr>${headerColumns}</tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`;

  // --- Signature ---
  const signatureHtml = buildSignatureBlockHTML({
    guruNama: signatureName || meta.teacherName || meta.namaGuru || '_____________________',
    guruNip: guruNip,
    kepalaNama: '_____________________',
    kepalaNip: undefined,
    lokasi: meta.schoolName || meta.namaSekolah || '',
    tanggal: signatureDate || formatTanggalIndonesia(new Date()),
  });

  // --- Footer ---
  const footerHtml = buildDocumentFooterHTML({
    showPageNumber: false,
    showDisclaimer: true,
    showDate: false,
  });

  // --- Title & meta ---
  const titleHtml = `
  <div style="text-align:center;margin-bottom:12px;">
    <h2 style="font-size:14pt;font-weight:bold;text-transform:uppercase;margin:0 0 4px;">KISI-KISI PENULISAN SOAL</h2>
  </div>`;

  // --- Body ---
  const body = `
  ${kopHtml}

  ${titleHtml}

  ${metaBarHtml}

  ${tableHtml}

  ${signatureHtml}

  ${footerHtml}`;

  return buildWordDocTemplate(body, `Kisi-Kisi - ${meta.mapel || 'Mata Pelajaran'}`);
}

export function generateKisikisiDocx(
  soalList: SoalItem[],
  meta: MetaInfo,
  options: KisikisiOptions
): string {
  return generateKisikisiHTML(soalList, meta, options);
}

export function downloadKisikisiPdf(html: string, filename: string): void {
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
    return (kunci as object[]).map(k => JSON.stringify(k)).join(', ').substring(0, 80);
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
  signatureDate: formatTanggalIndonesia(new Date()),
};
