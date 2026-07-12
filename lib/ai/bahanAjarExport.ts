/**
 * PPTX Export for Bahan Ajar v2 Slides
 * Using GuruPRO brand colors: Violet #7C3AED, Amber #F59E0B
 */

import pptxgen from "pptxgenjs";
import type { SlideOutputV2, SlideItem } from "./generateBahanAjar";

// Brand colors
const BRAND = {
  violet: "7C3AED",      // Primary - judul
  violetLight: "EDE9FE", // Background
  violetDark: "5B21B6",  // Text dark
  amber: "F59E0B",       // Accent
  amberLight: "FEF3C7",   // Accent background
  white: "FFFFFF",
  gray50: "F9FAFB",
  gray100: "F3F4F6",
  gray200: "E5E7EB",
  gray600: "4B5563",
  gray900: "111827",
} as const;

/**
 * Gaya visual options
 */
export type GayaVisual = "minimalis" | "ilustratif" | "akademis";

/**
 * Generate PPTX buffer from v2 Slide Output
 */
export async function generateSlidePptxV2(
  slidesData: SlideOutputV2,
  options?: {
    title?: string;
    gayaVisual?: GayaVisual;
    speakerNotes?: boolean;
  }
): Promise<Buffer> {
  const { title, gayaVisual = "minimalis", speakerNotes = true } = options || {};
  const pptx = new pptxgen();

  pptx.title = slidesData.judulPresentasi || title || "Bahan Ajar Slide";
  pptx.author = "GuruPRO AI";
  pptx.subject = "Slide Presentasi";

  // Get gaya visual config
  const config = getGayaVisualConfig(gayaVisual);

  // Cover slide
  const cover = pptx.addSlide();
  cover.background = { fill: BRAND.violet };

  cover.addText(slidesData.judulPresentasi, {
    x: 0.5,
    y: 2.0,
    w: 9.0,
    h: 1.5,
    fontSize: config.coverFontSize,
    bold: true,
    color: BRAND.white,
    fontFace: "Plus Jakarta Sans",
    align: "center",
  });

  cover.addText("GuruPRO AI", {
    x: 0.5,
    y: 3.8,
    w: 9.0,
    h: 0.5,
    fontSize: 14,
    color: BRAND.amber,
    fontFace: "Inter",
    align: "center",
  });

  // Content slides
  for (const slide of slidesData.slides) {
    const pptSlide = createSlideFromItem(pptx, slide, config);

    // Add speaker notes if enabled
    if (speakerNotes && slide.catatanPembicara) {
      pptSlide.addNotes(slide.catatanPembicara);
    }
  }

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}

/**
 * Create a slide from SlideItem based on gaya visual config
 */
function createSlideFromItem(
  pptx: InstanceType<typeof pptxgen>,
  slide: SlideItem,
  config: GayaVisualConfig
): InstanceType<typeof pptxgen.Slide> {
  const pptSlide = pptx.addSlide();

  // Background
  pptSlide.background = { fill: config.background };

  // Title bar (for some slide types)
  const showTitleBar = ["pembuka", "tujuan_pembelajaran", "penutup"].includes(slide.jenisSlide);
  if (showTitleBar) {
    pptSlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 1.2,
      fill: { fill: BRAND.violet },
    });

    // Title type label
    const jenisLabel = getJenisSlideLabel(slide.jenisSlide);
    pptSlide.addText(jenisLabel, {
      x: 0.5,
      y: 0.15,
      w: 9,
      h: 0.3,
      fontSize: 10,
      color: BRAND.amber,
      fontFace: "Inter",
    });

    // Title
    pptSlide.addText(slide.judulSlide, {
      x: 0.5,
      y: 0.45,
      w: 9,
      h: 0.65,
      fontSize: 22,
      bold: true,
      color: BRAND.white,
      fontFace: "Plus Jakarta Sans",
      valign: "middle",
    });
  } else {
    // Content slide - smaller title
    pptSlide.addText(slide.judulSlide, {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: BRAND.violet,
      fontFace: "Plus Jakarta Sans",
    });

    // Decorative line
    pptSlide.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y: 0.95,
      w: 2,
      h: 0.05,
      fill: { fill: BRAND.amber },
    });
  }

  // Content area
  const contentY = showTitleBar ? 1.5 : 1.2;
  const contentH = 4.5;

  // Bullet points
  if (slide.kontenPoin.length > 0) {
    const bulletItems = slide.kontenPoin.map((poin) => ({
      text: poin,
      options: {
        bullet: { type: "bullet" },
        color: config.textColor,
        fontSize: config.contentFontSize,
        fontFace: "Inter",
        paraSpaceAfter: 8,
      },
    }));

    pptSlide.addText(bulletItems as any, {
      x: 0.5,
      y: contentY,
      w: 9,
      h: contentH,
      valign: "top",
    });
  }

  // Visual suggestion box (for ilustratif gaya)
  if (config.showVisualSuggestions && slide.saranVisual) {
    pptSlide.addShape(pptx.ShapeType.rect, {
      x: 6.5,
      y: 4.5,
      w: 3,
      h: 1,
      fill: { fill: BRAND.amberLight },
      line: { color: BRAND.amber, width: 1 },
    });

    pptSlide.addText("💡 " + slide.saranVisual, {
      x: 6.6,
      y: 4.55,
      w: 2.8,
      h: 0.9,
      fontSize: 9,
      color: BRAND.gray600,
      fontFace: "Inter",
      italic: true,
      valign: "middle",
    });
  }

  // Slide number
  const slideNum = slide.nomor || 1;
  pptSlide.addText(`${slideNum}`, {
    x: 9.2,
    y: 5.2,
    w: 0.5,
    h: 0.3,
    fontSize: 10,
    color: BRAND.gray600,
    fontFace: "Inter",
    align: "right",
  });

  return pptSlide;
}

/**
 * Get label for jenis slide
 */
function getJenisSlideLabel(jenis: SlideItem["jenisSlide"]): string {
  const labels: Record<SlideItem["jenisSlide"], string> = {
    pembuka: "PEMBUKAAN",
    tujuan_pembelajaran: "TUJUAN PEMBELAJARAN",
    materi: "MATERI",
    contoh: "CONTOH",
    aktivitas: "AKTIVITAS",
    rangkuman: "RANGKUMAN",
    penutup: "PENUTUP",
  };
  return labels[jenis] || "SLIDE";
}

/**
 * Get config based on gaya visual
 */
function getGayaVisualConfig(gaya: GayaVisual): GayaVisualConfig {
  const configs: Record<GayaVisual, GayaVisualConfig> = {
    minimalis: {
      background: BRAND.white,
      textColor: BRAND.gray900,
      coverFontSize: 36,
      contentFontSize: 16,
      showVisualSuggestions: false,
    },
    ilustratif: {
      background: BRAND.gray50,
      textColor: BRAND.gray900,
      coverFontSize: 34,
      contentFontSize: 15,
      showVisualSuggestions: true,
    },
    akademis: {
      background: BRAND.white,
      textColor: BRAND.gray900,
      coverFontSize: 32,
      contentFontSize: 14,
      showVisualSuggestions: false,
    },
  };
  return configs[gaya];
}

interface GayaVisualConfig {
  background: string;
  textColor: string;
  coverFontSize: number;
  contentFontSize: number;
  showVisualSuggestions: boolean;
}

/**
 * Generate PDF buffer from v2 Handout
 */
export async function generateHandoutPdfV2(
  handoutData: any,
  options?: {
    versi?: "guru" | "siswa";
    title?: string;
  }
): Promise<Buffer> {
  // Import PDFDocument dynamically to avoid SSR issues
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    const versi = options?.versi || "siswa";

    // Header
    doc.font("Helvetica-Bold").fontSize(16).text(handoutData.judul || "Handout", { align: "center" });
    doc.moveDown(0.5);

    // Badge versi
    if (versi === "guru") {
      doc.font("Helvetica").fontSize(10).fillColor("7C3AED");
      doc.text("VERSI GURU - DENGAN KUNCI JAWABAN", { align: "center" });
      doc.fillColor("black");
    } else {
      doc.font("Helvetica").fontSize(10).fillColor("6B7280");
      doc.text("VERSI SISWA", { align: "center" });
      doc.fillColor("black");
    }
    doc.moveDown(1);

    // Ringkasan Materi
    doc.font("Helvetica-Bold").fontSize(12).text("RINGKASAN MATERI");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).text(handoutData.ringkasanMateri || "", {
      align: "justify",
    });
    doc.moveDown(1);

    // Poin Penting
    if (handoutData.poinPenting && handoutData.poinPenting.length > 0) {
      doc.font("Helvetica-Bold").fontSize(12).text("POIN PENTING");
      doc.moveDown(0.3);

      doc.font("Helvetica").fontSize(10);
      handoutData.poinPenting.forEach((poin: string, idx: number) => {
        doc.text(`${idx + 1}. ${poin}`);
      });
      doc.moveDown(1);
    }

    // Contoh Soal Latihan
    if (handoutData.contohSoalLatihan && handoutData.contohSoalLatihan.length > 0) {
      doc.font("Helvetica-Bold").fontSize(12).text("CONTOH SOAL LATIHAN");
      doc.moveDown(0.3);

      handoutData.contohSoalLatihan.forEach((soal: any, idx: number) => {
        // Soal box
        doc.font("Helvetica").fontSize(10).text(`${idx + 1}. ${soal.soal}`);

        // Kunci jawaban (hanya untuk versi guru)
        if (versi === "guru" && soal.kunciJawaban) {
          doc.font("Helvetica").fontSize(9).fillColor("7C3AED");
          doc.text(`   Kunci: ${soal.kunciJawaban}`);
          doc.fillColor("black");
        }

        // Jawaban placeholder (untuk versi siswa)
        if (versi === "siswa") {
          doc.font("Helvetica").fontSize(9).fillColor("9CA3AF");
          doc.text("   Jawaban: ________________________________");
          doc.fillColor("black");
        }

        doc.moveDown(0.3);
      });
    }

    // Referensi
    if (handoutData.referensiTambahan && handoutData.referensiTambahan.length > 0) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10).text("REFERENSI TAMBAHAN");
      doc.font("Helvetica").fontSize(9);
      handoutData.referensiTambahan.forEach((ref: string) => {
        doc.text(`- ${ref}`);
      });
    }

    // Footer
    doc.moveDown(2);
    doc.font("Helvetica").fontSize(8).fillColor("9CA3AF");
    doc.text("Dibuat dengan GuruPRO AI", { align: "center" });
    doc.text(`Versi: ${versi === "guru" ? "Guru" : "Siswa"}`, { align: "center" });

    doc.end();
  });
}

/**
 * Generate DOCX buffer from v2 Handout
 */
export function generateHandoutDocV2(
  handoutData: any,
  options?: {
    versi?: "guru" | "siswa";
    title?: string;
  }
): Buffer {
  const versi = options?.versi || "siswa";

  let soalHtml = "";
  handoutData.contohSoalLatihan?.forEach((soal: any, idx: number) => {
    soalHtml += `
      <div style="margin-bottom: 15pt;">
        <p style="font-family: Arial, sans-serif; font-size: 11pt;">${idx + 1}. ${escapeHtml(soal.soal)}</p>
        ${
          versi === "guru" && soal.kunciJawaban
            ? `<p style="font-family: Arial, sans-serif; font-size: 10pt; color: #7C3AED; margin-left: 20pt;">Kunci: ${escapeHtml(soal.kunciJawaban)}</p>`
            : versi === "siswa"
            ? `<p style="font-family: Arial, sans-serif; font-size: 10pt; color: #9CA3AF; margin-left: 20pt;">Jawaban: ________________________________</p>`
            : ""
        }
      </div>
    `;
  });

  const poinPentingHtml =
    handoutData.poinPenting?.map((p: string, i: number) => `<li>${escapeHtml(p)}</li>`).join("") || "";

  const referensiHtml =
    handoutData.referensiTambahan?.map((r: string) => `<li>${escapeHtml(r)}</li>`).join("") || "";

  const versiBadge =
    versi === "guru"
      ? `<span style="background-color: #7C3AED; color: white; padding: 2pt 8pt; font-size: 9pt;">VERSI GURU - DENGAN KUNCI JAWABAN</span>`
      : `<span style="background-color: #6B7280; color: white; padding: 2pt 8pt; font-size: 9pt;">VERSI SISWA</span>`;

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <title>${escapeHtml(handoutData.judul || "Handout")}</title>
      <meta charset="utf-8">
    </head>
    <body style="padding: 40px; font-family: Arial, sans-serif;">
      <h1 style="font-family: Arial, sans-serif; font-size: 18pt; text-align: center; color: #7C3AED;">
        ${escapeHtml(handoutData.judul || "Handout")}
      </h1>
      <p style="text-align: center; margin-bottom: 20pt;">${versiBadge}</p>

      <h2 style="font-family: Arial, sans-serif; font-size: 14pt; color: #7C3AED; border-bottom: 2px solid #F59E0B; padding-bottom: 4pt;">
        RINGKASAN MATERI
      </h2>
      <p style="font-family: Arial, sans-serif; font-size: 11pt; text-align: justify; line-height: 1.6;">
        ${escapeHtml(handoutData.ringkasanMateri || "")}
      </p>

      ${
        poinPentingHtml
          ? `
      <h2 style="font-family: Arial, sans-serif; font-size: 14pt; color: #7C3AED; border-bottom: 2px solid #F59E0B; padding-bottom: 4pt; margin-top: 20pt;">
        POIN PENTING
      </h2>
      <ul style="font-family: Arial, sans-serif; font-size: 11pt;">
        ${poinPentingHtml}
      </ul>
      `
          : ""
      }

      ${
        soalHtml
          ? `
      <h2 style="font-family: Arial, sans-serif; font-size: 14pt; color: #7C3AED; border-bottom: 2px solid #F59E0B; padding-bottom: 4pt; margin-top: 20pt;">
        CONTOH SOAL LATIHAN
      </h2>
      ${soalHtml}
      `
          : ""
      }

      ${
        referensiHtml
          ? `
      <h2 style="font-family: Arial, sans-serif; font-size: 12pt; margin-top: 20pt;">
        REFERENSI TAMBAHAN
      </h2>
      <ul style="font-family: Arial, sans-serif; font-size: 10pt; color: #6B7280;">
        ${referensiHtml}
      </ul>
      `
          : ""
      }

      <div style="text-align: center; margin-top: 40pt; font-family: Arial, sans-serif; font-size: 9pt; color: #9CA3AF;">
        <p>Dibuat dengan GuruPRO AI</p>
        <p>Versi: ${versi === "guru" ? "Guru (dengan kunci jawaban)" : "Siswa (tanpa kunci jawaban)"}</p>
      </div>
    </body>
    </html>
  `;

  return Buffer.from(html, "utf-8");
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
