/**
 * AI Document Generation Monitoring
 * Track output lengths and rendering issues
 *
 * In development: logs truncation events to console
 * In production: sends to analytics service
 */
export function trackDocumentOutput(
  feature: string,
  data: {
    field: string;
    originalLength: number;
    maxAllowed: number;
  }
): void {
  // Only track in development or if analytics is configured
  if (process.env.NODE_ENV !== 'production' || process.env.AI_ANALYTICS_URL) {
    const truncated = data.originalLength > data.maxAllowed;
    if (truncated) {
      console.warn(
        `[${feature}] Truncated "${data.field}":`,
        `${data.originalLength} → ${data.maxAllowed} chars`
      );
    }
  }

  // TODO: Send to analytics service in production
  // e.g., await fetch(process.env.AI_ANALYTICS_URL, { method: 'POST', body: JSON.stringify({ feature, ...data }) });
}

import pptxgen from "pptxgenjs";
import PDFDocument from "pdfkit";
import { LKPDOutput, Aktivitas } from "./schemas/lkpd";
import {
  LaporanEvaluasiLkpdOutput,
  CapaianPerKKTP,
  getKategoriLabel,
  getKategoriColor,
  formatPersentase,
} from "./schemas/laporan-evaluasi-lkpd";
import { truncateText } from "./ai/validation-utils";

interface SlideData {
  title: string;
  points: string[];
}

/**
 * Parse Markdown to retrieve slide information
 */
export function parseSlides(slideMarkdown: string): SlideData[] {
  const slides: SlideData[] = [];
  const lines = slideMarkdown.split("\n");
  let currentSlide: SlideData | null = null;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.toLowerCase().startsWith("### slide") || line.toLowerCase().startsWith("- slide")) {
      if (currentSlide) {
        slides.push(currentSlide);
      }
      const cleanTitle = line.replace(/^(###\s*slide\s*\d+\s*:\s*|-\s*slide\s*\d+\s*:\s*)/i, "").trim();
      currentSlide = { title: cleanTitle || "Slide", points: [] };
    } else if (line.startsWith("- ") && currentSlide) {
      const point = line.substring(2).trim();
      // Skip metadata rows inside outline list
      if (
        !point.toLowerCase().startsWith("slide") &&
        !point.toLowerCase().startsWith("alokasi") &&
        !point.toLowerCase().startsWith("saran") &&
        !point.toLowerCase().startsWith("catatan")
      ) {
        currentSlide.points.push(point);
      }
    }
  }

  if (currentSlide) {
    slides.push(currentSlide);
  }

  return slides;
}

/**
 * Parse Bahan Ajar markdown into sections (Slides, LKPD, Handout)
 */
export function parseBahanAjarSections(markdown: string) {
  let slideText = "";
  let lkpdText = "";
  let handoutText = "";

  const slideIndex = markdown.indexOf("## 📊 1. SLIDE OUTLINE PRESENTASI");
  const lkpdIndex = markdown.indexOf("## 📝 2. LEMBAR KERJA PESERTA DIDIK");
  const handoutIndex = markdown.indexOf("## 📖 3. HANDOUT / BAHAN BACAAN SISWA");

  if (slideIndex !== -1) {
    const endSlide = lkpdIndex !== -1 ? lkpdIndex : (handoutIndex !== -1 ? handoutIndex : markdown.length);
    slideText = markdown.substring(slideIndex, endSlide).trim();
  }

  if (lkpdIndex !== -1) {
    const endLkpd = handoutIndex !== -1 ? handoutIndex : markdown.length;
    lkpdText = markdown.substring(lkpdIndex, endLkpd).trim();
  }

  if (handoutIndex !== -1) {
    handoutText = markdown.substring(handoutIndex).trim();
  }

  return { slideText, lkpdText, handoutText };
}

/**
 * Generate PPTX buffer from Slide Outline
 */
export async function generatePptxBuffer(slideMarkdown: string, topic: string): Promise<Buffer> {
  const slides = parseSlides(slideMarkdown);
  const pptx = new pptxgen();
  pptx.title = `Slide Bahan Ajar - ${topic}`;

  // Cover Slide
  const cover = pptx.addSlide();
  cover.background = { fill: "1E3A8A" }; // Deep Blue
  cover.addText("BAHAN AJAR AI", {
    x: 0.5,
    y: 1.5,
    w: 9.0,
    h: 1.0,
    fontSize: 40,
    bold: true,
    color: "FFFFFF",
    fontFace: "Arial",
  });
  cover.addText(topic, {
    x: 0.5,
    y: 2.6,
    w: 9.0,
    h: 1.5,
    fontSize: 24,
    color: "60A5FA", // Light Blue
    fontFace: "Arial",
  });

  // Content Slides
  slides.forEach((slideData, idx) => {
    const slide = pptx.addSlide();
    slide.background = { fill: "F8FAFC" }; // Slate 50

    // Slide header
    slide.addText(`Slide ${idx + 1}: ${slideData.title}`, {
      x: 0.5,
      y: 0.4,
      w: 9.0,
      h: 0.8,
      fontSize: 24,
      bold: true,
      color: "1E3A8A",
      fontFace: "Arial",
    });

    // Content points
    if (slideData.points.length > 0) {
      const bulletItems = slideData.points.map((pt) => ({ text: pt, options: { bullet: true } }));
      slide.addText(bulletItems as any, {
        x: 0.5,
        y: 1.5,
        w: 9.0,
        h: 4.5,
        fontSize: 16,
        color: "334155",
        lineSpacing: 24,
        fontFace: "Arial",
      });
    } else {
      slide.addText("- Pembahasan dan penyampaian konsep utama pelajaran.", {
        x: 0.5,
        y: 1.5,
        w: 9.0,
        h: 4.5,
        fontSize: 16,
        color: "64748B",
        bullet: true,
        fontFace: "Arial",
      });
    }
  });

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}

/**
 * Generate PDF buffer from Markdown
 * With robust overflow handling
 */
export async function generatePdfBuffer(
  markdown: string,
  title: string,
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
    const doc = new PDFDocument({ margin: 0, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    const PAGE_WIDTH = doc.page.width as number;
    const PAGE_HEIGHT = doc.page.height as number;
    const ML = 85;   // 3cm
    const MR = 57;   // 2cm
    const MT = 71;    // 2.5cm
    const MB = 57;    // 2cm
    const CW = PAGE_WIDTH - ML - MR;

    const BLACK = '#000000';
    const GRAY = '#6B7280';
    const BORDER = '#374151';

    let y = MT;
    let pageNum = 1;

    const checkPageBreak = (needed: number) => {
      if (y + needed > PAGE_HEIGHT - MB) { doc.addPage(); y = MT; pageNum++; }
    };

    const addPageNumber = () => {
      doc.font("Helvetica").fontSize(9).fillColor(GRAY);
      doc.text(`Halaman ${pageNum}`, ML, PAGE_HEIGHT - MB + 10, { align: "center", width: CW });
      doc.fillColor(BLACK);
    };
    addPageNumber();
    // @ts-ignore
    doc.on("pageAdded", () => { pageNum++; addPageNumber(); });

    // === KOP SEKOLAH ===
    if (namaSekolah) {
      if (logoUrl) {
        try { doc.image(logoUrl, ML, y, { fit: [50, 50], align: 'center' }); } catch (_) {}
      }
      const nameX = logoUrl ? ML + 65 : ML;
      doc.font("Helvetica-Bold").fontSize(15).fillColor(BLACK);
      doc.text(namaSekolah.toUpperCase(), nameX, y + 8, {
        width: CW - (logoUrl ? 65 : 0), align: 'center',
      });
      y += 28;
      if (alamat) {
        doc.font("Helvetica").fontSize(9).fillColor(GRAY);
        doc.text(alamat, ML, y, { width: CW, align: 'center' });
        y += 13;
      }
      if (npsn) {
        doc.font("Helvetica").fontSize(9).fillColor(GRAY);
        doc.text(`NPSN: ${npsn}`, ML, y, { width: CW, align: 'center' });
        y += 13;
      }
      y += 6;
      doc.moveTo(ML, y).lineTo(PAGE_WIDTH - MR, y).lineWidth(2).stroke(BORDER);
      y += 4;
      doc.moveTo(ML, y).lineTo(PAGE_WIDTH - MR, y).lineWidth(1).stroke(BORDER);
      y += 18;
    }

    // Document title
    doc.font("Helvetica-Bold").fontSize(18).fillColor(BLACK);
    doc.text(title, ML, y, { width: CW, align: "center" });
    y += 30;

    // Process markdown lines
    const lines = markdown.split("\n");
    for (const line of lines) {
      const text = line.trim();
      if (!text) {
        y += 8;
        continue;
      }
      if (text.startsWith("# ")) {
        checkPageBreak(24);
        doc.font("Helvetica-Bold").fontSize(14).fillColor(BLACK);
        doc.text(text.substring(2), ML, y);
        y += 20;
      } else if (text.startsWith("## ")) {
        checkPageBreak(20);
        doc.font("Helvetica-Bold").fontSize(11).fillColor(BLACK);
        doc.text(text.substring(3), ML, y);
        y += 16;
      } else if (text.startsWith("### ")) {
        checkPageBreak(16);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(BLACK);
        doc.text(text.substring(4), ML, y);
        y += 14;
      } else if (text.startsWith("- ") || text.startsWith("* ")) {
        checkPageBreak(16);
        doc.font("Helvetica").fontSize(9).fillColor(BLACK);
        doc.text("• " + truncateText(text.substring(2), 100), ML, y);
        y += 14;
      } else if (text.startsWith("|")) {
        // Table row - just render as text for now
        checkPageBreak(14);
        doc.font("Helvetica").fontSize(9).fillColor(BLACK);
        const clean = text.replace(/\|/g, '  ').trim();
        doc.text(clean, ML, y);
        y += 14;
      } else {
        checkPageBreak(16);
        const cleanText = text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
        doc.font("Helvetica").fontSize(9).fillColor(BLACK);
        doc.text(truncateText(cleanText, 500), ML, y, { width: CW, align: "justify" });
        y += 14;
      }
    }

    // === SIGNATURE BLOCK ===
    if (kepalaNama || guruNama) {
      checkPageBreak(100);
      y += 8;
      const sigColW = CW / 2 - 10;
      const sigDate = tanggal
        ? new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      // Left: Kepala Sekolah
      doc.font("Helvetica").fontSize(10).fillColor(BLACK);
      doc.text(`${lokasi || ''}, ${sigDate}`, ML, y, { width: sigColW });
      y += 16;
      doc.text("Kepala Sekolah,", ML, y, { width: sigColW });
      y += 52;
      if (kepalaSignatureUrl) {
        try { doc.image(kepalaSignatureUrl, ML, y - 52, { fit: [120, 52], align: 'left' }); } catch (_) {}
      }
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BLACK);
      doc.text(kepalaNama || '_____________________', ML, y, { width: sigColW });
      y += 14;
      doc.font("Helvetica").fontSize(9).fillColor(GRAY);
      doc.text(`NIP. ${kepalaNip || '_____________________'}`);
      y -= 52 + 16 + 14;

      // Right: Guru
      const rx = ML + sigColW + 20;
      doc.font("Helvetica").fontSize(10).fillColor(BLACK);
      doc.text(`${lokasi || ''}, ${sigDate}`, rx, y, { width: sigColW });
      y += 16;
      doc.text("Guru,", rx, y, { width: sigColW });
      y += 52;
      if (guruSignatureUrl) {
        try { doc.image(guruSignatureUrl, rx, y - 52, { fit: [120, 52], align: 'left' }); } catch (_) {}
      }
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BLACK);
      doc.text(guruNama || '_____________________', rx, y, { width: sigColW });
      y += 14;
      doc.font("Helvetica").fontSize(9).fillColor(GRAY);
      doc.text(`NIP. ${guruNip || '_____________________'}`);
    }

    // Footer
    doc.font("Helvetica").fontSize(8).fillColor(GRAY);
    doc.text("Dokumen ini dihasilkan oleh GuruPRO AI", ML, PAGE_HEIGHT - MB + 10, { align: "center", width: CW });

    doc.end();
  });
}

/**
 * Generate DOC (Word-compatible HTML) buffer
 */
export function generateDocBuffer(
  markdown: string,
  title: string,
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
): Buffer {
  const opts = options || {};
  const {
    logoUrl, namaSekolah, alamat, npsn,
    kepalaNama, kepalaNip, guruNama, guruNip,
    guruSignatureUrl, kepalaSignatureUrl, lokasi, tanggal,
  } = opts;

  let bodyHtml = markdown
    .replace(/^### (.+)$/gm, '<h3 style="font-family: Arial, sans-serif; font-size: 13pt; color: #333333; margin-top: 10pt; margin-bottom: 4pt;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-family: Arial, sans-serif; font-size: 15pt; color: #1E3A8A; margin-top: 16pt; margin-bottom: 6pt; border-bottom: 1px solid #CCCCCC; padding-bottom: 2pt;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-family: Arial, sans-serif; font-size: 18pt; color: #1E3A8A; text-align: center; margin-top: 20pt; margin-bottom: 10pt; text-transform: uppercase;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="font-family: Arial, sans-serif; font-size: 11pt; color: #334155; margin-left: 20pt; margin-bottom: 3pt;">$1</li>')
    .replace(/\n\n/g, "</p><p style='font-family: Arial, sans-serif; font-size: 11pt; color: #334155; line-height: 1.5; text-align: justify; margin-bottom: 6pt;'>")
    .replace(/\n/g, "<br>");

  // Handle markdown tables with word-wrap
  bodyHtml = bodyHtml.replace(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g, (match: string, header: string, body: string) => {
    const headerCells = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th style="border: 1px solid #333333; padding: 6pt; background-color: #f0f0f0; font-weight: bold; text-align: center;">${c.trim()}</th>`).join('');
    const headerRow = `<tr>${headerCells}</tr>`;
    const bodyRows = body.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string | undefined) => c !== undefined).slice(1, -1).map((c: string) => `<td style="border: 1px solid #333333; padding: 6pt; word-wrap: break-word; overflow-wrap: break-word;">${truncateText(c.trim(), 100)}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table style="width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 10pt; table-layout: fixed;">${headerRow}${bodyRows}</table>`;
  });

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

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>${title}</title>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        td { word-wrap: break-word; overflow-wrap: break-word; }
        p { word-wrap: break-word; overflow-wrap: break-word; }
      </style>
    </head>
    <body style="padding: 40px; font-family: Arial, sans-serif;">
      ${kopHtml}
      ${bodyHtml}
      ${signatureHtml}
    </body>
    </html>
  `;
  return Buffer.from(html, "utf-8");
}

// ============================================
// LKPD EXPORT TEMPLATES
// Lembar Kerja Peserta Didik - Print Ready
// ============================================

/**
 * Generate print-ready PDF for structured LKPD
 * With robust overflow handling
 */
export async function generateLkpdPdfBuffer(
  lkpdData: LKPDOutput,
  title: string,
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
    const doc = new PDFDocument({ margin: 0, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    const PAGE_WIDTH = doc.page.width as number;
    const PAGE_HEIGHT = doc.page.height as number;
    const ML = 85;   // 3cm left
    const MR = 57;   // 2cm right
    const MT = 71;    // 2.5cm top
    const MB = 57;    // 2cm bottom
    const CW = PAGE_WIDTH - ML - MR;

    const BLACK = '#000000';
    const GRAY = '#6B7280';
    const BORDER = '#374151';

    let y = MT;
    let pageNum = 1;

    const checkPageBreak = (needed: number) => {
      if (y + needed > PAGE_HEIGHT - MB) { doc.addPage(); y = MT; pageNum++; }
    };

    const addPageNumber = () => {
      doc.font("Helvetica").fontSize(9).fillColor(GRAY);
      doc.text(`Halaman ${pageNum}`, ML, PAGE_HEIGHT - MB + 10, { align: "center", width: CW });
      doc.fillColor(BLACK);
    };
    addPageNumber();
    // @ts-ignore
    doc.on("pageAdded", () => { pageNum++; addPageNumber(); });

    // === KOP SEKOLAH ===
    if (namaSekolah) {
      if (logoUrl) {
        try { doc.image(logoUrl, ML, y, { fit: [50, 50], align: 'center' }); } catch (_) {}
      }
      const nameX = logoUrl ? ML + 65 : ML;
      doc.font("Helvetica-Bold").fontSize(15).fillColor(BLACK);
      doc.text(namaSekolah.toUpperCase(), nameX, y + 8, {
        width: CW - (logoUrl ? 65 : 0), align: 'center',
      });
      y += 28;
      if (alamat) {
        doc.font("Helvetica").fontSize(9).fillColor(GRAY);
        doc.text(alamat, ML, y, { width: CW, align: 'center' });
        y += 13;
      }
      if (npsn) {
        doc.font("Helvetica").fontSize(9).fillColor(GRAY);
        doc.text(`NPSN: ${npsn}`, ML, y, { width: CW, align: 'center' });
        y += 13;
      }
      y += 6;
      doc.moveTo(ML, y).lineTo(PAGE_WIDTH - MR, y).lineWidth(2).stroke(BORDER);
      y += 4;
      doc.moveTo(ML, y).lineTo(PAGE_WIDTH - MR, y).lineWidth(1).stroke(BORDER);
      y += 18;
    }

    // Document title
    doc.font("Helvetica-Bold").fontSize(14).fillColor(BLACK);
    doc.text("LEMBAR KERJA PESERTA DIDIK (LKPD)", ML, y, { width: CW, align: "center" });
    y += 22;

    const { identitas, petunjukPengerjaan, tujuanKegiatan, aktivitas, refleksiSingkat } = lkpdData;

    // Identitas
    doc.font("Helvetica").fontSize(10).fillColor(BLACK);
    doc.text(`Mata Pelajaran : ${truncateText(identitas.mataPelajaran, 50)}`, ML, y);
    y += 14;
    doc.text(`Fase           : ${identitas.fase}`, ML, y);
    y += 14;
    doc.text(`Topik          : ${truncateText(identitas.topik, 60)}`, ML, y);
    y += 20;

    // Name/Group fields
    doc.font("Helvetica").fontSize(10).fillColor(BLACK);
    doc.text(`Nama Siswa     : ________________________`, ML, y);
    y += 14;
    doc.text(`Kelas          : ________     Kelompok     : ________`, ML, y);
    y += 24;

    // Divider
    doc.moveTo(ML, y).lineTo(PAGE_WIDTH - MR, y).stroke(BORDER);
    y += 18;

    // Tujuan Kegiatan
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLACK);
    doc.text("TUJUAN KEGIATAN", ML, y);
    y += 14;
    doc.font("Helvetica").fontSize(10).fillColor(BLACK);
    doc.text(truncateText(tujuanKegiatan, 280), ML, y, { width: CW, align: "justify" });
    y += 24;

    // Petunjuk Pengerjaan
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLACK);
    doc.text("PETUNJUK PENGERJAAN", ML, y);
    y += 14;
    doc.font("Helvetica").fontSize(10).fillColor(BLACK);
    petunjukPengerjaan.forEach((petunjuk, idx) => {
      checkPageBreak(16);
      doc.text(`${idx + 1}. ${truncateText(petunjuk, 140)}`, ML, y);
      y += 14;
    });
    y += 10;

    // Aktivitas
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLACK);
    doc.text("AKTIVITAS", ML, y);
    y += 14;

    aktivitas.forEach((act: Aktivitas) => {
      checkPageBreak(40);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BLACK);
      doc.text(`Aktivitas ${act.nomor} - ${act.tahap === 'memahami' ? 'MEMAHAMI' : 'MENGAPLIKASI'}`, ML, y);
      y += 14;
      doc.font("Helvetica").fontSize(10).fillColor(BLACK);
      doc.text(truncateText(act.instruksi, 380), ML, y, { width: CW, align: "justify" });
      y += 14;
      renderAktivitasSpace(doc, act, ML, PAGE_WIDTH - MR);
      y += 6;
    });

    // Refleksi Singkat
    if (refleksiSingkat.length > 0) {
      checkPageBreak(60);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(BLACK);
      doc.text("REFLEKSI DIRI", ML, y);
      y += 14;
      refleksiSingkat.forEach((refleksi, idx) => {
        checkPageBreak(40);
        doc.font("Helvetica").fontSize(10).fillColor(BLACK);
        doc.text(`${idx + 1}. ${truncateText(refleksi, 190)}`, ML, y);
        y += 14;
        for (let i = 0; i < 3; i++) {
          checkPageBreak(12);
          doc.moveTo(ML, y).lineTo(PAGE_WIDTH - MR, y).stroke(BORDER);
          y += 14;
        }
        y += 6;
      });
    }

    // === SIGNATURE BLOCK ===
    if (kepalaNama || guruNama) {
      checkPageBreak(100);
      y += 8;
      const sigColW = CW / 2 - 10;
      const sigDate = tanggal
        ? new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      // Left: Kepala Sekolah
      doc.font("Helvetica").fontSize(10).fillColor(BLACK);
      doc.text(`${lokasi || ''}, ${sigDate}`, ML, y, { width: sigColW });
      y += 16;
      doc.text("Kepala Sekolah,", ML, y, { width: sigColW });
      y += 52;
      if (kepalaSignatureUrl) {
        try { doc.image(kepalaSignatureUrl, ML, y - 52, { fit: [120, 52], align: 'left' }); } catch (_) {}
      }
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BLACK);
      doc.text(kepalaNama || '_____________________', ML, y, { width: sigColW });
      y += 14;
      doc.font("Helvetica").fontSize(9).fillColor(GRAY);
      doc.text(`NIP. ${kepalaNip || '_____________________'}`);
      y -= 52 + 16 + 14;

      // Right: Guru
      const rx = ML + sigColW + 20;
      doc.font("Helvetica").fontSize(10).fillColor(BLACK);
      doc.text(`${lokasi || ''}, ${sigDate}`, rx, y, { width: sigColW });
      y += 16;
      doc.text("Guru,", rx, y, { width: sigColW });
      y += 52;
      if (guruSignatureUrl) {
        try { doc.image(guruSignatureUrl, rx, y - 52, { fit: [120, 52], align: 'left' }); } catch (_) {}
      }
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BLACK);
      doc.text(guruNama || '_____________________', rx, y, { width: sigColW });
      y += 14;
      doc.font("Helvetica").fontSize(9).fillColor(GRAY);
      doc.text(`NIP. ${guruNip || '_____________________'}`);
    }

    // Footer
    doc.font("Helvetica").fontSize(8).fillColor(GRAY);
    doc.text("Dokumen ini dihasilkan oleh GuruPRO AI", ML, PAGE_HEIGHT - MB + 10, { align: "center", width: CW });

    doc.end();
  });
}

/**
 * Render answer space based on jenisRespon
 */
function renderAktivitasSpace(doc: any, act: Aktivitas, ml: number, mr: number) {
  const ruangJawabanBaris = act.ruangJawabanBaris || 3;
  const pageWidth = mr - ml;

  switch (act.jenisRespon) {
    case "isian_singkat":
      // Short answer - dots
      for (let i = 0; i < Math.min(ruangJawabanBaris, 3); i++) {
        doc.text("_______________________________________________", ml, doc.y);
        doc.moveDown(0.1);
      }
      break;

    case "uraian":
      // Paragraph - lines
      for (let i = 0; i < ruangJawabanBaris; i++) {
        doc.moveTo(ml, doc.y).lineTo(mr, doc.y).stroke();
        doc.moveDown(0.35);
      }
      break;

    case "tabel":
      // Table - draw grid
      const rows = Math.min(ruangJawabanBaris + 1, 6);
      const cols = 3;
      const cellWidth = (pageWidth - ml) / cols;
      const cellHeight = 25;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = ml + c * cellWidth;
          const y = doc.y + r * cellHeight;
          doc.rect(x, y, cellWidth, cellHeight).stroke();
          if (r === 0) {
            // Header row
            doc.font("Helvetica-Bold").fontSize(8).text(getTableHeader(c), x + 2, y + 8);
          }
        }
      }
      doc.moveDown(rows * cellHeight / 12 + 0.3);
      break;

    case "gambar_diagram":
      // Box for drawing
      doc.rect(ml, doc.y, pageWidth - ml, 120).stroke();
      doc.font("Helvetica").fontSize(8).text("(Ruang menggambar/membuat diagram)", ml, doc.y + 50, { width: pageWidth - ml, align: "center" });
      doc.moveDown(10);
      break;

    case "checklist":
      // Checkbox list
      for (let i = 0; i < ruangJawabanBaris; i++) {
        doc.rect(ml, doc.y - 3, 8, 8).stroke();
        doc.text("_______________________________________________");
        doc.moveDown(0.3);
      }
      break;
  }
}

/**
 * Get table header based on column index
 */
function getTableHeader(col: number): string {
  const headers = ["Pernyataan/Item", "Ya", "Tidak/Keterangan"];
  return headers[col] || "";
}

/**
 * Generate DOCX buffer for structured LKPD
 * With robust overflow handling and word-wrap
 */
export function generateLkpdDocBuffer(
  lkpdData: LKPDOutput,
  title: string,
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
): Buffer {
  const opts = options || {};
  const {
    logoUrl, namaSekolah, alamat, npsn,
    kepalaNama, kepalaNip, guruNama, guruNip,
    guruSignatureUrl, kepalaSignatureUrl, lokasi, tanggal,
  } = opts;

  const { identitas, petunjukPengerjaan, tujuanKegiatan, aktivitas, refleksiSingkat } = lkpdData;

  const aktivitasHtml = aktivitas.map((act: Aktivitas) => {
    const spaceHtml = generateAktivitasSpaceHtml(act);
    return `
      <div style="margin-bottom: 15pt;">
        <p style="font-family: Arial, sans-serif; font-size: 11pt; font-weight: bold;">Aktivitas ${act.nomor} - ${act.tahap === 'memahami' ? 'MEMAHAMI' : 'MENGAPLIKASI'}</p>
        <p style="font-family: Arial, sans-serif; font-size: 10pt; word-wrap: break-word; overflow-wrap: break-word;">${truncateText(act.instruksi, 380)}</p>
        ${spaceHtml}
      </div>
    `;
  }).join('');

  const refleksiHtml = refleksiSingkat.length > 0 ? `
    <div style="page-break-before: always;">
      <h3 style="font-family: Arial, sans-serif; font-size: 12pt; border-bottom: 1px solid #333;">REFLEKSI DIRI</h3>
      ${refleksiSingkat.map((r, i) => `
        <p style="font-family: Arial, sans-serif; font-size: 10pt; word-wrap: break-word; overflow-wrap: break-word;">${i + 1}. ${truncateText(r, 190)}</p>
        <p style="font-family: Arial, sans-serif; font-size: 10pt; color: #666;">Jawaban: _________________________________________________________________</p>
        <p style="font-family: Arial, sans-serif; font-size: 10pt; color: #666;">_________________________________________________________________</p>
      `).join('')}
    </div>
  ` : '';

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

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>${title}</title>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        td { word-wrap: break-word; overflow-wrap: break-word; }
        p { word-wrap: break-word; overflow-wrap: break-word; }
      </style>
    </head>
    <body style="padding: 40px; font-family: Arial, sans-serif;">
      ${kopHtml}

      <h1 style="font-family: Arial, sans-serif; font-size: 16pt; text-align: center; margin-bottom: 10pt;">
        LEMBAR KERJA PESERTA DIDIK (LKPD)
      </h1>

      <table style="font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 15pt; table-layout: fixed;">
        <tr>
          <td style="padding: 3pt; width: 100px;">Mata Pelajaran</td>
          <td style="padding: 3pt;">:</td>
          <td style="padding: 3pt; word-wrap: break-word;">${truncateText(identitas.mataPelajaran, 50)}</td>
        </tr>
        <tr>
          <td style="padding: 3pt;">Fase</td>
          <td style="padding: 3pt;">:</td>
          <td style="padding: 3pt;">${identitas.fase}</td>
        </tr>
        <tr>
          <td style="padding: 3pt;">Topik</td>
          <td style="padding: 3pt;">:</td>
          <td style="padding: 3pt; word-wrap: break-word;">${truncateText(identitas.topik, 60)}</td>
        </tr>
        <tr>
          <td style="padding: 3pt;">Nama Siswa</td>
          <td style="padding: 3pt;">:</td>
          <td style="padding: 3pt;">________________________________</td>
          <td style="padding: 3pt 10pt;">Kelas</td>
          <td style="padding: 3pt;">:</td>
          <td style="padding: 3pt;">___________</td>
        </tr>
        <tr>
          <td style="padding: 3pt;">Kelompok</td>
          <td style="padding: 3pt;">:</td>
          <td style="padding: 3pt;">___________</td>
        </tr>
      </table>

      <hr style="border: 1px solid #333; margin: 10pt 0;">

      <h3 style="font-family: Arial, sans-serif; font-size: 12pt;">TUJUAN KEGIATAN</h3>
      <p style="font-family: Arial, sans-serif; font-size: 10pt; text-align: justify; word-wrap: break-word; overflow-wrap: break-word;">${truncateText(tujuanKegiatan, 280)}</p>

      <h3 style="font-family: Arial, sans-serif; font-size: 12pt;">PETUNJUK PENGERJAAN</h3>
      <ol style="font-family: Arial, sans-serif; font-size: 10pt;">
        ${petunjukPengerjaan.map(p => `<li style="margin-bottom: 5pt; word-wrap: break-word; overflow-wrap: break-word;">${truncateText(p, 140)}</li>`).join('')}
      </ol>

      <h3 style="font-family: Arial, sans-serif; font-size: 12pt;">AKTIVITAS</h3>
      ${aktivitasHtml}

      ${refleksiHtml}

      ${signatureHtml}

      <div style="text-align: center; margin-top: 20pt; font-family: Arial, sans-serif; font-size: 8pt; color: #666;">
        LKPD ini dirancang untuk aktivitas belajar kelompok
      </div>
      <div style="position: fixed; bottom: 1.5cm; right: 2cm; font-size: 9pt; color: #666;">Halaman <span style="mso-field-code:' PAGE \\* MERGEFORMAT '"></span> dari <span style="mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span></div>
    </body>
    </html>
  `;

  return Buffer.from(html, "utf-8");
}

/**
 * Generate HTML for activity response space
 */
function generateAktivitasSpaceHtml(act: Aktivitas): string {
  const ruangJawabanBaris = act.ruangJawabanBaris || 3;

  switch (act.jenisRespon) {
    case "isian_singkat":
      return Array(Math.min(ruangJawabanBaris, 3))
        .fill('<p style="font-family: Arial, sans-serif; font-size: 10pt; color: #666;">_______________________________________________</p>')
        .join('');

    case "uraian":
      return Array(ruangJawabanBaris)
        .fill('<p style="font-family: Arial, sans-serif; font-size: 10pt; color: #666; border-bottom: 1px solid #999; margin: 5pt 0;">&nbsp;</p>')
        .join('');

    case "tabel":
      const rows = Math.min(ruangJawabanBaris + 1, 6);
      const cols = 3;
      const headers = ["Pernyataan/Item", "Ya", "Tidak/Keterangan"];
      let tableHtml = `<table style="width: 100%; border-collapse: collapse; font-size: 9pt;">`;
      // Header
      tableHtml += `<tr>${headers.map(h => `<th style="border: 1px solid #333; padding: 5pt; background: #f0f0f0;">${h}</th>`).join('')}</tr>`;
      // Rows
      for (let i = 0; i < rows - 1; i++) {
        tableHtml += `<tr>${Array(cols).fill('<td style="border: 1px solid #333; padding: 15pt;">&nbsp;</td>').join('')}</tr>`;
      }
      tableHtml += `</table>`;
      return tableHtml;

    case "gambar_diagram":
      return `<div style="border: 1px solid #333; width: 100%; height: 120pt; display: flex; align-items: center; justify-content: center; font-family: Arial, sans-serif; font-size: 9pt; color: #666;">Ruang menggambar/membuat diagram</div>`;

    case "checklist":
      return Array(ruangJawabanBaris)
        .fill('<p style="font-family: Arial, sans-serif; font-size: 10pt;">&#9744; ________________________________________________________________</p>')
        .join('');

    default:
      return '';
  }
}

// ============================================
// LAPORAN EVALUASI LKPD EXPORT TEMPLATES
// Evaluation Report for School Leadership
// Amber highlight for ringkasan eksekutif (different from Violet planning docs)
// ============================================

const AMBER = "#F59E0B";
const AMBER_LIGHT = "#FEF3C7";
const GREEN = "#22C55E";
const BLUE = "#3B82F6";
const YELLOW = "#EAB308";
const RED = "#EF4444";

/**
 * Generate print-ready PDF for Laporan Evaluasi LKPD
 * Designed for Principal/Vice Principal consumption
 */
export async function generateLaporanEvaluasiPdfBuffer(
  data: LaporanEvaluasiLkpdOutput,
  title: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    const { identitas, ringkasanEksekutif, capaianPerKKTP, temuanUtama, siswaPerluPerhatian, rekomendasiTindakLanjut } = data;

    doc.font("Helvetica-Bold").fontSize(16).text("LAPORAN EVALUASI LKPD", { align: "center" });
    doc.font("Helvetica").fontSize(11).text("Untuk perhatian Bapak/Ibu Kepala Sekolah/Wakasek", { align: "center" });
    doc.moveDown(1);

    // Identitas Table
    doc.font("Helvetica-Bold").fontSize(10).text("A. IDENTITAS");
    doc.moveDown(0.3);

    const identityData = [
      ["Mata Pelajaran", ":", identitas.mataPelajaran],
      ["Kelas", ":", identitas.kelas],
      ["Periode Evaluasi", ":", identitas.periodeEvaluasi],
      ["Jumlah Siswa", ":", String(identitas.jumlahSiswa)],
      ["Guru Pengampu", ":", identitas.guruPengampu || "Tidak diketahui"],
    ];

    doc.font("Helvetica").fontSize(10);
    identityData.forEach(([label, sep, value]) => {
      doc.text(`${label} ${sep} ${value}`);
    });

    doc.moveDown(1);

    // Ringkasan Eksekutif - Highlight Box (Amber) with auto-height
    doc.font("Helvetica-Bold").fontSize(11).fillColor(AMBER).text("B. RINGKASAN EKSEKUTIF");
    doc.fillColor("black");
    doc.moveDown(0.3);

    // Truncate ringkasan to safe length before rendering
    const safeRingkasan = truncateText(ringkasanEksekutif, 480);

    // Calculate approximate height needed
    const boxHeight = Math.max(60, Math.min(100, 40 + (safeRingkasan.length / 3)));

    // Draw amber box with auto-height
    const boxY = doc.y;
    doc.rect(50, boxY, 510, boxHeight).fill(AMBER_LIGHT);
    doc.font("Helvetica").fontSize(10).text(safeRingkasan, 55, boxY + 5, {
      width: 500,
      height: boxHeight - 10,
      align: "left",
    });
    doc.y = boxY + boxHeight + 10;
    doc.moveDown(1);

    // Capaian per KKTP Table
    doc.font("Helvetica-Bold").fontSize(11).text("C. CAPAIAN PER KKTP");
    doc.moveDown(0.3);

    // Table header
    const tableTop = doc.y;
    const colWidths = [250, 100, 160];
    const rowHeight = 20;

    // Header row
    doc.rect(50, tableTop, colWidths[0], rowHeight).stroke();
    doc.rect(50 + colWidths[0], tableTop, colWidths[1], rowHeight).stroke();
    doc.rect(50 + colWidths[0] + colWidths[1], tableTop, colWidths[2], rowHeight).stroke();

    doc.font("Helvetica-Bold").fontSize(9).text("KKTP", 52, tableTop + 6);
    doc.text("% Tuntas", 50 + colWidths[0] + 10, tableTop + 6);
    doc.text("Kategori", 50 + colWidths[0] + colWidths[1] + 10, tableTop + 6);

    // Data rows with truncation
    let rowY = tableTop + rowHeight;
    capaianPerKKTP.forEach((capaian, idx) => {
      const bgColor = idx % 2 === 0 ? "#F9FAFB" : "white";

      doc.rect(50, rowY, colWidths[0], rowHeight).stroke();
      doc.rect(50 + colWidths[0], rowY, colWidths[1], rowHeight).stroke();
      doc.rect(50 + colWidths[0] + colWidths[1], rowY, colWidths[2], rowHeight).stroke();

      // Fill row background
      doc.rect(50, rowY, 510, rowHeight).fill(bgColor);

      // Truncate kktp for display
      const safeKktp = truncateText(capaian.kktp, 45);
      doc.font("Helvetica").fontSize(9).text(safeKktp, 52, rowY + 6, { width: colWidths[0] - 5, ellipsis: true });
      doc.text(formatPersentase(capaian.persentaseTuntas), 50 + colWidths[0] + 10, rowY + 6);

      // Color-coded category
      const colorMap: Record<string, string> = {
        sangat_baik: GREEN,
        baik: BLUE,
        cukup: YELLOW,
        perlu_perhatian: RED,
      };
      doc.fillColor(colorMap[capaian.kategoriCapaian] || "black")
        .text(getKategoriLabel(capaian.kategoriCapaian), 50 + colWidths[0] + colWidths[1] + 10, rowY + 6);
      doc.fillColor("black");

      rowY += rowHeight;
    });

    doc.y = rowY + 15;
    doc.moveDown(0.5);

    // Temuan Utama
    if (temuanUtama.length > 0) {
      doc.font("Helvetica-Bold").fontSize(11).text("D. TEMUAN UTAMA");
      doc.moveDown(0.3);

      doc.font("Helvetica").fontSize(10);
      temuanUtama.forEach((temuan, idx) => {
        doc.text(`${idx + 1}. ${temuan}`);
        doc.moveDown(0.2);
      });
      doc.moveDown(0.5);
    }

    // Siswa Perlu Perhatian
    if (siswaPerluPerhatian) {
      doc.font("Helvetica-Bold").fontSize(11).text("E. SISWA PERLU PERHATIAN");
      doc.moveDown(0.3);

      doc.font("Helvetica").fontSize(10);
      doc.text(`Jumlah siswa yang perlu perhatian khusus: ${siswaPerluPerhatian.jumlahSiswaTerdampak} siswa`);
      doc.text(`Catatan: ${siswaPerluPerhatian.catatan}`);
      doc.moveDown(0.5);
    }

    // Rekomendasi Tindak Lanjut
    doc.font("Helvetica-Bold").fontSize(11).text("F. REKOMENDASI TINDAK LANJUT");
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(10);
    rekomendasiTindakLanjut.forEach((rekomendasi, idx) => {
      doc.text(`${idx + 1}. ${rekomendasi}`);
      doc.moveDown(0.2);
    });

    doc.moveDown(1.5);

    // Page counter for numbering
    let pageNum = 1;
    // @ts-ignore - PDFKit custom event
    doc.on('pageAdded', () => { pageNum++; });

    // Footer per page
    const addFooter = () => {
      const bottomY = doc.page.height - 30;
      doc.font("Helvetica").fontSize(8).fillColor("gray");
      doc.text(`Halaman ${pageNum} | Dokumen ini dihasilkan oleh GuruPRO AI`, 50, bottomY, {
        width: 510,
        align: "center",
      });
      doc.fillColor("black");
    };
    addFooter();

    // Signature section
    const sigY = doc.y;
    doc.text("_______________________________", 350, sigY);
    doc.moveDown(0.3);
    doc.text("Guru Pengampu", 350, sigY + 20);

    doc.text("_______________________________", 50, sigY);
    doc.moveDown(0.3);
    doc.text("Kepala Sekolah / Wakasek", 50, sigY + 20);

    // Footer
    doc.moveDown(2);
    doc.font("Helvetica").fontSize(8).fillColor("gray");
    doc.text("Dokumen ini dihasilkan oleh GuruPRO AI", { align: "center" });

    doc.end();
  });
}

/**
 * Generate DOCX buffer for Laporan Evaluasi LKPD
 */
export function generateLaporanEvaluasiDocBuffer(
  data: LaporanEvaluasiLkpdOutput,
  title: string
): Buffer {
  const { identitas, ringkasanEksekutif, capaianPerKKTP, temuanUtama, siswaPerluPerhatian, rekomendasiTindakLanjut } = data;

  // Build table rows with truncation
  const tableRows = capaianPerKKTP.map((capaian) => {
    const colorStyle = getKategoriColorStyle(capaian.kategoriCapaian);
    const safeKktp = truncateText(capaian.kktp, 45);
    return `
      <tr>
        <td style="border: 1px solid #333; padding: 8pt; font-size: 9pt; word-wrap: break-word; overflow-wrap: break-word;">${safeKktp}</td>
        <td style="border: 1px solid #333; padding: 8pt; font-size: 9pt; text-align: center;">${formatPersentase(capaian.persentaseTuntas)}</td>
        <td style="border: 1px solid #333; padding: 8pt; font-size: 9pt; ${colorStyle}">${getKategoriLabel(capaian.kategoriCapaian)}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>${title}</title>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { font-size: 16pt; text-align: center; color: #1E3A8A; }
        h2 { font-size: 12pt; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 4pt; margin-top: 16pt; }
        h3 { font-size: 11pt; color: #333; }
        .highlight-box { background-color: #FEF3C7; border: 2px solid #F59E0B; padding: 12pt; margin: 12pt 0; }
        table { width: 100%; border-collapse: collapse; margin: 12pt 0; table-layout: fixed; }
        th { background-color: #1E3A8A; color: white; border: 1px solid #333; padding: 8pt; font-size: 9pt; text-align: center; }
        td { border: 1px solid #333; padding: 8pt; font-size: 9pt; word-wrap: break-word; overflow-wrap: break-word; }
        td.kategori { word-wrap: break-word; }
        p { word-wrap: break-word; overflow-wrap: break-word; }
        .signature-section { margin-top: 40pt; }
        .sig-left { float: left; width: 45%; }
        .sig-right { float: right; width: 45%; text-align: center; }
        .footer { text-align: center; font-size: 8pt; color: #666; margin-top: 40pt; clear: both; }
        .category-sangat-baik { color: #22C55E; font-weight: bold; }
        .category-baik { color: #3B82F6; font-weight: bold; }
        .category-cukup { color: #EAB308; font-weight: bold; }
        .category-perlu-perhatian { color: #EF4444; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>LAPORAN EVALUASI LKPD</h1>
      <p style="text-align: center; color: #666; font-size: 10pt;">Untuk perhatian Bapak/Ibu Kepala Sekolah/Wakasek</p>

      <h2>A. IDENTITAS</h2>
      <table style="font-size: 10pt;">
        <tr><td style="border: none; padding: 3pt; width: 30%;">Mata Pelajaran</td><td style="border: none; padding: 3pt;">:</td><td style="border: none; padding: 3pt; word-wrap: break-word;">${identitas.mataPelajaran}</td></tr>
        <tr><td style="border: none; padding: 3pt;">Kelas</td><td style="border: none; padding: 3pt;">:</td><td style="border: none; padding: 3pt;">${identitas.kelas}</td></tr>
        <tr><td style="border: none; padding: 3pt;">Periode Evaluasi</td><td style="border: none; padding: 3pt;">:</td><td style="border: none; padding: 3pt;">${identitas.periodeEvaluasi}</td></tr>
        <tr><td style="border: none; padding: 3pt;">Jumlah Siswa</td><td style="border: none; padding: 3pt;">:</td><td style="border: none; padding: 3pt;">${identitas.jumlahSiswa}</td></tr>
        <tr><td style="border: none; padding: 3pt;">Guru Pengampu</td><td style="border: none; padding: 3pt;">:</td><td style="border: none; padding: 3pt;">${identitas.guruPengampu || "Tidak diketahui"}</td></tr>
      </table>

      <h2>B. RINGKASAN EKSEKUTIF</h2>
      <div class="highlight-box">
        <p style="font-size: 10pt; line-height: 1.5; word-wrap: break-word; overflow-wrap: break-word;">${truncateText(ringkasanEksekutif, 480)}</p>
      </div>

      <h2>C. CAPAIAN PER KKTP</h2>
      <table>
        <tr>
          <th style="width: 50%;">KKTP</th>
          <th style="width: 15%;">% Tuntas</th>
          <th style="width: 35%;">Kategori</th>
        </tr>
        ${tableRows}
      </table>

      ${temuanUtama.length > 0 ? `
        <h2>D. TEMUAN UTAMA</h2>
        <ol style="font-size: 10pt;">
          ${temuanUtama.map(t => `<li style="margin-bottom: 6pt; word-wrap: break-word; overflow-wrap: break-word;">${truncateText(t, 280)}</li>`).join('')}
        </ol>
      ` : ''}

      ${siswaPerluPerhatian ? `
        <h2>E. SISWA PERLU PERHATIAN</h2>
        <p style="font-size: 10pt;">Jumlah siswa yang perlu perhatian khusus: <strong>${siswaPerluPerhatian.jumlahSiswaTerdampak} siswa</strong></p>
        <p style="font-size: 10pt; word-wrap: break-word; overflow-wrap: break-word;">Catatan: ${truncateText(siswaPerluPerhatian.catatan, 480)}</p>
      ` : ''}

      <h2>F. REKOMENDASI TINDAK LANJUT</h2>
      <ol style="font-size: 10pt;">
        ${rekomendasiTindakLanjut.map(r => `<li style="margin-bottom: 6pt; word-wrap: break-word; overflow-wrap: break-word;">${truncateText(r, 240)}</li>`).join('')}
      </ol>

      <div class="signature-section">
        <div class="sig-left">
          <p>&nbsp;</p>
          <p>___________________________</p>
          <p>Kepala Sekolah / Wakasek</p>
        </div>
        <div class="sig-right">
          <p>___________________________</p>
          <p>Guru Pengampu</p>
        </div>
      </div>

      <div class="footer">
        <p>Dokumen ini dihasilkan oleh GuruPRO AI</p>
      </div>
    </body>
    </html>
  `;

  return Buffer.from(html, "utf-8");
}

/**
 * Get CSS style for kategori color
 */
function getKategoriColorStyle(kategori: CapaianPerKKTP['kategoriCapaian']): string {
  const styles: Record<CapaianPerKKTP['kategoriCapaian'], string> = {
    sangat_baik: 'color: #22C55E; font-weight: bold;',
    baik: 'color: #3B82F6; font-weight: bold;',
    cukup: 'color: #EAB308; font-weight: bold;',
    perlu_perhatian: 'color: #EF4444; font-weight: bold;',
  };
  return styles[kategori];
}
