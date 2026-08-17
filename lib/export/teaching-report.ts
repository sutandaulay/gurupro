/**
 * Shared teaching report document builder
 * Dipakai oleh laporan-mengajar Prisma & drizzle versions
 */

import {
  buildKopSekolahHTML,
  buildIdentitasTableHTML,
  buildSignatureBlockHTML,
  buildDocumentFooterHTML,
  buildWordDocTemplate,
  escapeHtml,
  formatTanggalIndonesia,
  getTahunAjaranDariTanggal,
  getSemesterDariTanggal,
  newlinesToBulletList,
} from './document-shared';

export interface TeachingReportData {
  tanggal: string;
  guruNama: string;
  guruNip?: string;
  kelas: string;
  mapel: string;
  sekolah: string;
  sekolahAlamat?: string;
  sekolahNpsn?: string;
  sekolahLogo?: string;
  kepalaNama?: string;
  kepalaNip?: string;
  attendance?: {
    hadir: number;
    izin: number;
    sakit: number;
    alpha: number;
  };
  materi?: string;
  tujuan?: string;
  aktivitas?: string;
  media?: string;
  asesmen?: string;
  refleksi?: string;
  tindakLanjut?: string;
}

export function generateTeachingReportHTML(data: TeachingReportData, options?: {
  format?: 'docx' | 'html';
  title?: string;
}): string {
  const format = options?.format || 'docx';
  const downloadDate = new Date(data.tanggal);
  const tahunAjaran = getTahunAjaranDariTanggal(downloadDate);
  const semester = getSemesterDariTanggal(downloadDate);
  const semesterLabel = semester === 'ganjil' ? 'Ganjil' : 'Genap';
  const hari = downloadDate.toLocaleDateString('id-ID', { weekday: 'long' });
  const tanggalFormatted = formatTanggalIndonesia(downloadDate);

  // --- Kop Sekolah ---
  const kopHtml = data.sekolah
    ? buildKopSekolahHTML({
        nama_sekolah: data.sekolah,
        alamat: data.sekolahAlamat,
        npsn: data.sekolahNpsn,
        logo: data.sekolahLogo,
      })
    : '';

  // --- Identitas ---
  const identitasRows: [string, string][] = [
    ['Hari / Tanggal', `${hari}, ${tanggalFormatted}`],
    ['Guru', data.guruNama || '-'],
    ['NIP', data.guruNip || '-'],
    ['Kelas', data.kelas],
    ['Mata Pelajaran', data.mapel],
    ['Sekolah', data.sekolah || '-'],
    ['Semester', semesterLabel],
    ['Tahun Pelajaran', tahunAjaran],
  ];
  const identitasHtml = buildIdentitasTableHTML(identitasRows, { col1Width: 170 });

  // --- Kehadiran ---
  const attendanceHtml = data.attendance
    ? `
  <div style="margin-bottom:20px;page-break-inside:avoid;">
    <h3 style="font-size:12pt;margin-bottom:8px;font-weight:bold;">Rekapitulasi Kehadiran Siswa</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr>
          <th style="padding:6px 10px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Hadir</th>
          <th style="padding:6px 10px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Izin</th>
          <th style="padding:6px 10px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Sakit</th>
          <th style="padding:6px 10px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Alpha</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-size:11pt;">${data.attendance.hadir}</td>
          <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-size:11pt;">${data.attendance.izin}</td>
          <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-size:11pt;">${data.attendance.sakit}</td>
          <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-size:11pt;">${data.attendance.alpha}</td>
        </tr>
      </tbody>
    </table>
  </div>`
    : '';

  // --- Section builder ---
  const sections: { heading: string; content?: string }[] = [
    { heading: 'Materi Pembelajaran', content: data.materi },
    { heading: 'Tujuan Pembelajaran', content: data.tujuan },
    { heading: 'Aktivitas Pembelajaran', content: data.aktivitas },
    { heading: 'Media Pembelajaran', content: data.media },
    { heading: 'Asesmen Pembelajaran', content: data.asesmen },
    { heading: 'Refleksi Guru', content: data.refleksi },
    { heading: 'Tindak Lanjut', content: data.tindakLanjut },
  ];

  const sectionsHtml = sections
    .filter(s => s.content?.trim())
    .map(s => {
      const lines = s.content!.split('\n').filter(l => l.trim());
      const isBullet = lines.every((l: string) => /^[-\d.)\s*]/.test(l.trim()));

      let contentHtml: string;
      if (isBullet) {
        contentHtml = newlinesToBulletList(s.content!, { ordered: /^\d/.test(lines[0]?.trim() || '') });
      } else {
        contentHtml = s.content!
          .split('\n')
          .filter(l => l.trim())
          .map(l => `<p style="text-indent:1.5cm;margin:6px 0;text-align:justify;">${escapeHtml(l.trim())}</p>`)
          .join('\n');
      }

      return `
  <div style="margin-bottom:20px;page-break-inside:avoid;">
    <h3 style="font-size:12pt;margin-bottom:8px;font-weight:bold;">${escapeHtml(s.heading)}</h3>
    ${contentHtml}
  </div>`;
    })
    .join('');

  // --- Tanda Tangan ---
  const signatureHtml = buildSignatureBlockHTML({
    guruNama: data.guruNama,
    guruNip: data.guruNip,
    kepalaNama: data.kepalaNama || '_____________________',
    kepalaNip: data.kepalaNip,
    lokasi: data.sekolah,
    tanggal: tanggalFormatted,
  });

  // --- Footer ---
  const footerHtml = buildDocumentFooterHTML({
    showPageNumber: false,
    showDisclaimer: true,
    showDate: true,
    tanggal: formatTanggalIndonesia(new Date()),
  });

  // --- Body ---
  const body = `
  <div style="text-align:center;margin-bottom:16px;">
    <h1 style="font-size:16pt;font-weight:bold;text-transform:uppercase;margin:0 0 4px;">Laporan Mengajar</h1>
    <p style="margin:0;font-size:12pt;">Semester ${semesterLabel} Tahun Pelajaran ${tahunAjaran}</p>
  </div>

  ${kopHtml}

  <div>
    <h3 style="font-size:12pt;margin-bottom:8px;font-weight:bold;">Identitas</h3>
    ${identitasHtml}
  </div>

  ${attendanceHtml}

  ${sectionsHtml}

  ${signatureHtml}

  ${footerHtml}`;

  if (format === 'docx') {
    return buildWordDocTemplate(body, options?.title || `Laporan Mengajar - ${data.kelas}`);
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Mengajar - ${escapeHtml(data.kelas)}</title>
  <style>
    @page { margin: 2.5cm 2cm 2cm 3cm; size: A4; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #111; margin: 0; padding: 0; line-height: 1.5; }
    h1 { text-align: center; font-size: 16pt; font-weight: bold; text-transform: uppercase; }
    h3 { font-size: 12pt; font-weight: bold; }
    p { margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 6px 8px; font-size: 11pt; }
    th { background: #f3f4f6; font-weight: bold; text-align: center; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}
