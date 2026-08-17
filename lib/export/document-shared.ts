/**
 * GuruPRO Document Shared Utilities
 * Design tokens, helpers, dan template untuk semua dokumen cetak/export
 * Standar dokumen resmi Indonesia — Kurikulum Merdeka
 */

// ============================================
// BRAND COLORS (konsisten dengan globals.css)
// ============================================
export const BRAND = {
  primary: '#7C3AED',    // violet
  accent: '#F59E0B',      // amber
  dark: '#1E3A8A',        // biru tua (untuk header sheet Excel)
  muted: '#6B7280',        // gray
  border: '#374151',      // gray-700
  text: '#1F2937',         // gray-800
  bg: '#FFFFFF',
  bgAlt: '#F9FAFB',        // gray-50
  headerBg: '#1E3A8A',    // biru tua
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
} as const

// ============================================
// STANDAR DOKUMEN INDONESIA
// ============================================
export const DOCUMENT_STANDARDS = {
  fontFamily: 'Times New Roman',
  fontSize: {
    title: 14,    // pt — judul dokumen
    subtitle: 12, // pt — subtitle, kop
    body: 11,     // pt — isi tabel/body
    small: 10,    // pt — footnote, footer
    footnote: 9,  // pt — disclaimer
  },
  lineHeight: 1.5,
  margin: {
    top: 2.5,    // cm
    bottom: 2.0,
    left: 3.0,
    right: 2.0,
  },
  pageSize: 'A4',
} as const

// ============================================
// BRAND DISCLAIMER (konsisten di semua dokumen)
// ============================================
export const BRAND_DISCLAIMER = 'Dokumen ini dihasilkan oleh GuruPRO AI'

// ============================================
// ESCAPE HTML (fix: tambah single quote + newline)
// ============================================
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br>');
}

// ============================================
// ESCAPE HTML TANPA BR (untuk dalam <textarea> / preformatted)
// ============================================
export function escapeHtmlPlain(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================
// FORMAT TANGGAL INDONESIA
// ============================================
export function formatTanggalIndonesia(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ============================================
// FORMAT TAHUN AJARAN DINAMIS
// ============================================
export function getTahunAjaranDariTanggal(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth();
  // Jika bulan Juli-Desember (mulai ajaran baru): 2025/2026
  // Jika bulan Januari-Juni: 2024/2025
  if (month >= 6) {
    return `${year}/${year + 1}`;
  }
  return `${year - 1}/${year}`;
}

// ============================================
// SEMESTER DARI TANGGAL
// ============================================
export function getSemesterDariTanggal(date: Date | string): 'ganjil' | 'genap' {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = d.getMonth();
  // Juli-Desember = ganjil (1), Januari-Juni = genap (2)
  return month >= 6 ? 'ganjil' : 'genap';
}

// ============================================
// BUILD KOP SEKOLAH HTML
// Kop resmi: logo kiri | nama sekolah tengah | NPSN kanan
// ============================================
export function buildKopSekolahHTML(school: {
  nama_sekolah: string;
  alamat?: string | null;
  npsn?: string | null;
  logo?: string | null;
}, options?: {
  showAlamat?: boolean;
  showNpsn?: boolean;
}): string {
  const showAlamat = options?.showAlamat ?? true;
  const showNpsn = options?.showNpsn ?? true;

  const logoSection = school.logo
    ? `<td style="width:60px;text-align:center;vertical-align:middle;">
        <img src="${escapeHtml(school.logo)}" alt="Logo" style="max-height:60px;max-width:60px;object-fit:contain;" />
       </td>`
    : `<td style="width:60px;"></td>`;

  const alamatLine = showAlamat && school.alamat
    ? `<p style="margin:2px 0;font-size:9pt;color:#555;">${escapeHtml(school.alamat)}</p>`
    : '';

  const npsnLine = showNpsn && school.npsn
    ? `<p style="margin:2px 0;font-size:9pt;">NPSN: ${escapeHtml(school.npsn)}</p>`
    : '';

  return `
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
    <tr>
      ${logoSection}
      <td style="text-align:center;vertical-align:middle;">
        <h1 style="margin:0;font-size:16pt;font-weight:bold;color:#000;text-transform:uppercase;">${escapeHtml(school.nama_sekolah)}</h1>
        ${alamatLine}
        ${npsnLine}
      </td>
      <td style="width:60px;"></td>
    </tr>
  </table>
  <div style="border-bottom:2px solid #000;margin-bottom:16px;"></div>`;
}

// ============================================
// BUILD IDENTITAS TABLE HTML
// ============================================
export function buildIdentitasTableHTML(rows: [string, string][], options?: {
  col1Width?: number;
}): string {
  const col1Width = options?.col1Width ?? 160;
  const rowsHtml = rows
    .map(([label, value]) =>
      `<tr>
        <td style="width:${col1Width}px;padding:3px 8px 3px 0;font-size:11pt;font-weight:bold;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:3px 0;font-size:11pt;vertical-align:top;">: ${escapeHtml(value)}</td>
      </tr>`
    )
    .join('\n');

  return `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${rowsHtml}</table>`;
}

// ============================================
// BUILD SIGNATURE BLOCK HTML
// Tanda tangan: kiri = guru, kanan = kepala sekolah
// Supports image-based signatures (uploaded PNG/JPG)
// ============================================
export function buildSignatureBlockHTML(options: {
  guruNama: string;
  guruNip?: string | null;
  kepalaNama: string;
  kepalaNip?: string | null;
  lokasi?: string;
  tanggal?: string;
  guruSignatureUrl?: string | null;
  kepalaSignatureUrl?: string | null;
}): string {
  const { guruNama, guruNip, kepalaNama, kepalaNip, lokasi, tanggal, guruSignatureUrl, kepalaSignatureUrl } = options;
  const tempatLine = lokasi || '';
  const tanggalLine = tanggal || formatTanggalIndonesia(new Date());

  const guruSigImg = guruSignatureUrl
    ? `<img src="${escapeHtml(guruSignatureUrl)}" alt="Tanda Tangan Guru" style="height:60px;width:auto;object-fit:contain;display:block;margin:0 auto;" />`
    : `<div style="height:60px;"></div>`;

  const kepalaSigImg = kepalaSignatureUrl
    ? `<img src="${escapeHtml(kepalaSignatureUrl)}" alt="Tanda Tangan Kepala Sekolah" style="height:60px;width:auto;object-fit:contain;display:block;margin:0 auto;" />`
    : `<div style="height:60px;"></div>`;

  return `
  <div style="margin-top:40px;page-break-inside:avoid;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="text-align:center;width:45%;">
        <p style="margin:0 0 4px;font-size:11pt;">${escapeHtml(tempatLine)}, ${escapeHtml(tanggalLine)}</p>
        <p style="margin:0 0 4px;font-size:11pt;">Kepala Sekolah,</p>
        <div style="height:8px;"></div>
        ${kepalaSigImg}
        <div style="height:4px;"></div>
        <p style="margin:0;font-size:11pt;text-decoration:underline;font-weight:bold;">${escapeHtml(kepalaNama || '_____________________')}</p>
        ${kepalaNip ? `<p style="margin:4px 0 0;font-size:10pt;">NIP. ${escapeHtml(kepalaNip)}</p>` : `<p style="margin:4px 0 0;font-size:10pt;">NIP. _____________________</p>`}
      </div>
      <div style="text-align:center;width:45%;">
        <p style="margin:0 0 4px;font-size:11pt;">${escapeHtml(tempatLine)}, ${escapeHtml(tanggalLine)}</p>
        <p style="margin:0 0 4px;font-size:11pt;">Guru,</p>
        <div style="height:8px;"></div>
        ${guruSigImg}
        <div style="height:4px;"></div>
        <p style="margin:0;font-size:11pt;text-decoration:underline;font-weight:bold;">${escapeHtml(guruNama || '_____________________')}</p>
        ${guruNip ? `<p style="margin:4px 0 0;font-size:10pt;">NIP. ${escapeHtml(guruNip)}</p>` : `<p style="margin:4px 0 0;font-size:10pt;">NIP. _____________________</p>`}
      </div>
    </div>
  </div>`;
}

// ============================================
// BUILD DOCUMENT FOOTER HTML
// ============================================
export function buildDocumentFooterHTML(options?: {
  showPageNumber?: boolean;
  showDisclaimer?: boolean;
  showDate?: boolean;
  tanggal?: string;
}): string {
  const showPageNumber = options?.showPageNumber ?? true;
  const showDisclaimer = options?.showDisclaimer ?? true;
  const showDate = options?.showDate ?? true;
  const tanggal = options?.tanggal || formatTanggalIndonesia(new Date());

  const parts: string[] = [];
  if (showDate) parts.push(`Dicetak pada ${tanggal}`);
  if (showDisclaimer) parts.push(BRAND_DISCLAIMER);

  return `
  <div style="margin-top:30px;padding-top:12px;border-top:1px solid #ccc;text-align:center;">
    ${parts.map(p => `<p style="margin:2px 0;font-size:${showPageNumber ? '9pt' : '10pt'};color:#666;">${p}</p>`).join('\n')}
  </div>`;
}

// ============================================
// PAGE NUMBERING TEMPLATE
// CSS @page counter untuk print, Word field codes untuk DOCX
// ============================================
export function buildPageNumberingHTML(): string {
  return `<table style="width:100%;border-collapse:collapse;margin-top:20px;">
  <tr>
    <td style="width:70%;"></td>
    <td style="width:30%;text-align:right;">
      <span style="font-size:9pt;color:#666;">Halaman </span>
      <span style="font-size:9pt;color:#666;mso-field-code:' PAGE \\* MERGEFORMAT '"></span>
      <span style="font-size:9pt;color:#666;"> dari </span>
      <span style="font-size:9pt;color:#666;mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span>
    </td>
  </tr>
</table>`;
}

// ============================================
// BUILD WORD DOCX TEMPLATE (HTML dengan Word namespace)
// ============================================
export function buildWordDocTemplate(bodyHtml: string, title?: string): string {
  const docTitle = title || 'Dokumen GuruPRO';
  const pageNum = buildPageNumberingHTML();
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <meta name=ProgId content=Word.Document>
  <meta name=Generator content="GuruPRO AI">
  <meta name=Originator content="Microsoft Word">
  <title>${escapeHtmlPlain(docTitle)}</title>
  <!--[if gte mso 9]>
  <xml>
    <o:DocumentProperties>
      <o:Title>${escapeHtmlPlain(docTitle)}</o:Title>
      <o:Author>GuruPRO</o:Author>
      <o:Created>${new Date().toISOString()}</o:Created>
    </o:DocumentProperties>
    <o:HTMLPr xmlns:o="urn:schemas-microsoft-com:office:office">
      <o:TargetCursors>Default</o:TargetCursors>
      <o:Tracking>off</o:Tracking>
      <o:AllowPNG/>
    </o:HTMLPr>
  </xml>
  <![endif]-->
  <style>
    @page {
      margin: 2.5cm 2cm 2cm 3cm;
      size: A4;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      color: #000;
      line-height: 1.5;
      margin: 0;
      padding: 0;
    }
    h1 { text-align: center; font-size: 16pt; margin: 0 0 4px; font-weight: bold; text-transform: uppercase; }
    h2 { font-size: 13pt; margin: 20px 0 10px; font-weight: bold; }
    h3 { font-size: 12pt; margin: 16px 0 8px; font-weight: bold; }
    p { margin: 6px 0; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #000; padding: 6px 8px; font-size: 11pt; vertical-align: top; }
    th { background: #f3f4f6; font-weight: bold; text-align: center; }
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin: 4px 0; font-size: 11pt; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    .header-line { border-bottom: 2px solid #000; margin: 6px 0 20px; }
    .section { margin-bottom: 20px; }
    .page-break { page-break-before: always; }
    .no-break { page-break-inside: avoid; }
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
${bodyHtml}
<div class="page-footer">Halaman <span style="mso-field-code:' PAGE \\* MERGEFORMAT '"></span> dari <span style="mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span></div>
</body>
</html>`;
}

// ============================================
// ZEBRA STRIPE ROW HELPER
// ============================================
export function zebraRowStyle(index: number): string {
  return index % 2 === 0 ? 'background:#fff;' : 'background:#f9fafb;';
}

// ============================================
// BULLET LIST FROM NEWLINE
// ============================================
export function newlinesToBulletList(text: string, options?: {
  ordered?: boolean;
}): string {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return '';

  if (options?.ordered) {
    return '<ol>' + lines.map(l => `<li>${escapeHtml(l.trim())}</li>`).join('') + '</ol>';
  }
  return '<ul>' + lines.map(l => `<li>${escapeHtml(l.trim())}</li>`).join('') + '</ul>';
}

// ============================================
// PARAGRAPH LIST FROM NEWLINE
// ============================================
export function newlinesToParagraphs(text: string): string {
  return text
    .split('\n')
    .filter(l => l.trim())
    .map(l => `<p style="text-indent:1.5cm;margin:6px 0;text-align:justify;">${escapeHtml(l.trim())}</p>`)
    .join('\n');
}

// ============================================
// FORMAT DURASI MENIT KE JAM-MENIT
// ============================================
export function formatDurasi(menit: number): string {
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam === 0) return `${sisa}m`;
  if (sisa === 0) return `${jam}j`;
  return `${jam}j ${sisa}m`;
}
