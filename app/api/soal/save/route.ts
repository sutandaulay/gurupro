import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { parseSessionCookie } from "@/lib/session-sign";
import { uploadToR2 } from "@/lib/r2";
import { getUserPoinAccess } from "@/src/services/poin-service";
import {
  BRAND_DISCLAIMER,
  formatTanggalIndonesia,
  getTahunAjaranDariTanggal,
  escapeHtml,
  buildKopSekolahHTML,
  buildIdentitasTableHTML,
  buildSignatureBlockHTML,
  buildWordDocTemplate,
} from "@/lib/export/document-shared";
import { deductPoinFromAIResult } from "@/src/lib/ai-usage";
import PDFDocument from "pdfkit";

// ============================================
// HELPERS
// ============================================

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function getTipeLabel(tipe: string): string {
  const map: Record<string, string> = {
    pg: "Pilihan Ganda",
    isian: "Isian Singkat",
    essay: "Uraian",
    "pg-kompleks": "Pilihan Ganda Kompleks",
    bs: "Benar/Salah",
    jodoh: "Menjodohkan",
    urutan: "Urutan",
    tabel: "Tabel",
    "sebab-akibat": "Sebab-Akibat",
  };
  return map[tipe] || tipe;
}

function getKurikulumLabel(kurikulum: string): string {
  const map: Record<string, string> = {
    kurikulum_merdeka: "Kurikulum Merdeka",
    merdeka: "Kurikulum Merdeka",
    k13: "Kurikulum 2013 (K13)",
    kbc: "Kurikulum Berbasis Kompetensi (KBC)",
    hybrid: "Kurikulum Hybrid",
  };
  return map[kurikulum?.toLowerCase()] || kurikulum || "Kurikulum Merdeka";
}

function buildSoalBodyHTML(soalList: any[]): string {
  return soalList.map((soal, idx) => {
    const nomor = idx + 1;
    const tipeLabel = getTipeLabel(soal.tipe);
    const tingkatBadge = soal.tingkat
      ? `<span style="background:#e5e7eb;padding:1px 6px;border-radius:3px;font-size:9pt;">${soal.tingkat}</span>`
      : "";
    const kognitifBadge = soal.kognitif
      ? `<span style="background:#dbeafe;padding:1px 6px;border-radius:3px;font-size:9pt;">${soal.kognitif}</span>`
      : "";

    let pertanyaanHtml = `<p style="margin:8px 0 12px;text-align:justify;">${escapeHtml(soal.pertanyaan || "")}</p>`;

    // Stimulus for AKM
    let stimulusHtml = "";
    if (soal.stimulus) {
      stimulusHtml = `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:10px 12px;margin-bottom:10px;font-size:11pt;font-style:italic;">
        <strong>Stimulus:</strong> ${escapeHtml(soal.stimulus)}
      </div>`;
    }

    // Gambar
    let gambarHtml = "";
    if (soal.gambar) {
      gambarHtml = `<div style="margin:8px 0;text-align:center;"><em>[Gambar: ${escapeHtml(soal.gambar)}]</em></div>`;
    }

    // Opsi based on type
    let opsiHtml = "";
    if (soal.opsi && Array.isArray(soal.opsi)) {
      if (soal.tipe === "bs") {
        opsiHtml = `<div style="margin-left:20px;margin-top:8px;">
          <p style="margin:4px 0;"><strong>A.</strong> Benar</p>
          <p style="margin:4px 0;"><strong>B.</strong> Salah</p>
        </div>`;
      } else if (soal.tipe === "pg-kompleks") {
        opsiHtml = `<div style="margin-left:20px;margin-top:8px;font-size:11pt;">
          <p style="margin:4px 0;"><em>Pilih semua jawaban yang benar</em></p>
          ${soal.opsi.map((opt: string, i: number) =>
            `<p style="margin:4px 0;"><strong>${LETTERS[i]}.</strong> ${escapeHtml(opt)}</p>`
          ).join("")}
        </div>`;
      } else if (soal.tipe === "jodoh" && soal.opsi && typeof soal.opsi === "object") {
        const ok = soal.opsi as any;
        const kiriItems = Array.isArray(ok.kiri) ? ok.kiri : [];
        const kananItems = Array.isArray(ok.kanan) ? ok.kanan : [];
        if (kiriItems.length > 0) {
          opsiHtml = `<div style="margin-top:8px;display:flex;gap:30px;">
            <div style="flex:1;">
              <p style="margin:4px 0;font-weight:bold;">Pernyataan:</p>
              ${kiriItems.map((item: string, i: number) =>
                `<p style="margin:4px 0;">${i + 1}. ${escapeHtml(item)}</p>`
              ).join("")}
            </div>
            <div style="flex:1;">
              <p style="margin:4px 0;font-weight:bold;">Jawaban:</p>
              ${kananItems.map((item: string, i: number) =>
                `<p style="margin:4px 0;">${String.fromCharCode(65 + i)}. ${escapeHtml(item)}</p>`
              ).join("")}
            </div>
          </div>`;
        } else {
          opsiHtml = `<div style="margin-left:20px;margin-top:8px;">
            ${soal.opsi.map((opt: string, i: number) =>
              `<p style="margin:4px 0;"><strong>${LETTERS[i]}.</strong> ${escapeHtml(opt)}</p>`
            ).join("")}
          </div>`;
        }
      } else if (soal.tipe === "sebab-akibat" && soal.opsi && typeof soal.opsi === "object") {
        const ok = soal.opsi as any;
        opsiHtml = `<div style="margin-left:20px;margin-top:8px;">
          <p style="margin:4px 0;"><strong>Pernyataan:</strong> ${escapeHtml(ok.pernyataan || "")}</p>
          <p style="margin:4px 0;"><strong>Alasan:</strong> ${escapeHtml(ok.alasan || "")}</p>
          <div style="margin-top:8px;margin-left:0;">
            <p style="margin:4px 0;"><strong>A.</strong> Pernyataan benar, alasan benar, keduanya berkaitan</p>
            <p style="margin:4px 0;"><strong>B.</strong> Pernyataan benar, alasan benar, keduanya tidak berkaitan</p>
            <p style="margin:4px 0;"><strong>C.</strong> Pernyataan benar, alasan salah</p>
            <p style="margin:4px 0;"><strong>D.</strong> Pernyataan salah, alasan benar</p>
            <p style="margin:4px 0;"><strong>E.</strong> Keduanya salah</p>
          </div>
        </div>`;
      } else if (soal.tipe === "urutan" && Array.isArray(soal.opsi)) {
        opsiHtml = `<div style="margin-left:20px;margin-top:8px;">
          <p style="margin:4px 0;font-style:italic;">Susun dalam urutan yang benar:</p>
          ${soal.opsi.map((opt: string, i: number) =>
            `<p style="margin:4px 0;"><strong>${i + 1}.</strong> ${escapeHtml(opt)}</p>`
          ).join("")}
        </div>`;
      } else {
        opsiHtml = `<div style="margin-left:20px;margin-top:8px;">
          ${soal.opsi.map((opt: string, i: number) => {
            const prefix = /^[A-H][\.\)]\s?/.test(opt) ? "" : `${LETTERS[i]}. `;
            return `<p style="margin:4px 0;">${prefix}${escapeHtml(opt)}</p>`;
          }).join("")}
        </div>`;
      }
    } else if (soal.tipe === "isian") {
      opsiHtml = `<div style="margin-left:20px;margin-top:8px;">
        <p style="font-style:italic;color:#666;">Jawaban: ________________________________</p>
      </div>`;
    } else if (soal.tipe === "essay") {
      opsiHtml = `<div style="margin-left:20px;margin-top:8px;">
        <p style="font-style:italic;color:#666;">Jawaban: <br/><br/><br/></p>
      </div>`;
    } else if (soal.tipe === "tabel" && soal.opsi && typeof soal.opsi === "object") {
      const ot = soal.opsi as any;
      if (ot.headers && Array.isArray(ot.headers)) {
        const cols = ot.headers.map((_: string, i: number) =>
          `<th style="border:1px solid #000;padding:6px 8px;background:#f3f4f6;font-size:10pt;width:${Math.floor(100 / ot.headers.length)}%;">Kolom ${i + 1}</th>`
        ).join("");
        const rowsHtml = (ot.rows || []).map((row: string[]) =>
          `<tr>${row.map((cell: string) =>
            `<td style="border:1px solid #000;padding:6px 8px;font-size:10pt;">${escapeHtml(cell === "?" ? "?" : cell)}</td>`
          ).join("")}</tr>`
        ).join("");
        opsiHtml = `<div style="margin-top:8px;">
          <table style="width:auto;border-collapse:collapse;">
            <thead><tr>${cols}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
      }
    }

    // Metadata badges row
    const badgesHtml = [tingkatBadge, kognitifBadge, soal.skor ? `<span style="background:#f3e8ff;padding:1px 6px;border-radius:3px;font-size:9pt;">Skor: ${soal.skor}</span>` : ""].filter(Boolean).join(" ");

    return `
    <div class="soal-item" style="page-break-inside:avoid;margin-bottom:20px;">
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
        <strong style="font-size:12pt;">${nomor}.</strong>
        <span style="font-size:10pt;color:#666;">[${tipeLabel}]</span>
        ${badgesHtml ? `<span style="display:flex;gap:4px;align-items:center;">${badgesHtml}</span>` : ""}
      </div>
      ${pertanyaanHtml}
      ${stimulusHtml}
      ${gambarHtml}
      ${opsiHtml}
      ${soal.pembahasan ? `<div style="margin-top:8px;padding:8px;background:#f0fdf4;border-left:3px solid #22c55e;font-size:10pt;color:#166534;">
        <strong>Pembahasan:</strong> ${escapeHtml(soal.pembahasan)}
      </div>` : ""}
    </div>`;
  }).join("");
}

// ============================================
// DOCX GENERATION
// ============================================

function generateSoalDocx(soalList: any[], meta: any): string {
  const sekolah = meta.namaSekolah || "GuruPRO";
  const guru = meta.namaGuru || "";
  const guruNip = meta.guruNip || "";
  const kepala = meta.kepalaSekolah || "";
  const kepalaNip = meta.kepalaNip || "";
  const jenjang = meta.jenjang || "";
  const kelas = meta.kelas || "";
  const mapel = meta.mapel || "";
  const kurikulum = getKurikulumLabel(meta.kurikulum || "");
  const jenis = meta.jenisAsesmen || "Bank Soal";
  const topik = meta.topik || "";

  const today = formatTanggalIndonesia(new Date());
  const tahunAjaran = meta.tahunAjaran || getTahunAjaranDariTanggal(new Date());
  const lokasi = meta.lokasi || "";

  const kopHtml = buildKopSekolahHTML({
    nama_sekolah: sekolah,
    alamat: meta.alamat || null,
    npsn: meta.npsn || null,
    logo: meta.logo || null,
  });

  const identitasRows: [string, string][] = [
    ["Mata Pelajaran", mapel],
    ["Kelas / Jenjang", `Kelas ${kelas} (${jenjang})`],
    ["Kurikulum", kurikulum],
    ["Tahun Ajaran", tahunAjaran],
    ["Jenis Asesmen", jenis],
    ["Topik", topik],
  ];

  const bodyHtml = `
  <div class="section">
    ${kopHtml}
    ${buildIdentitasTableHTML(identitasRows)}

    <h2 style="font-size:14pt;margin:20px 0 12px;text-align:center;border-bottom:1px solid #ccc;padding-bottom:6px;text-transform:uppercase;">
      ${escapeHtml(jenis)}
    </h2>

    <div class="soal-list">
      ${buildSoalBodyHTML(soalList)}
    </div>

    ${buildSignatureBlockHTML({
      guruNama: guru,
      guruNip: guruNip,
      kepalaNama: kepala,
      kepalaNip: kepalaNip,
      lokasi,
      tanggal: today,
    })}
  </div>`;

  return buildWordDocTemplate(bodyHtml, `${jenis} - ${mapel}`);
}

// ============================================
// PDF GENERATION
// ============================================

async function generateSoalPdf(soalList: any[], meta: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const marginLeft = 50;
    const marginRight = 50;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const marginTop = 50;
    const marginBottom = pageHeight - 60;

    const lokasi = meta.lokasi || "";
    const sekolah = meta.namaSekolah || "GuruPRO";

    // Page numbering
    let pageNum = 1;
    const addPageNumber = () => {
      doc.font("Helvetica").fontSize(9).fillColor("#6B7280");
      doc.text(
        `Halaman ${pageNum}`,
        marginLeft,
        pageHeight - 30,
        { align: "center", width: contentWidth }
      );
      doc.fillColor("#000");
    };

    const guru = meta.namaGuru || "";
    const guruNip = meta.guruNip || "";
    const kepala = meta.kepalaSekolah || "";
    const kepalaNip = meta.kepalaNip || "";
    const jenjang = meta.jenjang || "";
    const kelas = meta.kelas || "";
    const mapel = meta.mapel || "";
    const kurikulum = getKurikulumLabel(meta.kurikulum || "");
    const jenis = meta.jenisAsesmen || "Bank Soal";
    const topik = meta.topik || "";
    const today = formatTanggalIndonesia(new Date());
    const tahunAjaran = meta.tahunAjaran || getTahunAjaranDariTanggal(new Date());

    const PRIMARY = "#1E3A8A";
    const HEADER_BG = "#E0E7FF";
    const BORDER = "#334155";

    let yPos = marginTop;

    const drawKop = () => {
      // School name centered
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#000").text(
        sekolah.toUpperCase(),
        marginLeft,
        yPos,
        { align: "center", width: contentWidth }
      );

      if (meta.alamat) {
        doc.font("Helvetica").fontSize(9).fillColor("#555");
        doc.text(meta.alamat, marginLeft, yPos + 18, { align: "center", width: contentWidth });
      }
      if (meta.npsn) {
        doc.font("Helvetica").fontSize(9).fillColor("#555");
        doc.text(`NPSN: ${meta.npsn}`, marginLeft, yPos + 30, { align: "center", width: contentWidth });
      }

      yPos += (meta.alamat ? 40 : 25);
      doc.rect(marginLeft, yPos, contentWidth, 2).fill("#000");
      yPos += 10;
    };

    const drawIdentitas = () => {
      const col1 = 130;
      const col2 = marginLeft + col1;
      const col3 = marginLeft + col1 + 130;
      const rowH = 16;
      const identities: [string, string, string | null, string | null][] = [
        ["Mata Pelajaran:", mapel, "Jenis Asesmen:", jenis],
        ["Kelas / Jenjang:", `Kelas ${kelas} (${jenjang})`, "Kurikulum:", kurikulum],
        ["Tahun Ajaran:", tahunAjaran, "Topik:", topik],
      ];

      identities.forEach(([l1, v1, l2, v2]) => {
        doc.rect(marginLeft, yPos, contentWidth, rowH).stroke(BORDER);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(PRIMARY);
        doc.text(l1, marginLeft + 4, yPos + 4, { width: col1 - 4 });
        doc.font("Helvetica").fontSize(9).fillColor("#000");
        doc.text(v1, col2, yPos + 4, { width: contentWidth - col1 - 4 });
        if (l2) {
          doc.font("Helvetica-Bold").fontSize(9).fillColor(PRIMARY);
          doc.text(l2, col3, yPos + 4, { width: col1 - 4 });
          doc.font("Helvetica").fontSize(9).fillColor("#000");
          doc.text(v2 || "-", col3 + col1, yPos + 4, { width: contentWidth - col1 * 2 - 4 });
        }
        yPos += rowH;
      });
      yPos += 8;
    };

    const drawJudulAsesmen = () => {
      doc.font("Helvetica-Bold").fontSize(14).fillColor(PRIMARY);
      doc.text(jenis.toUpperCase(), marginLeft, yPos, { align: "center", width: contentWidth });
      yPos += 20;
      doc.rect(marginLeft, yPos, contentWidth, 1).fill("#ccc");
      yPos += 8;
    };

    const drawSoal = (soal: any, idx: number) => {
      const nomor = idx + 1;
      const tipeLabel = getTipeLabel(soal.tipe);

      const headerLine = `${nomor}. [${tipeLabel}]${soal.tingkat ? ` (${soal.tingkat})` : ""}${soal.kognitif ? ` - ${soal.kognitif}` : ""}${soal.skor ? ` [Skor ${soal.skor}]` : ""}`;
      const headerH = 16;
      const pertanyaanH = countLines(soal.pertanyaan || "", contentWidth - 20, 11) * 14 + 16;

      const needed = headerH + pertanyaanH + 10;
      if (yPos + needed > marginBottom) {
        doc.addPage({ size: "A4", margin: 50 });
        yPos = marginTop;
        addPageNumber();
        drawKop();
        drawIdentitas();
        drawJudulAsesmen();
      }

      // Header bar
      doc.rect(marginLeft, yPos, contentWidth, headerH).fill(HEADER_BG);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(PRIMARY);
      doc.text(headerLine, marginLeft + 4, yPos + 3, { width: contentWidth - 8 });
      yPos += headerH;

      // Pertanyaan
      doc.font("Helvetica").fontSize(11).fillColor("#000");
      const qLines = doc.text(soal.pertanyaan || "", marginLeft + 4, yPos + 4, {
        width: contentWidth - 8,
        lineGap: 2,
        continued: false,
      }) as unknown as number;
      yPos += Math.max(30, qLines * 14 + 12);

      // Stimulus
      if (soal.stimulus) {
        doc.rect(marginLeft, yPos, contentWidth, 24).fill("#FFFBEB");
        doc.rect(marginLeft, yPos, 3, 24).fill("#F59E0B");
        doc.font("Helvetica").fontSize(9).fillColor("#92400E");
        doc.text(`Stimulus: ${soal.stimulus}`, marginLeft + 10, yPos + 6, { width: contentWidth - 20 });
        yPos += 28;
      }

      // Gambar
      if (soal.gambar) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor("#6B7280");
        doc.text(`[Gambar: ${soal.gambar}]`, marginLeft + 10, yPos, { width: contentWidth - 20 });
        yPos += 16;
      }

      // Opsi
      if (soal.opsi && Array.isArray(soal.opsi)) {
        if (soal.tipe === "bs") {
          doc.font("Helvetica").fontSize(10).fillColor("#000");
          doc.text("A. Benar     B. Salah", marginLeft + 20, yPos + 4, {});
          yPos += 24;
        } else if (soal.tipe === "pg-kompleks") {
          doc.font("Helvetica").fontSize(9).fillColor("#6B7280").text("Pilih semua jawaban yang benar:", marginLeft + 20, yPos + 4, {});
          yPos += 16;
          soal.opsi.forEach((opt: string, i: number) => {
            doc.font("Helvetica").fontSize(10).fillColor("#000");
            doc.text(`${LETTERS[i]}. ${opt}`, marginLeft + 20, yPos + 4, { width: contentWidth - 30 });
            yPos += 14;
          });
        } else if (soal.tipe === "sebab-akibat" && soal.opsi && typeof soal.opsi === "object") {
          const ok = soal.opsi as any;
          doc.font("Helvetica").fontSize(10).fillColor("#000");
          doc.text(`Pernyataan: ${ok.pernyataan || ""}`, marginLeft + 20, yPos + 4, { width: contentWidth - 30 });
          yPos += 16;
          doc.text(`Alasan: ${ok.alasan || ""}`, marginLeft + 20, yPos + 4, { width: contentWidth - 30 });
          yPos += 20;
          doc.font("Helvetica").fontSize(10);
          doc.text("A. Benar dan keduanya berkaitan  C. Benar dan alasan salah", marginLeft + 20, yPos + 4, { width: contentWidth - 30 });
          yPos += 14;
          doc.text("B. Benar dan tidak berkaitan     D. Pernyataan salah, alasan benar", marginLeft + 20, yPos + 4, { width: contentWidth - 30 });
          yPos += 14;
          doc.text("E. Keduanya salah", marginLeft + 20, yPos + 4, { width: contentWidth - 30 });
          yPos += 18;
        } else if (soal.tipe === "urutan" && Array.isArray(soal.opsi)) {
          doc.font("Helvetica-Oblique").fontSize(9).fillColor("#6B7280");
          doc.text("Susun dalam urutan yang benar:", marginLeft + 20, yPos + 4, {});
          yPos += 16;
          soal.opsi.forEach((opt: string, i: number) => {
            doc.font("Helvetica").fontSize(10).fillColor("#000");
            doc.text(`${i + 1}. ${opt}`, marginLeft + 20, yPos + 4, { width: contentWidth - 30 });
            yPos += 14;
          });
          yPos += 4;
        } else {
          soal.opsi.forEach((opt: string, i: number) => {
            doc.font("Helvetica").fontSize(10).fillColor("#000");
            doc.text(`${LETTERS[i]}. ${opt}`, marginLeft + 20, yPos + 4, { width: contentWidth - 30 });
            yPos += 14;
          });
        }
      } else if (soal.tipe === "isian") {
        doc.font("Helvetica-Oblique").fontSize(10).fillColor("#9CA3AF");
        doc.text("Jawaban: ________________________________", marginLeft + 20, yPos + 4, {});
        yPos += 24;
      } else if (soal.tipe === "essay") {
        doc.font("Helvetica-Oblique").fontSize(10).fillColor("#9CA3AF");
        for (let l = 0; l < 3; l++) {
          doc.text("________________________________", marginLeft + 20, yPos + 4, {});
          yPos += 18;
        }
      }

      // Pembahasan
      if (soal.pembahasan) {
        doc.rect(marginLeft, yPos, contentWidth, 20).fill("#F0FDF4");
        doc.rect(marginLeft, yPos, 3, 20).fill("#22C55E");
        doc.font("Helvetica").fontSize(9).fillColor("#166534");
        doc.text(`Pembahasan: ${soal.pembahasan}`, marginLeft + 10, yPos + 5, { width: contentWidth - 20 });
        yPos += 24;
      }

      yPos += 10;
    };

    const drawSignature = () => {
      if (yPos + 100 > marginBottom) {
        doc.addPage({ size: "A4", margin: 50 });
        yPos = marginTop;
        addPageNumber();
      }
      yPos += 20;

      const sigW = contentWidth / 2 - 10;
      const leftX = marginLeft;
      const rightX = marginLeft + sigW + 20;

      doc.font("Helvetica").fontSize(10).fillColor("#000");
      doc.text(`${lokasi || ""}`, leftX, yPos, { align: "center", width: sigW });
      doc.text(`${lokasi || ""}`, rightX, yPos, { align: "center", width: sigW });
      yPos += 16;

      doc.font("Helvetica").fontSize(10);
      doc.text("Kepala Sekolah,", leftX, yPos, { align: "center", width: sigW });
      doc.text("Guru,", rightX, yPos, { align: "center", width: sigW });
      yPos += 60;

      doc.font("Helvetica-Bold").fontSize(10);
      doc.text(kepala || "_____________________", leftX, yPos, { align: "center", width: sigW });
      doc.text(guru || "_____________________", rightX, yPos, { align: "center", width: sigW });
      yPos += 16;

      doc.font("Helvetica").fontSize(9).fillColor("#555");
      if (kepalaNip) doc.text(`NIP. ${kepalaNip}`, leftX, yPos, { align: "center", width: sigW });
      if (guruNip) doc.text(`NIP. ${guruNip}`, rightX, yPos, { align: "center", width: sigW });
    };

    // === RENDER ===
    drawKop();
    drawIdentitas();
    drawJudulAsesmen();
    addPageNumber();

    soalList.forEach((soal, idx) => drawSoal(soal, idx));

    drawSignature();

    // Footer branding
    doc.font("Helvetica").fontSize(8).fillColor("#9CA3AF");
    doc.text(BRAND_DISCLAIMER, marginLeft, doc.page.height - 18, {
      align: "center",
      width: contentWidth,
    });

    doc.end();
  });
}

function countLines(text: string, width: number, fontSize: number): number {
  const charsPerLine = Math.floor(width / (fontSize * 0.5));
  const lines = text.split(/\s+/).reduce((acc, word) => {
    if (acc.length === 0) return [word];
    const last = acc[acc.length - 1];
    if ((last + " " + word).length <= charsPerLine) {
      acc[acc.length - 1] = last + " " + word;
    } else {
      acc.push(word);
    }
    return acc;
  }, [] as string[]);
  return lines.length;
}

// ============================================
// API HANDLER
// ============================================

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { soalList, meta, generatePdf = true, generateDoc = false } = body;

    if (!soalList || !Array.isArray(soalList) || soalList.length === 0) {
      return NextResponse.json({ error: "Daftar soal diperlukan" }, { status: 400 });
    }

    // Auth
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.id;

    const tokenState = await getUserPoinAccess(userId);
    if (!tokenState.user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    // Fetch user + school data for signature block
    let guruNama = meta?.namaGuru || "";
    let guruNip = meta?.guruNip || "";
    let kepalaNama = meta?.kepalaSekolah || "";
    let kepalaNip = meta?.kepalaNip || "";
    let schoolAddress = meta?.alamat || "";
    let schoolLogo = meta?.logo || "";
    let schoolNpsn = meta?.npsn || "";

    try {
      const userRes = await query(
        "SELECT u.nama_lengkap, u.nip FROM users u WHERE u.id = $1 LIMIT 1",
        [userId]
      );
      if (userRes.rows[0]) {
        guruNama = guruNama || userRes.rows[0].nama_lengkap || "";
        guruNip = guruNip || userRes.rows[0].nip || "";
      }

      if (meta?.school_id) {
        const schoolRes = await query(
          `SELECT s.nama_sekolah, s.alamat, s.npsn, s.logo,
                  st.nama_lengkap as kepala_nama, st.nip as kepala_nip
           FROM schools s
           LEFT JOIN users st ON st.id = s.kepala_sekolah_id
           WHERE s.id = $1 LIMIT 1`,
          [meta.school_id]
        );
        if (schoolRes.rows[0]) {
          const sr = schoolRes.rows[0];
          schoolAddress = schoolAddress || sr.alamat || "";
          kepalaNama = kepalaNama || sr.kepala_nama || "";
          kepalaNip = kepalaNip || sr.kepala_nip || "";
          schoolLogo = schoolLogo || sr.logo || "";
          schoolNpsn = schoolNpsn || sr.npsn || "";
        }
      }
    } catch (_) {
      // non-critical — continue with meta values
    }

    const enrichedMeta = {
      ...meta,
      namaGuru: guruNama,
      guruNip,
      kepalaSekolah: kepalaNama,
      kepalaNip,
      alamat: schoolAddress,
      logo: schoolLogo,
      npsn: schoolNpsn,
    };

    const mapel = meta?.mapel || "Mata Pelajaran";
    const kelas = meta?.kelas || "Kelas";
    const topik = meta?.topik || "Ujian";

    let pdfUrl: string | null = null;
    let docUrl: string | null = null;

    // Generate PDF
    if (generatePdf) {
      try {
        const pdfBuffer = await generateSoalPdf(soalList, enrichedMeta);
        const fileName = `soal_${mapel.replace(/[^a-zA-Z0-9]/g, "_")}_${kelas}_${Date.now()}.pdf`;
        pdfUrl = await uploadToR2(pdfBuffer, fileName, "application/pdf");
        console.log("[Soal] PDF uploaded:", pdfUrl);
      } catch (uploadError: any) {
        console.error("[Soal] PDF upload failed:", uploadError);
      }
    }

    // Generate DOCX
    if (generateDoc) {
      try {
        const docxContent = generateSoalDocx(soalList, enrichedMeta);
        const docBuffer = Buffer.from("﻿" + docxContent, "utf-8");
        const docFileName = `soal_${mapel.replace(/[^a-zA-Z0-9]/g, "_")}_${kelas}_${Date.now()}.doc`;
        docUrl = await uploadToR2(docBuffer, docFileName, "application/vnd.ms-word");
        console.log("[Soal] DOCX uploaded:", docUrl);
      } catch (uploadError: any) {
        console.error("[Soal] DOCX upload failed:", uploadError);
      }
    }

    // Save to database
    try {
      const dbResult = await query(
        `INSERT INTO guru_administrasi (
          user_id, tipe_dokumen, judul_dokumen, konten, school_id, jenjang, kurikulum
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          userId,
          "soal",
          `Bank Soal - ${mapel} - Kelas ${kelas} - ${topik}`,
          JSON.stringify({ soalList, meta: enrichedMeta, generated_at: new Date().toISOString() }),
          meta?.school_id || null,
          meta?.jenjang || null,
          meta?.kurikulum || null,
        ]
      );

      const savedId = dbResult.rows?.[0]?.id;

      // Deduct poin for export/storage cost (flat fee, not AI tokens)
      try {
        await deductPoinFromAIResult(
          { success: true, usage: null },
          userId,
          'soal-save',
          {
            jenjang: meta?.jenjang,
            mapel: meta?.mapel,
            jumlahSoal: soalList.length,
          },
        );
        console.log(`[Soal Save] Poin deducted for user ${userId}`);
      } catch (poinError: unknown) {
        console.error('[Soal Save] Poin deduction failed:', poinError);
      }

      return NextResponse.json({
        success: true,
        id: savedId,
        pdf_url: pdfUrl,
        doc_url: docUrl,
        message: pdfUrl || docUrl
          ? "Bank soal berhasil disimpan ke Storage Saya!"
          : "Bank soal disimpan ke database (upload gagal)",
      });
    } catch (dbError: any) {
      console.error("[Soal] DB save error:", dbError);
      return NextResponse.json({ error: "Gagal menyimpan ke database" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[Soal] Save error:", error);
    return NextResponse.json({ error: error.message || "Gagal menyimpan soal" }, { status: 500 });
  }
}
