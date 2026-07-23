import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { uploadToR2 } from "@/lib/r2";
import { getUserPoinAccess } from "@/src/services/poin-service";

// Generate PDF buffer from soal list (simplified HTML to PDF)
async function generateSoalPdf(soalList: any[], meta: any): Promise<Buffer> {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  let content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { size: A4; margin: 2cm; }
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px; }
        .header h2 { margin: 0; font-size: 16pt; }
        .header p { margin: 4px 0; font-size: 11pt; }
        .soal { margin-bottom: 20px; page-break-inside: avoid; }
        .soal-header { font-weight: bold; margin-bottom: 8px; }
        .pertanyaan { margin-bottom: 10px; }
        .opsi { margin-left: 20px; margin-bottom: 4px; }
        .footer { margin-top: 30px; text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${(meta.jenisAsesmen || "BANK SOAL").toUpperCase()}</h2>
        <p><strong>Mata Pelajaran:</strong> ${meta.mapel || "-"} | <strong>Kelas:</strong> ${meta.kelas || "-"}</p>
        <p><strong>Sekolah:</strong> ${meta.namaSekolah || "-"} | <strong>Guru:</strong> ${meta.namaGuru || "-"}</p>
        <p><strong>Kurikulum:</strong> ${meta.kurikulumLabel || "-"} | <strong>Jenjang:</strong> ${meta.jenjang || "-"}</p>
      </div>
  `;

  soalList.forEach((soal, idx) => {
    content += `
      <div class="soal">
        <div class="pertanyaan"><strong>${idx + 1}.</strong> ${soal.pertanyaan}</div>
    `;

    if (soal.opsi && Array.isArray(soal.opsi)) {
      soal.opsi.forEach((opt: string, oIdx: number) => {
        const prefix = /^[A-H][\.\)]\s?/.test(opt) ? "" : `${letters[oIdx]}. `;
        content += `<div class="opsi">${prefix}${opt}</div>`;
      });
    } else if (soal.tipe === 'isian' || soal.tipe === 'essay') {
      content += `<div class="opsis">______________________________________________</div>`;
    }

    if (soal.gambarData) {
      content += `<div style="margin: 10px 0;"><img src="${soal.gambarData}" style="max-width: 300px; height: auto;" /></div>`;
    }

    content += `</div>`;
  });

  content += `
      <div class="footer">
        <p>Dibuat dengan GuruPRO - ${new Date().toLocaleDateString('id-ID')}</p>
      </div>
    </body>
    </html>
  `;

  // Convert HTML to PDF using html2canvas approach
  // For now, return HTML as buffer (will be converted client-side with html2pdf.js)
  return Buffer.from(content, 'utf-8');
}

// Generate DOC buffer from soal list
function generateSoalDoc(soalList: any[], meta: any): string {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  let html = `
    <html xmlns:w="urn:schemas-microsoft-com:office:word">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Times New Roman'; font-size: 12pt; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px; }
        .soal { margin-bottom: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${(meta.jenisAsesmen || "BANK SOAL").toUpperCase()}</h2>
        <p><strong>${meta.mapel || "-"}</strong> | Kelas ${meta.kelas || "-"} | ${meta.namaSekolah || "-"}</p>
      </div>
  `;

  soalList.forEach((soal, idx) => {
    html += `<div class="soal"><p><strong>${idx + 1}.</strong> ${soal.pertanyaan}</p>`;

    if (soal.opsi && Array.isArray(soal.opsi)) {
      html += `<div style="margin-left: 20px;">`;
      soal.opsi.forEach((opt: string, oIdx: number) => {
        html += `<p style="margin: 2px 0;">${letters[oIdx]}. ${opt}</p>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
  });

  html += `
      <div style="margin-top: 30px; text-align: right;">
        <p>Dibuat dengan GuruPRO - ${new Date().toLocaleDateString('id-ID')}</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { soalList, meta, generatePdf = true, generateDoc = false } = body;

    if (!soalList || !Array.isArray(soalList) || soalList.length === 0) {
      return NextResponse.json({ error: "Daftar soal diperlukan" }, { status: 400 });
    }

    // Auth check
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    // Get user poin access (validation)
    const tokenState = await getUserPoinAccess(userId);
    if (!tokenState.user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    const mapel = meta?.mapel || "Mata Pelajaran";
    const kelas = meta?.kelas || "Kelas";
    const topik = meta?.topik || "Ujian";

    let pdfUrl: string | null = null;
    let docUrl: string | null = null;

    // Generate and upload PDF if requested
    if (generatePdf) {
      try {
        const pdfBuffer = await generateSoalPdf(soalList, meta);
        const fileName = `soal_${mapel.replace(/[^a-zA-Z0-9]/g, '_')}_${kelas}_${Date.now()}.html`;
        pdfUrl = await uploadToR2(pdfBuffer, fileName, "text/html");
        if (pdfUrl) {
          console.log("Soal PDF uploaded to R2:", pdfUrl);
        }
      } catch (uploadError: any) {
        console.error("Failed to upload PDF to R2:", uploadError);
        // Continue without PDF URL
      }
    }

    // Generate and upload DOC if requested
    if (generateDoc) {
      try {
        const docContent = generateSoalDoc(soalList, meta);
        const docBuffer = Buffer.from('﻿' + docContent, 'utf-8'); // BOM for Word
        const docFileName = `soal_${mapel.replace(/[^a-zA-Z0-9]/g, '_')}_${kelas}_${Date.now()}.doc`;
        docUrl = await uploadToR2(docBuffer, docFileName, "application/msword");
        if (docUrl) {
          console.log("Soal DOC uploaded to R2:", docUrl);
        }
      } catch (uploadError: any) {
        console.error("Failed to upload DOC to R2:", uploadError);
      }
    }

    // Build konten with URLs included
    const kontenJson = {
      soalList,
      meta,
      generated_at: new Date().toISOString(),
      pdf_url: pdfUrl,
      doc_url: docUrl,
    };

    // Save to database
    try {
      const dbResult = await query(`
        INSERT INTO guru_administrasi (
          user_id,
          tipe_dokumen,
          judul_dokumen,
          konten,
          school_id,
          jenjang,
          kurikulum
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        userId,
        "soal",
        `Bank Soal - ${mapel} - Kelas ${kelas} - ${topik}`,
        JSON.stringify(kontenJson),
        meta?.school_id || null,
        meta?.jenjang || null,
        meta?.kurikulum || null,
      ]);

      const savedId = dbResult.rows?.[0]?.id;

      return NextResponse.json({
        success: true,
        id: savedId,
        pdf_url: pdfUrl,
        doc_url: docUrl,
        message: pdfUrl || docUrl
          ? "Bank soal berhasil disimpan ke Storage Saya (Cloud R2)!"
          : "Bank soal disimpan ke database (R2 upload gagal, cek konfigurasi)",
      });
    } catch (dbError: any) {
      console.error("Database save error:", dbError);
      return NextResponse.json({
        error: "Gagal menyimpan ke database",
        pdf_url: pdfUrl,
        doc_url: docUrl,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Save soal error:", error);
    return NextResponse.json({ error: error.message || "Gagal menyimpan soal" }, { status: 500 });
  }
}
