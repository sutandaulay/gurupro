import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const STATUS_LABELS: Record<string, string> = {
  hadir: 'Hadir',
  sakit: 'Sakit',
  izin: 'Izin',
  alpa: 'Alpa',
};

const STATUS_COLORS: Record<string, string> = {
  hadir: '#10b981',
  sakit: '#3b82f6',
  izin: '#8b5cf6',
  alpa: '#ef4444',
};

export interface StudentAttendanceRecord {
  id: string;
  namaSiswa: string;
  nisn?: string | null;
  nomorAbsen?: number | null;
  status: string;
  catatan?: string | null;
  tanggal: string | Date;
}

export interface StudentAttendanceReportData {
  schoolName: string;
  schoolAddress?: string | null;
  schoolNpsn?: string | null;
  schoolLogo?: string | null;
  kelas: string;
  mapel?: string;
  guruPengampu: string;
  guruNip?: string | null;
  tanggal: string;
  periodeLabel: string;
  records: StudentAttendanceRecord[];
  summary: {
    total: number;
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
    tingkatKehadiran: number;
  };
  kepalaNama?: string | null;
  kepalaNip?: string | null;
  kepalaSignatureUrl?: string | null;
  guruSignatureUrl?: string | null;
}

/**
 * Generate PDF buffer for student attendance report
 */
export async function generateStudentAttendancePdfBuffer(
  data: StudentAttendanceReportData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const PAGE_WIDTH = doc.page.width as number;
    const PAGE_HEIGHT = doc.page.height as number;
    const ML = 57;   // 2cm
    const MR = 57;   // 2cm
    const MT = 71;   // 2.5cm
    const MB = 57;   // 2cm
    const CW = PAGE_WIDTH - ML - MR;

    const BLACK = '#000000';
    const GRAY = '#6B7280';
    const BORDER = '#374151';

    let y = MT;
    let pageNum = 1;

    const checkPageBreak = (needed: number) => {
      if (y + needed > PAGE_HEIGHT - MB) {
        doc.addPage();
        y = MT;
        pageNum++;
      }
    };

    const addPageNumber = () => {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY);
      doc.text(`Halaman ${pageNum}`, ML, PAGE_HEIGHT - MB + 10, {
        align: 'center',
        width: CW,
      });
      doc.fillColor(BLACK);
    };
    addPageNumber();
    // @ts-ignore
    doc.on('pageAdded', () => {
      pageNum++;
      addPageNumber();
    });

    // === KOP SEKOLAH ===
    if (data.schoolName) {
      if (data.schoolLogo) {
        try {
          doc.image(data.schoolLogo, ML, y, { fit: [50, 50], align: 'center' });
        } catch (_) {}
      }
      const nameX = data.schoolLogo ? ML + 65 : ML;
      doc.font('Helvetica-Bold').fontSize(15).fillColor(BLACK);
      doc.text(data.schoolName.toUpperCase(), nameX, y + 8, {
        width: CW - (data.schoolLogo ? 65 : 0),
        align: 'center',
      });
      y += 28;
      if (data.schoolAddress) {
        doc.font('Helvetica').fontSize(9).fillColor(GRAY);
        doc.text(data.schoolAddress, ML, y, { width: CW, align: 'center' });
        y += 13;
      }
      if (data.schoolNpsn) {
        doc.font('Helvetica').fontSize(9).fillColor(GRAY);
        doc.text(`NPSN: ${data.schoolNpsn}`, ML, y, { width: CW, align: 'center' });
        y += 13;
      }
      y += 6;
      doc.moveTo(ML, y).lineTo(PAGE_WIDTH - MR, y).lineWidth(2).stroke(BORDER);
      y += 4;
      doc.moveTo(ML, y).lineTo(PAGE_WIDTH - MR, y).lineWidth(1).stroke(BORDER);
      y += 18;
    }

    // Title
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BLACK);
    doc.text('LAPORAN PRESENSI HARIAN SISWA', ML, y, { width: CW, align: 'center' });
    y += 18;

    // Info bar
    const infoFont = 'Helvetica';
    const infoSize = 10;
    const labelWidth = 100;
    const valueWidth = CW / 2 - labelWidth - 5;
    const col1X = ML;
    const col2X = ML + CW / 2;

    const drawLabel = (label: string, x: number, yPos: number) => {
      doc.font('Helvetica-Bold').fontSize(infoSize).fillColor(BLACK);
      doc.text(label, x, yPos, { width: labelWidth });
    };
    const drawValue = (value: string, x: number, yPos: number) => {
      doc.font(infoFont).fontSize(infoSize).fillColor(BLACK);
      doc.text(value, x, yPos, { width: valueWidth });
    };

    drawLabel('Kelas', col1X, y);
    drawValue(data.kelas, col1X + labelWidth, y);
    drawLabel('Mata Pelajaran', col2X, y);
    drawValue(data.mapel || '-', col2X + labelWidth, y);
    y += 14;

    drawLabel('Tanggal', col1X, y);
    drawValue(data.tanggal, col1X + labelWidth, y);
    drawLabel('Guru Pengampu', col2X, y);
    drawValue(`${data.guruPengampu}${data.guruNip ? `, NIP. ${data.guruNip}` : ''}`, col2X + labelWidth, y);
    y += 20;

    // Summary box
    checkPageBreak(40);
    doc.rect(ML, y, CW, 30).fill('#EFF6FF');
    doc.rect(ML, y, CW, 30).stroke(BORDER);
    const summaryItems = [
      `Total Siswa: ${data.summary.total}`,
      `Hadir: ${data.summary.hadir}`,
      `Sakit: ${data.summary.sakit}`,
      `Izin: ${data.summary.izin}`,
      `Alpa: ${data.summary.alpa}`,
      `Tingkat Kehadiran: ${data.summary.tingkatKehadiran}%`,
    ];
    doc.font('Helvetica').fontSize(9).fillColor(BLACK);
    const summaryText = summaryItems.join('    ');
    doc.text(summaryText, ML + 8, y + 10, { width: CW - 16 });
    y += 40;

    // Table
    const noW = 30;
    const absW = 40;
    const namaW = 150;
    const nisnW = 70;
    const statusW = 55;
    const catW = CW - noW - absW - namaW - nisnW - statusW;
    const rowH = 18;

    // Header
    checkPageBreak(rowH + 20);
    const headers = [
      { label: 'No', w: noW },
      { label: 'No.\nAbsen', w: absW },
      { label: 'Nama Siswa', w: namaW },
      { label: 'NISN', w: nisnW },
      { label: 'Status', w: statusW },
      { label: 'Catatan', w: catW },
    ];

    let xPos = ML;
    headers.forEach((h) => {
      doc.rect(xPos, y, h.w, rowH).fill(BORDER);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('white');
      doc.text(h.label, xPos + 2, y + 2, { width: h.w - 4, align: 'center' });
      xPos += h.w;
    });
    y += rowH;

    // Rows
    data.records.forEach((rec, idx) => {
      checkPageBreak(rowH);
      const bgColor = idx % 2 === 0 ? 'white' : '#F9FAFB';
      const statusColor = STATUS_COLORS[rec.status] || BLACK;

      xPos = ML;
      const cells = [
        { text: String(idx + 1), w: noW, align: 'center' as const },
        { text: rec.nomorAbsen != null ? String(rec.nomorAbsen) : '-', w: absW, align: 'center' as const },
        { text: rec.namaSiswa, w: namaW, align: 'left' as const },
        { text: rec.nisn || '-', w: nisnW, align: 'center' as const },
        { text: STATUS_LABELS[rec.status] || rec.status, w: statusW, align: 'center' as const },
        { text: rec.catatan || '-', w: catW, align: 'left' as const },
      ];

      cells.forEach((cell) => {
        doc.rect(xPos, y, cell.w, rowH).fill(bgColor).stroke(BORDER);
        if (cell.text === STATUS_LABELS[rec.status] || (rec.status && STATUS_LABELS[rec.status])) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(statusColor);
          doc.text(cell.text, xPos + 2, y + 5, { width: cell.w - 4, align: cell.align });
          doc.fillColor(BLACK);
        } else {
          doc.font('Helvetica').fontSize(8).fillColor(BLACK);
          doc.text(cell.text, xPos + 2, y + 5, { width: cell.w - 4, align: cell.align });
        }
        xPos += cell.w;
      });
      y += rowH;
    });

    y += 8;

    // === SIGNATURE BLOCK ===
    if (data.kepalaNama || data.guruPengampu) {
      checkPageBreak(80);
      const sigColW = CW / 2 - 10;

      doc.font('Helvetica').fontSize(10).fillColor(BLACK);
      doc.text(data.schoolName || '', ML, y, { width: sigColW });
      y += 14;
      doc.text(`Tanggal: ${data.tanggal}`, ML, y, { width: sigColW });
      y += 16;

      doc.text('Kepala Sekolah,', ML, y, { width: sigColW });
      y += 44;
      if (data.kepalaSignatureUrl) {
        try { doc.image(data.kepalaSignatureUrl, ML, y - 44, { fit: [120, 44] }); } catch (_) {}
      }
      doc.font('Helvetica-Bold').fontSize(10).fillColor(BLACK);
      doc.text(data.kepalaNama || '_____________________', ML, y, { width: sigColW });
      y += 14;
      doc.font('Helvetica').fontSize(9).fillColor(GRAY);
      doc.text(`NIP. ${data.kepalaNip || '_____________________'}`);
      y -= 44 + 16 + 14;

      const rx = ML + sigColW + 20;
      doc.font('Helvetica').fontSize(10).fillColor(BLACK);
      doc.text(data.schoolName || '', rx, y, { width: sigColW });
      y += 14;
      doc.text(`Tanggal: ${data.tanggal}`, rx, y, { width: sigColW });
      y += 16;
      doc.text('Guru Pengampu,', rx, y, { width: sigColW });
      y += 44;
      if (data.guruSignatureUrl) {
        try { doc.image(data.guruSignatureUrl, rx, y - 44, { fit: [120, 44] }); } catch (_) {}
      }
      doc.font('Helvetica-Bold').fontSize(10).fillColor(BLACK);
      doc.text(data.guruPengampu, rx, y, { width: sigColW });
      y += 14;
      doc.font('Helvetica').fontSize(9).fillColor(GRAY);
      doc.text(`NIP. ${data.guruNip || '_____________________'}`);
    }

    doc.font('Helvetica').fontSize(8).fillColor(GRAY);
    doc.text('Dokumen ini dihasilkan oleh GuruPRO AI', ML, PAGE_HEIGHT - MB + 10, {
      align: 'center',
      width: CW,
    });

    doc.end();
  });
}

/**
 * Generate DOCX buffer for student attendance report
 */
export function generateStudentAttendanceDocBuffer(
  data: StudentAttendanceReportData
): Buffer {
  const sigDate = data.tanggal;

  const kopHtml = data.schoolName ? (() => {
    const logoImg = data.schoolLogo
      ? `<img src="${data.schoolLogo}" width="50" height="50" style="vertical-align: middle; margin-right: 8px;" />`
      : '';
    const addrLine = data.schoolAddress ? `<p style="margin:2px 0;font-size:9pt;color:#666;">${data.schoolAddress}</p>` : '';
    const npsnLine = data.schoolNpsn ? `<p style="margin:2px 0;font-size:9pt;color:#666;">NPSN: ${data.schoolNpsn}</p>` : '';
    return `<div style="text-align:center;margin-bottom:4pt;">
      ${logoImg}
      <div style="font-size:15pt;font-weight:bold;">${data.schoolName.toUpperCase()}</div>
      ${addrLine}${npsnLine}
    </div>
    <div style="border-top:2px solid #374151;border-bottom:1px solid #374151;margin-bottom:12pt;">&nbsp;</div>`;
  })() : '';

  const signatureHtml = (data.kepalaNama || data.guruPengampu) ? (() => {
    const left = data.kepalaNama ? `
      <div style="text-align:center;width:45%;float:left;">
        <p style="margin:0;font-size:10pt;">${data.schoolName || ''}, ${sigDate}</p>
        <p style="margin:0;font-size:10pt;">Kepala Sekolah,</p>
        <p style="height:52pt;margin:0;">${data.kepalaSignatureUrl ? `<img src="${data.kepalaSignatureUrl}" width="120" height="52" />` : ''}</p>
        <p style="margin:0;font-weight:bold;font-size:10pt;">${data.kepalaNama}</p>
        <p style="margin:0;font-size:9pt;color:#666;">NIP. ${data.kepalaNip || '_____________________'}</p>
      </div>` : '';
    const right = data.guruPengampu ? `
      <div style="text-align:center;width:45%;float:right;">
        <p style="margin:0;font-size:10pt;">${data.schoolName || ''}, ${sigDate}</p>
        <p style="margin:0;font-size:10pt;">Guru Pengampu,</p>
        <p style="height:52pt;margin:0;">${data.guruSignatureUrl ? `<img src="${data.guruSignatureUrl}" width="120" height="52" />` : ''}</p>
        <p style="margin:0;font-weight:bold;font-size:10pt;">${data.guruPengampu}</p>
        <p style="margin:0;font-size:9pt;color:#666;">NIP. ${data.guruNip || '_____________________'}</p>
      </div>` : '';
    return `<div style="margin-top:40pt;overflow:hidden;">${left}${right}</div>`;
  })() : '';

  const tableRows = data.records.map((rec, idx) => {
    const statusColor: Record<string, string> = {
      hadir: '#10b981',
      sakit: '#3b82f6',
      izin: '#8b5cf6',
      alpa: '#ef4444',
    };
    const color = statusColor[rec.status] || '#000';
    const bg = idx % 2 === 0 ? 'white' : '#F9FAFB';
    return `
      <tr style="background:${bg};">
        <td style="border:1px solid #ccc;padding:6pt;font-size:9pt;text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #ccc;padding:6pt;font-size:9pt;text-align:center;">${rec.nomorAbsen != null ? rec.nomorAbsen : '-'}</td>
        <td style="border:1px solid #ccc;padding:6pt;font-size:9pt;">${rec.namaSiswa}</td>
        <td style="border:1px solid #ccc;padding:6pt;font-size:9pt;text-align:center;">${rec.nisn || '-'}</td>
        <td style="border:1px solid #ccc;padding:6pt;font-size:9pt;text-align:center;color:${color};font-weight:bold;">${STATUS_LABELS[rec.status] || rec.status}</td>
        <td style="border:1px solid #ccc;padding:6pt;font-size:9pt;">${rec.catatan || '-'}</td>
      </tr>`;
  }).join('');

  const summaryBg = data.summary.tingkatKehadiran >= 90 ? '#dcfce7'
    : data.summary.tingkatKehadiran >= 75 ? '#fef3c7' : '#fee2e2';

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Laporan Presensi Harian Siswa</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; font-size: 10pt; }
    h1 { font-size: 14pt; text-align: center; margin: 12pt 0 4pt; }
    .info-table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
    .info-table td { padding: 3pt 6pt; font-size: 10pt; vertical-align: top; }
    .info-table .label { font-weight: bold; width: 120pt; }
    .summary-box { background: ${summaryBg}; border: 1px solid #374151; padding: 8pt; margin: 8pt 0; font-size: 10pt; }
    table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
    th { background: #1E3A8A; color: white; border: 1px solid #ccc; padding: 6pt; font-size: 9pt; text-align: center; }
    td { border: 1px solid #ccc; padding: 6pt; font-size: 9pt; }
    .footer { text-align: center; font-size: 8pt; color: #666; margin-top: 40pt; clear: both; }
  </style>
</head>
<body>
  ${kopHtml}
  <h1>LAPORAN PRESENSI HARIAN SISWA</h1>

  <table class="info-table">
    <tr>
      <td class="label">Kelas</td><td>: ${data.kelas}</td>
      <td class="label">Mata Pelajaran</td><td>: ${data.mapel || '-'}</td>
    </tr>
    <tr>
      <td class="label">Tanggal</td><td>: ${data.tanggal}</td>
      <td class="label">Guru Pengampu</td><td>: ${data.guruPengampu}${data.guruNip ? `, NIP. ${data.guruNip}` : ''}</td>
    </tr>
  </table>

  <div class="summary-box">
    <strong>Ringkasan:</strong>
    Total: ${data.summary.total} |
    Hadir: ${data.summary.hadir} |
    Sakit: ${data.summary.sakit} |
    Izin: ${data.summary.izin} |
    Alpa: ${data.summary.alpa} |
    <strong>Tingkat Kehadiran: ${data.summary.tingkatKehadiran}%</strong>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:5%;">No</th>
        <th style="width:7%;">No. Absen</th>
        <th style="width:25%;">Nama Siswa</th>
        <th style="width:12%;">NISN</th>
        <th style="width:10%;">Status</th>
        <th style="width:41%;">Catatan</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  ${signatureHtml}

  <div class="footer">
    <p>Dokumen ini dihasilkan oleh GuruPRO AI</p>
  </div>
</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}
