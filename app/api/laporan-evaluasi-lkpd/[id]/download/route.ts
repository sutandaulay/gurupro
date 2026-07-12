import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { canAccessLaporanEvaluasiLkpd, isLaporanEvaluasiCreator } from "@/lib/rbac/institution-permissions";
import { uploadToR2 } from "@/lib/r2";
import { generateLaporanEvaluasiPdfBuffer, generateLaporanEvaluasiDocBuffer } from "@/lib/doc-compiler";
import { laporanEvaluasiLkpdOutputSchema } from "@/lib/schemas/laporan-evaluasi-lkpd";
import { z } from "zod";

/**
 * POST /api/laporan-evaluasi-lkpd/[id]/download
 * Re-generate and download PDF/DOCX for a specific Laporan Evaluasi LKPD
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const format = body.format || "pdf"; // 'pdf' or 'docx'

    // Auth
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;
    const userIdNum = parseInt(userId, 10);

    // Fetch the document
    const result = await query(`
      SELECT
        id,
        judul_dokumen,
        konten,
        user_id,
        school_id,
        created_at
      FROM guru_administrasi
      WHERE id = $1 AND tipe_dokumen = 'laporan_evaluasi_lkpd'
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }

    const row = result.rows[0];
    const institutionId = row.school_id ? parseInt(row.school_id, 10) : null;

    // RBAC Check
    const isCreator = await isLaporanEvaluasiCreator(userId, id);
    let canAccess = isCreator;

    if (institutionId && !isNaN(institutionId)) {
      const access = await canAccessLaporanEvaluasiLkpd(userIdNum, institutionId);
      if (access.canViewAll) {
        canAccess = true;
      }
    }

    if (!canAccess) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke laporan ini" },
        { status: 403 }
      );
    }

    // Parse konten
    const konten = typeof row.konten === "string"
      ? JSON.parse(row.konten)
      : row.konten;

    // Validate and parse to output schema
    const parsedData = laporanEvaluasiLkpdOutputSchema.parse(konten);

    // Generate file
    const docTitle = `Laporan Evaluasi LKPD - ${parsedData.identitas.mataPelajaran} (${parsedData.identitas.periodeEvaluasi})`;

    if (format === "docx") {
      const docBuf = generateLaporanEvaluasiDocBuffer(parsedData, docTitle);
      const docUrl = await uploadToR2(docBuf, `${id}-laporan-evaluasi-lkpd.docx`, "application/msword");

      // Update URL in database
      await query(`
        UPDATE guru_administrasi
        SET konten = JSONB_SET(konten::jsonb, '{docx_url}', $1)
        WHERE id = $2
      `, [JSON.stringify(docUrl), id]);

      return NextResponse.json({ downloadUrl: docUrl });
    } else {
      // PDF (default)
      const pdfBuf = await generateLaporanEvaluasiPdfBuffer(parsedData, docTitle);
      const pdfUrl = await uploadToR2(pdfBuf, `${id}-laporan-evaluasi-lkpd.pdf`, "application/pdf");

      // Update URL in database
      await query(`
        UPDATE guru_administrasi
        SET konten = JSONB_SET(konten::jsonb, '{pdf_url}', $1)
        WHERE id = $2
      `, [JSON.stringify(pdfUrl), id]);

      return NextResponse.json({ downloadUrl: pdfUrl });
    }
  } catch (error: any) {
    console.error("POST /api/laporan-evaluasi-lkpd/[id]/download error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membuat unduhan" },
      { status: 500 }
    );
  }
}
