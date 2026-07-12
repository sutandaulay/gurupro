/**
 * Silabus Export Library
 * PDF and DOCX export for Alur Tujuan Pembelajaran (ATP)
 * Landscape orientation for table readability
 */

import PDFDocument from 'pdfkit';
import type { SilabusOutput } from '@/lib/schemas/silabus';

// ============================================
// PDF EXPORT
// ============================================

export async function generateSilabusPdfBuffer(data: SilabusOutput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Use landscape A4
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      layout: 'landscape',
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 80;

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
    const colWidths = {
      no: 35,
      topik: 150,
      tujuan: 280,
      dimensi: 100,
      pertemuan: 55,
      minggu: 45,
    };

    // Draw header row
    doc.rect(40, tableY, contentWidth, 20).fill(headerBg);

    let xPos = 40;
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
    let rowIndex = 0;

    data.alurTujuanPembelajaran.forEach((unit, idx) => {
      const isEven = idx % 2 === 0;
      const rowHeight = 35;

      // Check if we need a new page
      if (rowY + rowHeight > pageHeight - 40) {
        doc.addPage({ layout: 'landscape', margin: 40 });
        rowY = 40;

        // Re-draw header on new page
        doc.rect(40, rowY, contentWidth, 20).fill(headerBg);
        xPos = 40;
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
        doc.rect(40, rowY, contentWidth, rowHeight).fill('#F9FAFB');
      }
      doc.rect(40, rowY, contentWidth, rowHeight).stroke(borderColor);

      xPos = 40;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(primaryColor).text(
        String(unit.unitKe),
        xPos,
        rowY + 14,
        { width: colWidths.no, align: 'center' }
      );
      xPos += colWidths.no;

      doc.font('Helvetica').fontSize(7).fillColor('#1F2937').text(
        unit.topik,
        xPos + 2,
        rowY + 5,
        { width: colWidths.topik - 4, lineGap: 1 }
      );
      xPos += colWidths.topik;

      // Tujuan pembelajaran (multiple lines)
      const tpText = unit.tujuanPembelajaran.slice(0, 2).join('; ');
      doc.font('Helvetica').fontSize(6.5).fillColor('#374151').text(
        tpText,
        xPos + 2,
        rowY + 3,
        { width: colWidths.tujuan - 4, lineGap: 1 }
      );
      xPos += colWidths.tujuan;

      // Dimensi
      const dimensiText = unit.dimensiProfilLulusanTerhubung.slice(0, 2).join(', ');
      doc.font('Helvetica').fontSize(6.5).fillColor('#4B5563').text(
        dimensiText,
        xPos + 2,
        rowY + 12,
        { width: colWidths.dimensi - 4 }
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
      rowIndex++;
    });

    // Total row
    const totalY = rowY;
    doc.rect(40, totalY, contentWidth, 20).fill(headerBg);
    doc.rect(40, totalY, contentWidth, 20).stroke(borderColor);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor);
    doc.text('TOTAL', 42, totalY + 6);

    // Skip topik and tujuan columns
    let totalX = 40 + colWidths.no + colWidths.topik + colWidths.tujuan;
    doc.text(
      `Total: ${data.alurTujuanPembelajaran.length} Unit`,
      totalX + 5,
      totalY + 6,
      { width: colWidths.dimensi - 5 }
    );
    totalX += colWidths.dimensi;

    doc.text(
      String(data.totalEstimasi.totalPertemuan),
      totalX,
      totalY + 6,
      { width: colWidths.pertemuan, align: 'center' }
    );
    totalX += colWidths.pertemuan;

    doc.text(
      String(data.totalEstimasi.totalMinggu),
      totalX,
      totalY + 6,
      { width: colWidths.minggu, align: 'center' }
    );

    // Footer
    doc.fontSize(6).fillColor('#9CA3AF');
    doc.text(
      `Dokumen ini digenerate oleh GuruPRO AI | ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      40,
      pageHeight - 25,
      { align: 'center', width: contentWidth }
    );

    doc.end();
  });
}

// ============================================
// DOCX EXPORT
// ============================================

export async function generateSilabusDocBuffer(data: SilabusOutput): Promise<Buffer> {
  const pageWidth = 842; // A4 Landscape width in points
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

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
      margin: 1in;
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
  </style>
</head>
<body>
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

  <div class="footer">
    Dokumen ini digenerate oleh GuruPRO AI | ${new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}
  </div>
</body>
</html>
  `;

  return Buffer.from(html, 'utf-8');
}
