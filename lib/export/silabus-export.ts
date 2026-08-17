/**
 * Silabus Export Library
 * PDF and DOCX export for Alur Tujuan Pembelajaran (ATP)
 * Landscape orientation for table readability
 *
 * Updated: 14 Juli 2026 - Word-wrap dan auto-height untuk robust rendering
 * Reference: docs/ai-generation-standard.md
 */

import PDFDocument from 'pdfkit';
import type { SilabusOutput } from '@/lib/schemas/silabus';
import { truncateText } from '@/lib/ai/validation-utils';
import {
  BRAND_DISCLAIMER,
  formatTanggalIndonesia,
} from './document-shared';

// ============================================
// PDF EXPORT
// ============================================

export async function generateSilabusPdfBuffer(
  data: SilabusOutput,
  options?: {
    logoUrl?: string | null;
    namaSekolah?: string;
    alamat?: string | null;
    npsn?: string | null;
    kepalaNama?: string;
    kepalaNip?: string | null;
    guruNama?: string;
    guruNip?: string | null;
    guruSignatureUrl?: string | null;
    kepalaSignatureUrl?: string | null;
    lokasi?: string;
    tanggal?: Date;
  }
): Promise<Buffer> {
  const opts = options || {};
  const {
    logoUrl, namaSekolah, alamat, npsn,
    kepalaNama, kepalaNip, guruNama, guruNip,
    guruSignatureUrl, kepalaSignatureUrl, lokasi, tanggal,
  } = opts;

  return new Promise((resolve, reject) => {
    // Use landscape A4
    const doc = new PDFDocument({
      margin: 0,
      size: 'A4',
      layout: 'landscape',
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    // In landscape: page.width > page.height
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    // Standard margins: left 3cm (85pt), right 2cm (57pt), top 2.5cm (71pt), bottom 2cm (57pt)
    const ML = 85;
    const MR = 57;
    const MT = 71;
    const MB = 57;
    const CW = pageWidth - ML - MR;

    const BLACK = '#000000';
    const DARK = '#1F2937';
    const GRAY = '#9CA3AF';
    const primaryColor = '#1E3A8A';
    const headerBg = '#E0E7FF';
    const borderColor = '#334155';

    let y = MT;
    let pageNum = 1;

    const addPageNumber = () => {
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      doc.text(
        `Halaman ${pageNum}`,
        ML,
        pageHeight - MB + 8,
        { align: 'center', width: CW }
      );
      doc.fillColor(BLACK);
    };
    addPageNumber();
    doc.on('pageAdded', () => {
      pageNum++;
      addPageNumber();
    });

    // === KOP SEKOLAH ===
    if (namaSekolah) {
      if (logoUrl) {
        try { doc.image(logoUrl, ML, y, { fit: [40, 40], align: 'center' }); } catch (_) {}
      }
      const nameX = logoUrl ? ML + 50 : ML;
      doc.font('Helvetica-Bold').fontSize(13).fillColor(BLACK);
      doc.text(namaSekolah.toUpperCase(), nameX, y + 5, {
        width: CW - (logoUrl ? 50 : 0), align: 'center',
      });
      y += 22;
      if (alamat) {
        doc.font('Helvetica').fontSize(8).fillColor(GRAY);
        doc.text(alamat, ML, y, { width: CW, align: 'center' });
        y += 12;
      }
      if (npsn) {
        doc.font('Helvetica').fontSize(8).fillColor(GRAY);
        doc.text(`NPSN: ${npsn}`, ML, y, { width: CW, align: 'center' });
        y += 12;
      }
      y += 4;
      doc.moveTo(ML, y).lineTo(pageWidth - MR, y).lineWidth(2).stroke(borderColor);
      y += 3;
      doc.moveTo(ML, y).lineTo(pageWidth - MR, y).lineWidth(1).stroke(borderColor);
      y += 14;
    }

    // Header
    doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor).text(
      'ALUR TUJUAN PEMBELAJARAN (ATP)',
      ML, y,
      { align: 'center', width: CW }
    );
    y += 16;

    // Subtitle
    doc.font('Helvetica').fontSize(9).fillColor('#4B5563').text(
      `${data.identitas.mataPelajaran} | Fase ${data.identitas.fase} | Semester ${data.identitas.semester === 1 ? 'Ganjil' : 'Genap'}`,
      ML, y,
      { align: 'center', width: CW }
    );
    y += 16;

    // Identitas Box
    doc.rect(ML, y, CW, 30).stroke(borderColor);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor);
    doc.text('Mata Pelajaran:', ML + 5, y + 4);
    doc.text('Fase:', ML + 5, y + 16);
    doc.font('Helvetica').fillColor(DARK);
    doc.text(data.identitas.mataPelajaran, ML + 90, y + 4);
    doc.text(data.identitas.fase, ML + 90, y + 16);

    doc.font('Helvetica-Bold').fillColor(primaryColor);
    doc.text('Semester:', ML + 300, y + 4);
    doc.text('Tahun Ajaran:', ML + 300, y + 16);
    doc.font('Helvetica').fillColor(DARK);
    doc.text(data.identitas.semester === 1 ? 'Ganjil' : 'Genap', ML + 370, y + 4);
    doc.text(data.identitas.tahunAjaran || '-', ML + 370, y + 16);
    y += 34;

    // Capaian Pembelajaran Section
    doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text(
      'CAPAIAN PEMBELAJARAN (CP)',
      ML, y
    );
    y += 12;
    doc.font('Helvetica').fontSize(8).fillColor('#374151');
    doc.text(data.capaianPembelajaran, ML, y, { width: CW });
    y += 14;

    // Table Header
    const tableY = y;

    // Table column widths
    const colWidths = {
      no: 35,
      topik: 120,
      tujuan: 240,
      dimensi: 100,
      pertemuan: 45,
      minggu: 40,
    };
      doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF');
      doc.text(
        `Halaman ${pageNum}`,
        40,
        pageHeight - 25,
        { align: 'center', width: contentWidth }
      );
      doc.fillColor('#000');
    };
    addPageNumber();
    doc.on('pageAdded', () => {
      pageNum++;
      addPageNumber();
    });

    // Colors
    const primaryColor = '#1E3A8A';
    const headerBg = '#E0E7FF';
    const borderColor = '#334155';

    // Header
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text(
      'ALUR TUJUAN PEMBELAJARAN (ATP)',
      0,
      30,
      { align: 'center', width: pageWidth }
    );

    // Subtitle
    doc.font('Helvetica').fontSize(10).fillColor('#4B5563').text(
      `${data.identitas.mataPelajaran} | Fase ${data.identitas.fase} | Semester ${data.identitas.semester === 1 ? 'Ganjil' : 'Genap'}`,
      0,
      48,
      { align: 'center', width: pageWidth }
    );

    // Identitas Box
    const identitasY = 65;
    doc.rect(40, identitasY, contentWidth, 35).stroke(borderColor);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor);
    const identitasLeft = 45;
    const identitasRight = 400;

    doc.text('Mata Pelajaran:', identitasLeft, identitasY + 5);
    doc.text('Fase:', identitasLeft, identitasY + 17);
    doc.text('Kelas:', identitasLeft, identitasY + 29);

    doc.font('Helvetica').fillColor('#1F2937');
    doc.text(data.identitas.mataPelajaran, identitasLeft + 80, identitasY + 5);
    doc.text(data.identitas.fase, identitasLeft + 80, identitasY + 17);
    doc.text(data.identitas.kelas, identitasLeft + 80, identitasY + 29);

    doc.font('Helvetica-Bold').fillColor(primaryColor);
    doc.text('Semester:', identitasRight, identitasY + 5);
    doc.text('Tahun Ajaran:', identitasRight, identitasY + 17);

    doc.font('Helvetica').fillColor('#1F2937');
    doc.text(data.identitas.semester === 1 ? 'Ganjil' : 'Genap', identitasRight + 75, identitasY + 5);
    doc.text(data.identitas.tahunAjaran || '-', identitasRight + 75, identitasY + 17);

    // Capaian Pembelajaran Section
    const cpY = 110;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text(
      'CAPAIAN PEMBELAJARAN (CP)',
      40,
      cpY
    );

    doc.font('Helvetica').fontSize(8).fillColor('#374151');
    const cpText = data.capaianPembelajaran;
    const cpLines = doc.text(cpText, 40, cpY + 12, {
      width: contentWidth,
      lineGap: 2,
    }) as unknown as number;

    // Table Header
    const tableY = cpY + 40 + ((cpLines as number) > 1 ? 10 : 0);

    // Table column widths
    const colWidths = {
      no: 35,
      topik: 150,
      tujuan: 280,
      dimensi: 100,
      pertemuan: 55,
      minggu: 45,
    };

    // Helper: Calculate text height with word-wrap
    const calculateTextHeight = (text: string, maxWidth: number, fontSize: number = 7): number => {
      const charsPerLine = Math.floor(maxWidth / (fontSize * 0.5));
      const lines = Math.ceil(text.length / charsPerLine);
      return Math.max(lines * (fontSize + 2), 20);
    };

    // Draw header row
    doc.rect(ML, tableY, CW, 20).fill(headerBg);

    let xPos = ML;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(primaryColor);

    doc.text('No', xPos + 2, tableY + 6, { width: colWidths.no, align: 'center' });
    xPos += colWidths.no;

    doc.text('Topik / Unit', xPos + 2, tableY + 6, { width: colWidths.topik });
    xPos += colWidths.topik;

    doc.text('Tujuan Pembelajaran', xPos + 2, tableY + 6, { width: colWidths.tujuan });
    xPos += colWidths.tujuan;

    doc.text('Dimensi Profil', xPos + 2, tableY + 6, { width: colWidths.dimensi });
    xPos += colWidths.dimensi;

    doc.text('Est. Pert.', xPos + 2, tableY + 6, { width: colWidths.pertemuan, align: 'center' });
    xPos += colWidths.pertemuan;

    doc.text('Est. Mg', xPos + 2, tableY + 6, { width: colWidths.minggu, align: 'center' });

    // Table rows
    let rowY = tableY + 20;

    data.alurTujuanPembelajaran.forEach((unit, idx) => {
      const isEven = idx % 2 === 0;
      const rowHeight = 35;

      // Check if we need a new page
      if (rowY + rowHeight > pageHeight - MB) {
        doc.addPage({ layout: 'landscape', margin: 0 });
        rowY = MT;

        // Re-draw header on new page
        doc.rect(ML, rowY, CW, 20).fill(headerBg);
        xPos = ML;
        doc.font('Helvetica-Bold').fontSize(7).fillColor(primaryColor);
        doc.text('No', xPos + 2, rowY + 6, { width: colWidths.no, align: 'center' });
        xPos += colWidths.no;
        doc.text('Topik / Unit', xPos + 2, rowY + 6, { width: colWidths.topik });
        xPos += colWidths.topik;
        doc.text('Tujuan Pembelajaran', xPos + 2, rowY + 6, { width: colWidths.tujuan });
        xPos += colWidths.tujuan;
        doc.text('Dimensi Profil', xPos + 2, rowY + 6, { width: colWidths.dimensi });
        xPos += colWidths.dimensi;
        doc.text('Est. Pert.', xPos + 2, rowY + 6, { width: colWidths.pertemuan, align: 'center' });
        xPos += colWidths.pertemuan;
        doc.text('Est. Mg', xPos + 2, rowY + 6, { width: colWidths.minggu, align: 'center' });

        rowY += 20;
      }

      // Row background
      if (isEven) {
        doc.rect(ML, rowY, CW, rowHeight).fill('#F9FAFB');
      }
      doc.rect(ML, rowY, CW, rowHeight).stroke(borderColor);

      xPos = ML;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(primaryColor).text(
        String(unit.unitKe),
        xPos,
        rowY + 14,
        { width: colWidths.no, align: 'center' }
      );
      xPos += colWidths.no;

      // Topik
      const safeTopik = truncateText(unit.topik, 80);
      doc.font('Helvetica').fontSize(7).fillColor('#1F2937').text(
        safeTopik,
        xPos + 2,
        rowY + 5,
        { width: colWidths.topik - 4, lineGap: 1, ellipsis: true }
      );
      xPos += colWidths.topik;

      // Tujuan pembelajaran
      const tpText = truncateText(unit.tujuanPembelajaran.slice(0, 2).join('; '), 300);
      doc.font('Helvetica').fontSize(6.5).fillColor('#374151').text(
        tpText,
        xPos + 2,
        rowY + 3,
        { width: colWidths.tujuan - 4, lineGap: 1, ellipsis: true }
      );
      xPos += colWidths.tujuan;

      // Dimensi
      const dimensiText = truncateText(unit.dimensiProfilLulusanTerhubung.slice(0, 2).join(', '), 100);
      doc.font('Helvetica').fontSize(6.5).fillColor('#4B5563').text(
        dimensiText,
        xPos + 2,
        rowY + 12,
        { width: colWidths.dimensi - 4, ellipsis: true }
      );
      xPos += colWidths.dimensi;

      // Estimasi
      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor).text(
        String(unit.estimasiPertemuan),
        xPos,
        rowY + 14,
        { width: colWidths.pertemuan, align: 'center' }
      );
      xPos += colWidths.pertemuan;

      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor).text(
        String(unit.estimasiMinggu),
        xPos,
        rowY + 14,
        { width: colWidths.minggu, align: 'center' }
      );

      rowY += rowHeight;
    });

    rowY += 8;

    // Total row
    doc.rect(ML, rowY, CW, 20).fill(headerBg);
    doc.rect(ML, rowY, CW, 20).stroke(borderColor);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor);
    doc.text('TOTAL', ML + 2, rowY + 6);

    let totalX = ML + colWidths.no + colWidths.topik + colWidths.tujuan + 5;
    doc.text(
      `Total: ${data.alurTujuanPembelajaran.length} Unit`,
      totalX,
      rowY + 6,
      { width: colWidths.dimensi - 5 }
    );
    totalX += colWidths.dimensi;

    doc.text(
      String(data.totalEstimasi.totalPertemuan),
      totalX,
      rowY + 6,
      { width: colWidths.pertemuan, align: 'center' }
    );
    totalX += colWidths.pertemuan;

    doc.text(
      String(data.totalEstimasi.totalMinggu),
      totalX,
      rowY + 6,
      { width: colWidths.minggu, align: 'center' }
    );

    // === SIGNATURE BLOCK ===
    if (kepalaNama || guruNama) {
      rowY += 30;
      const sigColW = CW / 2 - 10;
      const sigDate = tanggal
        ? new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      // Left: Kepala Sekolah
      doc.font('Helvetica').fontSize(9).fillColor(BLACK);
      doc.text(`${lokasi || ''}, ${sigDate}`, ML, rowY, { width: sigColW });
      rowY += 14;
      doc.text("Kepala Sekolah,", ML, rowY, { width: sigColW });
      rowY += 44;
      if (kepalaSignatureUrl) {
        try { doc.image(kepalaSignatureUrl, ML, rowY - 44, { fit: [100, 44], align: 'left' }); } catch (_) {}
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
      doc.text(kepalaNama || '_____________________', ML, rowY, { width: sigColW });
      rowY += 12;
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      doc.text(`NIP. ${kepalaNip || '_____________________'}`);
      rowY -= 44 + 14 + 12;

      // Right: Guru
      const rx = ML + sigColW + 20;
      doc.font('Helvetica').fontSize(9).fillColor(BLACK);
      doc.text(`${lokasi || ''}, ${sigDate}`, rx, rowY, { width: sigColW });
      rowY += 14;
      doc.text("Guru,", rx, rowY, { width: sigColW });
      rowY += 44;
      if (guruSignatureUrl) {
        try { doc.image(guruSignatureUrl, rx, rowY - 44, { fit: [100, 44], align: 'left' }); } catch (_) {}
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
      doc.text(guruNama || '_____________________', rx, rowY, { width: sigColW });
      rowY += 12;
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      doc.text(`NIP. ${guruNip || '_____________________'}`);
    }

    doc.end();
  });
}

// ============================================
// DOCX EXPORT
// ============================================

export async function generateSilabusDocBuffer(
  data: SilabusOutput,
  options?: {
    logoUrl?: string | null;
    namaSekolah?: string;
    alamat?: string | null;
    npsn?: string | null;
    kepalaNama?: string;
    kepalaNip?: string | null;
    guruNama?: string;
    guruNip?: string | null;
    guruSignatureUrl?: string | null;
    kepalaSignatureUrl?: string | null;
    lokasi?: string;
    tanggal?: Date;
  }
): Promise<Buffer> {
  const opts = options || {};
  const {
    logoUrl, namaSekolah, alamat, npsn,
    kepalaNama, kepalaNip, guruNama, guruNip,
    guruSignatureUrl, kepalaSignatureUrl, lokasi, tanggal,
  } = opts;

  // Kop sekolah HTML
  const kopHtml = namaSekolah ? (() => {
    const logoSection = logoUrl
      ? `<td style="width:60px;text-align:center;vertical-align:middle;"><img src="${logoUrl}" alt="Logo" style="max-height:60px;max-width:60px;object-fit:contain;" /></td>`
      : `<td style="width:60px;"></td>`;
    const alamatLine = alamat ? `<p style="margin:2px 0;font-size:9pt;color:#555;">${alamat}</p>` : '';
    const npsnLine = npsn ? `<p style="margin:2px 0;font-size:9pt;">NPSN: ${npsn}</p>` : '';
    return `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>${logoSection}
        <td style="text-align:center;vertical-align:middle;">
          <h1 style="margin:0;font-size:15pt;font-weight:bold;color:#000;text-transform:uppercase;">${namaSekolah}</h1>
          ${alamatLine}${npsnLine}
        </td>
        <td style="width:60px;"></td>
      </tr>
    </table>
    <div style="border-bottom:2px solid #000;margin-bottom:16px;"></div>`;
  })() : '';

  // Signature block HTML
  const sigDate = tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const tempatLine = lokasi || '';
  const kepalaSigImg = kepalaSignatureUrl
    ? `<img src="${kepalaSignatureUrl}" alt="Tanda Tangan" style="height:60px;width:auto;object-fit:contain;display:block;margin:0 auto;" />`
    : `<div style="height:60px;"></div>`;
  const guruSigImg = guruSignatureUrl
    ? `<img src="${guruSignatureUrl}" alt="Tanda Tangan" style="height:60px;width:auto;object-fit:contain;display:block;margin:0 auto;" />`
    : `<div style="height:60px;"></div>`;

  const signatureHtml = (kepalaNama || guruNama) ? `
  <div style="margin-top:40px;page-break-inside:avoid;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="text-align:center;width:45%;">
        <p style="margin:0 0 4px;font-size:11pt;">${tempatLine}, ${sigDate}</p>
        <p style="margin:0 0 4px;font-size:11pt;">Kepala Sekolah,</p>
        <div style="height:8px;"></div>
        ${kepalaSigImg}
        <div style="height:4px;"></div>
        <p style="margin:0;font-size:11pt;text-decoration:underline;font-weight:bold;">${kepalaNama || '_____________________'}</p>
        <p style="margin:4px 0 0;font-size:10pt;">NIP. ${kepalaNip || '_____________________'}</p>
      </div>
      <div style="text-align:center;width:45%;">
        <p style="margin:0 0 4px;font-size:11pt;">${tempatLine}, ${sigDate}</p>
        <p style="margin:0 0 4px;font-size:11pt;">Guru,</p>
        <div style="height:8px;"></div>
        ${guruSigImg}
        <div style="height:4px;"></div>
        <p style="margin:0;font-size:11pt;text-decoration:underline;font-weight:bold;">${guruNama || '_____________________'}</p>
        <p style="margin:4px 0 0;font-size:10pt;">NIP. ${guruNip || '_____________________'}</p>
      </div>
    </div>
  </div>` : '';

  // Build HTML for Word
  let html = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>Silabus ${data.identitas.mataPelajaran}</title>
  <style>
    @page {
      size: landscape;
      margin: 2.5cm 2cm 2cm 3cm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      margin: 0;
      padding: 0;
    }
    .header {
      text-align: center;
      margin-bottom: 10px;
    }
    .header h1 {
      font-size: 16pt;
      color: #1E3A8A;
      margin: 0 0 5px 0;
    }
    .header p {
      font-size: 9pt;
      color: #6B7280;
      margin: 0;
    }
    .identitas {
      border: 1px solid #334155;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 9pt;
    }
    .identitas-table {
      width: 100%;
    }
    .identitas-table td {
      padding: 2px 0;
      vertical-align: top;
    }
    .identitas-label {
      font-weight: bold;
      color: #1E3A8A;
      width: 100px;
    }
    .cp-section {
      margin-bottom: 12px;
    }
    .cp-title {
      font-weight: bold;
      color: #1E3A8A;
      font-size: 10pt;
      margin-bottom: 4px;
    }
    .cp-content {
      font-size: 9pt;
      color: #374151;
      line-height: 1.4;
    }
    .table-container {
      width: 100%;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 12px;
    }
    th {
      background-color: #E0E7FF;
      color: #1E3A8A;
      font-weight: bold;
      text-align: left;
      padding: 6px 4px;
      border: 1px solid #334155;
    }
    td {
      padding: 8px 4px;
      border: 1px solid #334155;
      vertical-align: top;
      /* Word-wrap for long text - ROBUST RENDERING */
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: normal;
      word-break: break-word;
    }
    tr:nth-child(even) {
      background-color: #F9FAFB;
    }
    .col-no { width: 4%; text-align: center; }
    .col-topik { width: 18%; }
    .col-tp { width: 35%; }
    .col-dimensi { width: 13%; font-size: 7pt; }
    .col-pert { width: 5%; text-align: center; }
    .col-minggu { width: 5%; text-align: center; }
    /* Add ellipsis for truncated text */
    .truncate {
      max-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .total-row {
      background-color: #E0E7FF !important;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      font-size: 7pt;
      color: #9CA3AF;
      margin-top: 15px;
    }
    .page-footer {
      position: fixed;
      bottom: 1.5cm;
      left: 0;
      right: 0;
      text-align: right;
      font-size: 9pt;
      color: #666;
    }
    @media print {
      .page-footer { display: block; }
    }
  </style>
</head>
<body>
  ${kopHtml}
  <div class="header">
    <h1>ALUR TUJUAN PEMBELAJARAN (ATP)</h1>
    <p>${data.identitas.mataPelajaran} | Fase ${data.identitas.fase} | Semester ${data.identitas.semester === 1 ? 'Ganjil' : 'Genap'}</p>
  </div>

  <div class="identitas">
    <table class="identitas-table">
      <tr>
        <td class="identitas-label">Mata Pelajaran</td>
        <td>: ${data.identitas.mataPelajaran}</td>
        <td class="identitas-label">Semester</td>
        <td>: ${data.identitas.semester === 1 ? 'Ganjil' : 'Genap'}</td>
      </tr>
      <tr>
        <td class="identitas-label">Fase</td>
        <td>: ${data.identitas.fase}</td>
        <td class="identitas-label">Tahun Ajaran</td>
        <td>: ${data.identitas.tahunAjaran || '-'}</td>
      </tr>
      <tr>
        <td class="identitas-label">Kelas</td>
        <td>: ${data.identitas.kelas}</td>
        <td></td>
        <td></td>
      </tr>
    </table>
  </div>

  <div class="cp-section">
    <div class="cp-title">CAPAIAN PEMBELAJARAN (CP)</div>
    <div class="cp-content">${data.capaianPembelajaran}</div>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th class="col-no">No</th>
          <th class="col-topik">Topik / Unit</th>
          <th class="col-tp">Tujuan Pembelajaran</th>
          <th class="col-dimensi">Dimensi Profil Lulusan</th>
          <th class="col-pert">Est. Pert.</th>
          <th class="col-minggu">Est. Mg</th>
        </tr>
      </thead>
      <tbody>
`;

  // Add rows
  data.alurTujuanPembelajaran.forEach((unit) => {
    const tpList = unit.tujuanPembelajaran.map((tp) => `<li>${tp}</li>`).join('');
    const dimensiText = unit.dimensiProfilLulusanTerhubung.join(', ');

    html += `
        <tr>
          <td class="col-no">${unit.unitKe}</td>
          <td class="col-topik">${unit.topik}</td>
          <td class="col-tp">
            <ul style="margin: 0; padding-left: 15px;">
              ${tpList}
            </ul>
          </td>
          <td class="col-dimensi">${dimensiText}</td>
          <td class="col-pert">${unit.estimasiPertemuan}</td>
          <td class="col-minggu">${unit.estimasiMinggu}</td>
        </tr>
    `;
  });

  // Total row
  html += `
        <tr class="total-row">
          <td class="col-no"></td>
          <td colspan="2">TOTAL (${data.alurTujuanPembelajaran.length} Unit)</td>
          <td class="col-dimensi"></td>
          <td class="col-pert">${data.totalEstimasi.totalPertemuan}</td>
          <td class="col-minggu">${data.totalEstimasi.totalMinggu}</td>
        </tr>
  `;

  html += `
      </tbody>
    </table>
  </div>

  ${signatureHtml}

  <div class="footer">
    ${BRAND_DISCLAIMER} | ${formatTanggalIndonesia(new Date())}
  </div>
<div class="page-footer">Halaman <span style="mso-field-code:' PAGE \\* MERGEFORMAT '"></span> dari <span style="mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span></div>
</body>
</html>
  `;

  return Buffer.from(html, 'utf-8');
}
