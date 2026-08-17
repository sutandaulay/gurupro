/**
 * Laporan Kinerja PDF Generator
 * Uses pdfkit to produce true PDF documents with signature image support
 */

import PDFDocument from 'pdfkit';
import type { LaporanKinerjaContent } from '@/app/api/laporan-kinerja/[id]/download/route';

// Re-export escape for use here
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTanggalIndonesia(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export interface LaporanKinerjaPdfOptions {
  judul: string;
  semesterLabel: string;
  tahunAjaran: string;
  predikat?: string | null;

  // Kop sekolah
  namaSekolah: string;
  alamat?: string | null;
  npsn?: string | null;
  logoUrl?: string | null;

  // Identity
  guruNama: string;
  guruNip: string;
  mataPelajaran: string;
  kelas: string;
  sekolah: string;
  periode: string;

  // Content
  sections: Array<{ heading: string; content: string }>;
  ringkasanSingkat?: string;

  // Signatures
  kepalaNama: string;
  kepalaNip?: string | null;
  guruNamaTtd: string;
  guruNipTtd?: string | null;
  lokasi: string;
  tanggal: Date;
  kepalaSignatureUrl?: string | null;
  guruSignatureUrl?: string | null;
}

export async function generateLaporanKinerjaPdfBuffer(
  options: LaporanKinerjaPdfOptions
): Promise<Buffer> {
  const {
    judul, semesterLabel, tahunAjaran, predikat,
    namaSekolah, alamat, npsn, logoUrl,
    guruNama, guruNip, mataPelajaran, kelas, sekolah, periode,
    sections, ringkasanSingkat,
    kepalaNama, kepalaNip, guruNamaTtd, guruNipTtd, lokasi,
    tanggal, kepalaSignatureUrl, guruSignatureUrl,
  } = options;

  return new Promise((resolve, reject) => {
    // A4 portrait with 3cm left margin for binding
    const doc = new PDFDocument({
      margin: 0,
      size: 'A4',
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const PAGE_WIDTH = doc.page.width as number; // ~595pt (A4)
    const PAGE_HEIGHT = doc.page.height as number; // ~842pt
    const MARGIN_LEFT = 85; // 3cm ≈ 85pt
    const MARGIN_RIGHT = 57; // 2cm ≈ 57pt
    const MARGIN_TOP = 71; // 2.5cm ≈ 71pt
    const MARGIN_BOTTOM = 57; // 2cm ≈ 57pt
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

    // Colors
    const BLACK = '#000000';
    const DARK = '#1F2937';
    const GRAY = '#6B7280';
    const VIOLET = '#7C3AED';
    const BORDER = '#374151';

    let pageNum = 1;
    let y = MARGIN_TOP;

    const checkPageBreak = (needed: number) => {
      if (y + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        y = MARGIN_TOP;
        pageNum++;
      }
    };

    const addPageNumber = () => {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(GRAY)
        .text(
          `Halaman ${pageNum}`,
          MARGIN_LEFT,
          PAGE_HEIGHT - MARGIN_BOTTOM + 10,
          { align: 'center', width: CONTENT_WIDTH }
        );
    };

    // === KOP SEKOLAH ===
    const kopStartY = y;

    if (logoUrl) {
      try {
        doc.image(logoUrl, MARGIN_LEFT, y, { fit: [50, 50], align: 'center' });
      } catch (_) { /* logo unavailable */ }
    }

    const schoolNameX = logoUrl ? MARGIN_LEFT + 65 : MARGIN_LEFT;
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(BLACK)
      .text(escapeHtml(namaSekolah.toUpperCase()), schoolNameX, y + 8, {
        width: CONTENT_WIDTH - (logoUrl ? 65 : 0),
        align: 'center',
      });

    y += 32;
    if (alamat) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(GRAY)
        .text(escapeHtml(alamat), MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
      y += 13;
    }
    if (npsn) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(GRAY)
        .text(`NPSN: ${escapeHtml(npsn)}`, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
      y += 13;
    }

    // Double border
    y += 6;
    doc
      .moveTo(MARGIN_LEFT, y)
      .lineTo(PAGE_WIDTH - MARGIN_RIGHT, y)
      .lineWidth(2)
      .stroke(BORDER);
    y += 4;
    doc
      .moveTo(MARGIN_LEFT, y)
      .lineTo(PAGE_WIDTH - MARGIN_RIGHT, y)
      .lineWidth(1)
      .stroke(BORDER);
    y += 18;

    // === DOCUMENT TITLE ===
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(BLACK)
      .text('LAPORAN KINERJA GURU', MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'center',
      });
    y += 18;
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(DARK)
      .text(`Semester ${semesterLabel} Tahun Pelajaran ${tahunAjaran}`, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH,
        align: 'center',
      });
    y += 16;
    if (predikat) {
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(VIOLET)
        .text(`Predikat: ${escapeHtml(predikat)}`, MARGIN_LEFT, y, {
          width: CONTENT_WIDTH,
          align: 'center',
        });
      y += 16;
    }

    // === IDENTITAS TABLE ===
    y += 4;
    const identitasData: [string, string][] = [
      ['Nama Guru', guruNama],
      ['NIP', guruNip || '-'],
      ['Mata Pelajaran', mataPelajaran],
      ['Kelas', kelas],
      ['Sekolah', sekolah],
      ['Periode', periode],
    ];

    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK).text('A. Identitas Guru', MARGIN_LEFT, y);
    y += 16;

    for (const [label, value] of identitasData) {
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(BLACK)
        .text(`${escapeHtml(label)}:`, MARGIN_LEFT, y, { continued: true });
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(DARK)
        .text(` ${escapeHtml(value)}`);
      y += 16;
    }

    y += 8;

    // === SECTIONS ===
    for (const section of sections) {
      if (!section.content?.trim()) continue;
      checkPageBreak(40);

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(BLACK)
        .text(section.heading, MARGIN_LEFT, y);
      y += 18;

      const lines = section.content.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        checkPageBreak(24);
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor(DARK)
          .text(escapeHtml(line.trim()), MARGIN_LEFT, y, {
            width: CONTENT_WIDTH,
            align: 'justify',
            indent: 30,
          });
        y += 16;
      }
      y += 8;
    }

    // === RINGKASAN ===
    if (ringkasanSingkat?.trim()) {
      checkPageBreak(80);
      y += 4;
      const boxHeight = 60;
      doc
        .rect(MARGIN_LEFT, y, CONTENT_WIDTH, boxHeight)
        .lineWidth(1)
        .stroke(BORDER);
      y += 8;
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(BLACK)
        .text('Ringkasan', MARGIN_LEFT + 8, y, { width: CONTENT_WIDTH - 16 });
      y += 16;
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(DARK)
        .text(escapeHtml(ringkasanSingkat), MARGIN_LEFT + 8, y, {
          width: CONTENT_WIDTH - 16,
          align: 'justify',
        });
      y += boxHeight + 12;
    }

    // === SIGNATURE BLOCK ===
    checkPageBreak(120);
    y += 8;
    const sigDate = formatTanggalIndonesia(tanggal);
    const sigColWidth = CONTENT_WIDTH / 2 - 10;

    // Left: Kepala Sekolah
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(DARK)
      .text(`${escapeHtml(lokasi)}, ${escapeHtml(sigDate)}`, MARGIN_LEFT, y, { width: sigColWidth });
    y += 16;
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(DARK)
      .text('Kepala Sekolah,', MARGIN_LEFT, y, { width: sigColWidth });
    y += 56; // space for signature image

    if (kepalaSignatureUrl) {
      try {
        doc.image(kepalaSignatureUrl, MARGIN_LEFT, y - 56, { fit: [120, 56], align: 'left' });
      } catch (_) { /* unavailable */ }
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(BLACK)
      .text(escapeHtml(kepalaNama || '_____________________'), MARGIN_LEFT, y, {
        width: sigColWidth,
      });
    y += 16;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(GRAY)
      .text(`NIP. ${kepalaNip || '_____________________'}`);
    y -= 56 + 16 + 16; // reset y for right column

    // Right: Guru
    const rightX = MARGIN_LEFT + sigColWidth + 20;
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(DARK)
      .text(`${escapeHtml(lokasi)}, ${escapeHtml(sigDate)}`, rightX, y, { width: sigColWidth });
    y += 16;
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(DARK)
      .text('Guru,', rightX, y, { width: sigColWidth });
    y += 56; // space for signature image

    if (guruSignatureUrl) {
      try {
        doc.image(guruSignatureUrl, rightX, y - 56, { fit: [120, 56], align: 'left' });
      } catch (_) { /* unavailable */ }
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(BLACK)
      .text(escapeHtml(guruNamaTtd || '_____________________'), rightX, y, {
        width: sigColWidth,
      });
    y += 16;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(GRAY)
      .text(`NIP. ${guruNipTtd || '_____________________'}`);

    // Footer
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(GRAY)
      .text(
        `Dicetak pada ${formatTanggalIndonesia(new Date())} | Dokumen ini dihasilkan oleh GuruPRO AI`,
        MARGIN_LEFT,
        PAGE_HEIGHT - MARGIN_BOTTOM + 10,
        { align: 'center', width: CONTENT_WIDTH }
      );

    doc.end();
  });
}
