import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const STATUS_LABELS: Record<string, string> = {
  hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin', alpa: 'Alpa',
};
const STATUS_COLORS: Record<string, string> = {
  hadir: '#10b981', sakit: '#0ea5e9', izin: '#7c3aed', alpa: '#f43f5e',
};

export interface StudentAttendanceRecord {
  id: string; namaSiswa: string; nisn?: string | null; nomorAbsen?: number | null;
  status: string; catatan?: string | null; tanggal: string | Date;
}
export interface StudentAttendanceReportData {
  schoolName: string; schoolAddress?: string | null; schoolNpsn?: string | null; schoolLogo?: string | null;
  kelas: string; mapel?: string; guruPengampu: string; guruNip?: string | null;
  tanggal: string; periodeLabel: string; records: StudentAttendanceRecord[];
  summary: { total: number; hadir: number; sakit: number; izin: number; alpa: number; tingkatKehadiran: number };
  kepalaNama?: string | null; kepalaNip?: string | null; kepalaSignatureUrl?: string | null;
  guruSignatureUrl?: string | null;
}

export async function generateStudentAttendancePdfBuffer(data: StudentAttendanceReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (e) => reject(e));

    const PW = doc.page.width as number;
    const PH = doc.page.height as number;
    const ML = 57, MR = 57, MT = 71, MB = 57;
    const CW = PW - ML - MR;
    const W = 595.28, H = 841.89;

    const NAVY = '#1E3A8A';
    const DARK = '#1F2937';
    const GRAY = '#6B7280';
    const LIGHT = '#F3F4F6';
    const WHITE = '#FFFFFF';
    const BORDER = '#D1D5DB';

    let y = MT, pageNum = 1;

    const checkBreak = (n: number) => {
      if (y + n > PH - MB) { doc.addPage(); y = MT; pageNum++; }
    };
    const pgNum = () => {
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      doc.text(`Halaman ${pageNum}`, ML, PH - MB + 8, { align: 'center', width: CW });
      doc.fillColor(DARK);
    };
    pgNum();
    // @ts-ignore
    doc.on('pageAdded', () => { pageNum++; pgNum(); });

    // ---- KOP SEKOLAH ----
    if (data.schoolLogo) {
      try { doc.image(data.schoolLogo, ML, y, { fit: [48, 48] }); } catch (_) {}
    }
    doc.font('Helvetica-Bold').fontSize(14).fillColor(NAVY);
    doc.text(data.schoolName.toUpperCase(), ML + (data.schoolLogo ? 56 : 0), y + 6, {
      width: CW - (data.schoolLogo ? 56 : 0), align: 'center',
    });
    y += 24;
    if (data.schoolAddress) {
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      doc.text(data.schoolAddress, ML, y, { width: CW, align: 'center' });
      y += 12;
    }
    if (data.schoolNpsn) {
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      doc.text(`NPSN: ${data.schoolNpsn}`, ML, y, { width: CW, align: 'center' });
      y += 12;
    }
    y += 4;
    doc.moveTo(ML, y).lineTo(PW - MR, y).lineWidth(2).stroke(NAVY);
    y += 4;
    doc.moveTo(ML, y).lineTo(PW - MR, y).lineWidth(0.5).stroke(BORDER);
    y += 14;

    // ---- JUDUL ----
    doc.font('Helvetica-Bold').fontSize(13).fillColor(DARK);
    doc.text('LAPORAN PRESENSI HARIAN SISWA', ML, y, { width: CW, align: 'center' });
    y += 20;

    // ---- INFO ----
    const info = [
      ['Kelas', data.kelas, 'Mata Pelajaran', data.mapel || '-'],
      ['Tanggal', data.tanggal, 'Guru Pengampu', `${data.guruPengampu}${data.guruNip ? `, NIP. ${data.guruNip}` : ''}`],
    ];
    const lw = 110, vw = CW / 2 - lw - 6;
    for (const [l1, v1, l2, v2] of info) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK);
      doc.text(l1, ML, y, { width: lw });
      doc.font('Helvetica').fontSize(9).fillColor(DARK);
      doc.text(v1, ML + lw, y, { width: vw });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK);
      doc.text(l2, ML + CW / 2, y, { width: lw });
      doc.font('Helvetica').fontSize(9).fillColor(DARK);
      doc.text(v2, ML + CW / 2 + lw, y, { width: vw });
      y += 14;
    }
    y += 6;

    // ---- RINGKASAN ----
    checkBreak(36);
    const items = [
      { label: 'Total', value: data.summary.total },
      { label: 'Hadir', value: data.summary.hadir, color: '#10b981' },
      { label: 'Sakit', value: data.summary.sakit, color: '#0ea5e9' },
      { label: 'Izin', value: data.summary.izin, color: '#7c3aed' },
      { label: 'Alpa', value: data.summary.alpa, color: '#f43f5e' },
      { label: 'Tingkat Kehadiran', value: `${data.summary.tingkatKehadiran}%`, color: data.summary.tingkatKehadiran >= 90 ? '#10b981' : data.summary.tingkatKehadiran >= 75 ? '#f59e0b' : '#f43f5e' },
    ];
    const boxW = CW / items.length;
    doc.rect(ML, y, CW, 28).fill(NAVY);
    items.forEach((item, i) => {
      const x = ML + i * boxW;
      doc.font('Helvetica').fontSize(7).fillColor('#E5E7EB').text(item.label, x + 4, y + 4, { width: boxW - 8, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(item.color || WHITE).text(String(item.value), x + 4, y + 14, { width: boxW - 8, align: 'center' });
    });
    y += 36;

    // ---- TABEL ----
    const cols = [
      { label: 'No', w: 28 },
      { label: 'No.\nAbsen', w: 38 },
      { label: 'Nama Siswa', w: 130 },
      { label: 'NISN', w: 58 },
      { label: 'Tanggal', w: 72 },
      { label: 'Status', w: 46 },
      { label: 'Catatan', w: 68 },
    ];
    const rowH = 18;
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    // scale cols to fit CW
    const scale = CW / totalW;
    const scaled = cols.map(c => ({ ...c, w: c.w * scale }));

    checkBreak(rowH + 10);
    // header
    let x = ML;
    scaled.forEach(c => {
      doc.rect(x, y, c.w, rowH).fill(NAVY);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(WHITE);
      doc.text(c.label, x + 2, y + 3, { width: c.w - 4, align: 'center' });
      x += c.w;
    });
    y += rowH;

    // rows
    if (data.records.length === 0) {
      checkBreak(rowH);
      x = ML;
      scaled.forEach(c => {
        doc.rect(x, y, c.w, rowH).fill(WHITE).stroke(BORDER);
        x += c.w;
      });
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      doc.text('Tidak ada data presensi untuk periode ini.', ML + 4, y + 5, { width: CW - 8, align: 'center' });
      y += rowH;
    } else {
      data.records.forEach((rec, idx) => {
        checkBreak(rowH);
        const bg = idx % 2 === 0 ? WHITE : '#F9FAFB';
        const stColor = STATUS_COLORS[rec.status] || DARK;
        const cells = [
          String(idx + 1),
          rec.nomorAbsen != null ? String(rec.nomorAbsen) : '-',
          rec.namaSiswa,
          rec.nisn || '-',
          typeof rec.tanggal === 'string' ? format(new Date(rec.tanggal), 'd MMM yyyy', { locale: id }) : format(rec.tanggal, 'd MMM yyyy', { locale: id }),
          STATUS_LABELS[rec.status] || rec.status,
          rec.catatan || '-',
        ];
        x = ML;
        scaled.forEach((c, ci) => {
          doc.rect(x, y, c.w, rowH).fill(bg).stroke(BORDER);
          const isStatus = ci === 5;
          doc.font(isStatus ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor(isStatus ? stColor : DARK);
          doc.text(cells[ci], x + 2, y + 5, { width: c.w - 4, align: ci === 0 || ci === 1 || ci === 3 || ci === 5 ? 'center' : 'left' });
          x += c.w;
        });
        y += rowH;
      });
    }
    y += 16;

    // ---- TANDA TANGAN ----
    if (data.kepalaNama || data.guruPengampu) {
      checkBreak(100);
      const colW = (CW - 20) / 2;
      const city = data.tanggal;

      // left: kepala sekolah
      doc.font('Helvetica').fontSize(9).fillColor(DARK);
      doc.text(city, ML, y, { width: colW, align: 'center' });
      y += 12;
      doc.text('Kepala Sekolah,', ML, y, { width: colW, align: 'center' });
      y += 50;
      if (data.kepalaSignatureUrl) {
        try { doc.image(data.kepalaSignatureUrl, ML, y - 50, { fit: [120, 50] }); } catch (_) {}
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK);
      doc.text(data.kepalaNama || '_____________________', ML, y, { width: colW, align: 'center' });
      y += 12;
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      doc.text(`NIP. ${data.kepalaNip || '____________________'}`, ML, y, { width: colW, align: 'center' });

      // right: guru pengampu
      const rx = ML + colW + 20;
      let ry = y - 62;
      doc.font('Helvetica').fontSize(9).fillColor(DARK);
      doc.text(city, rx, ry, { width: colW, align: 'center' });
      ry += 12;
      doc.text('Guru Pengampu / Wali Kelas,', rx, ry, { width: colW, align: 'center' });
      ry += 50;
      if (data.guruSignatureUrl) {
        try { doc.image(data.guruSignatureUrl, rx, ry - 50, { fit: [120, 50] }); } catch (_) {}
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK);
      doc.text(data.guruPengampu, rx, ry, { width: colW, align: 'center' });
      ry += 12;
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      doc.text(`NIP. ${data.guruNip || '____________________'}`, rx, ry, { width: colW, align: 'center' });
    }

    // footer
    doc.font('Helvetica').fontSize(7).fillColor(GRAY);
    doc.text('Dokumen ini dihasilkan oleh GuruPRO AI', ML, PH - MB + 8, { align: 'center', width: CW });

    doc.end();
  });
}

export function generateStudentAttendanceDocBuffer(data: StudentAttendanceReportData): Buffer {
  const sigDate = data.tanggal;
  const logoHtml = data.schoolLogo ? `<img src="${data.schoolLogo}" width="48" height="48" style="vertical-align:middle;margin-right:8px;" />` : '';
  const kopHtml = data.schoolName ? `<div style="text-align:center;margin-bottom:6pt;">${logoHtml}<div style="font-size:14pt;font-weight:bold;color:#1E3A8A;">${data.schoolName.toUpperCase()}</div>${data.schoolAddress ? `<div style="font-size:8pt;color:#6B7280;">${data.schoolAddress}</div>` : ''}${data.schoolNpsn ? `<div style="font-size:8pt;color:#6B7280;">NPSN: ${data.schoolNpsn}</div>` : ''}</div><div style="border-top:2px solid #1E3A8A;border-bottom:1px solid #D1D5DB;margin-bottom:12pt;">&nbsp;</div>` : '';

  const sigLeft = data.kepalaNama ? `<div style="width:45%;float:left;text-align:center;"><p style="margin:0;font-size:10pt;">${sigDate}</p><p style="margin:0;font-size:10pt;">Kepala Sekolah,</p><p style="height:52pt;margin:0;">${data.kepalaSignatureUrl ? `<img src="${data.kepalaSignatureUrl}" width="120" height="52" />` : ''}</p><p style="margin:0;font-weight:bold;font-size:10pt;">${data.kepalaNama}</p><p style="margin:0;font-size:9pt;color:#6B7280;">NIP. ${data.kepalaNip || '____________________'}</p></div>` : '';
  const sigRight = data.guruPengampu ? `<div style="width:45%;float:right;text-align:center;"><p style="margin:0;font-size:10pt;">${sigDate}</p><p style="margin:0;font-size:10pt;">Guru Pengampu / Wali Kelas,</p><p style="height:52pt;margin:0;">${data.guruSignatureUrl ? `<img src="${data.guruSignatureUrl}" width="120" height="52" />` : ''}</p><p style="margin:0;font-weight:bold;font-size:10pt;">${data.guruPengampu}</p><p style="margin:0;font-size:9pt;color:#6B7280;">NIP. ${data.guruNip || '____________________'}</p></div>` : '';
  const sigHtml = (data.kepalaNama || data.guruPengampu) ? `<div style="margin-top:40pt;overflow:hidden;">${sigLeft}${sigRight}</div>` : '';

  const rows = data.records.map((rec, idx) => {
    const bg = idx % 2 === 0 ? 'white' : '#F9FAFB';
    const sc = STATUS_COLORS[rec.status] || '#000';
    return `<tr style="background:${bg};"><td style="border:1px solid #D1D5DB;padding:5pt;font-size:9pt;text-align:center;">${idx+1}</td><td style="border:1px solid #D1D5DB;padding:5pt;font-size:9pt;text-align:center;">${rec.nomorAbsen??'-'}</td><td style="border:1px solid #D1D5DB;padding:5pt;font-size:9pt;">${rec.namaSiswa}</td><td style="border:1px solid #D1D5DB;padding:5pt;font-size:9pt;text-align:center;">${rec.nisn||'-'}</td><td style="border:1px solid #D1D5DB;padding:5pt;font-size:9pt;">${typeof rec.tanggal==='string'?format(new Date(rec.tanggal),'d MMM yyyy',{locale:id}):format(rec.tanggal,'d MMM yyyy',{locale:id})}</td><td style="border:1px solid #D1D5DB;padding:5pt;font-size:9pt;text-align:center;font-weight:bold;color:${sc};">${STATUS_LABELS[rec.status]||rec.status}</td><td style="border:1px solid #D1D5DB;padding:5pt;font-size:9pt;">${rec.catatan||'-'}</td></tr>`;
  }).join('');

  const summaryBg = data.summary.tingkatKehadiran >= 90 ? '#dcfce7' : data.summary.tingkatKehadiran >= 75 ? '#fef3c7' : '#fee2e2';
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Laporan Presensi Harian Siswa</title><style>body{font-family:Arial,sans-serif;padding:40px;font-size:10pt;}h1{font-size:13pt;text-align:center;margin:10pt 0 4pt;font-weight:bold;}.info-table{width:100%;border-collapse:collapse;margin:8pt 0;}.info-table td{padding:2pt 4pt;font-size:9pt;}.info-table .lbl{font-weight:bold;width:110pt;}.sum-box{background:${summaryBg};border:1px solid #1E3A8A;padding:6pt;margin:8pt 0;font-size:9pt;}.tbl{width:100%;border-collapse:collapse;margin:8pt 0;}.tbl th{background:#1E3A8A;color:white;border:1px solid #1E3A8A;padding:5pt;font-size:9pt;text-align:center;}.tbl td{border:1px solid #D1D5DB;padding:5pt;font-size:9pt;}.footer{text-align:center;font-size:7pt;color:#6B7280;margin-top:40pt;clear:both;}</style></head><body>${kopHtml}<h1>LAPORAN PRESENSI HARIAN SISWA</h1><table class="info-table"><tr><td class="lbl">Kelas</td><td>: ${data.kelas}</td><td class="lbl">Mata Pelajaran</td><td>: ${data.mapel||'-'}</td></tr><tr><td class="lbl">Tanggal</td><td>: ${data.tanggal}</td><td class="lbl">Guru Pengampu</td><td>: ${data.guruPengampu}${data.guruNip?`, NIP. ${data.guruNip}`:''}</td></tr></table><div class="sum-box"><strong>Ringkasan:</strong> Total=${data.summary.total} | Hadir=${data.summary.hadir} | Sakit=${data.summary.sakit} | Izin=${data.summary.izin} | Alpa=${data.summary.alpa} | <strong>Tingkat Kehadiran: ${data.summary.tingkatKehadiran}%</strong></div><table class="tbl"><thead><tr><th style="width:4%;">No</th><th style="width:6%;">No. Absen</th><th style="width:22%;">Nama Siswa</th><th style="width:10%;">NISN</th><th style="width:12%;">Tanggal</th><th style="width:7%;">Status</th><th style="width:39%;">Catatan</th></tr></thead><tbody>${rows}</tbody></table>${sigHtml}<div class="footer"><p>Dokumen ini dihasilkan oleh GuruPRO AI</p></div></body></html>`;
  return Buffer.from(html, 'utf-8');
}
