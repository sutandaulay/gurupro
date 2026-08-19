import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { canAccessLaporanEvaluasiLkpd, isLaporanEvaluasiCreator } from "@/lib/rbac/institution-permissions";
import { uploadToR2 } from "@/lib/r2";
import { generateLaporanEvaluasiPdfBuffer, generateLaporanEvaluasiDocBuffer } from "@/lib/doc-compiler";
import { laporanEvaluasiLkpdOutputSchema } from "@/lib/schemas/laporan-evaluasi-lkpd";
import { z } from "zod";
import { parseSessionCookie } from "@/lib/session-sign";

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
    const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
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

    // Fetch user info
    let userInfo: any = {};
    try {
      const userRes = await query("SELECT nama_lengkap, nip, signature_url FROM users WHERE id = $1", [userId]);
      userInfo = userRes.rows[0] || {};
    } catch (_) {}

    // Fetch school info
    let schoolData: any = { nama_sekolah: null, alamat: null, npsn: null, logo: null, nama_kepala_sekolah: null, nip_kepala_sekolah: null, kepala_signature_url: null };
    if (row.school_id) {
      try {
        const schoolRes = await query(
          `SELECT s.nama_sekolah, s.alamat, s.npsn, s.logo,
                  i.nama_kepala_sekolah, i.nip_kepala_sekolah,
                  ks.signature_url AS kepala_signature_url
           FROM user_schools us
           JOIN schools s ON s.id = us.school_id
           LEFT JOIN institutions i ON i.school_id = s.id
           LEFT JOIN users ks ON ks.nama_sekolah = s.nama_sekolah AND ks.role = 'kepala_sekolah'
           WHERE us.user_id = $1 AND s.id = $2`,
          [userId, row.school_id]
        );
        if (schoolRes.rows[0]) schoolData = schoolRes.rows[0];
      } catch (_) {}
    }

    const docOpts = {
      logoUrl: schoolData.logo,
      namaSekolah: schoolData.nama_sekolah,
      alamat: schoolData.alamat,
      npsn: schoolData.npsn,
      kepalaNama: schoolData.nama_kepala_sekolah,
      kepalaNip: schoolData.nip_kepala_sekolah,
      guruNama: userInfo.nama_lengkap,
      guruNip: userInfo.nip,
      guruSignatureUrl: userInfo.signature_url,
      kepalaSignatureUrl: schoolData.kepala_signature_url,
      lokasi: schoolData.nama_sekolah,
      tanggal: new Date(),
    };

    // Generate file
    const docTitle = `Laporan Evaluasi LKPD - ${parsedData.identitas.mataPelajaran} (${parsedData.identitas.periodeEvaluasi})`;

    if (format === "docx") {
      const docBuf = generateLaporanEvaluasiDocBuffer(parsedData, docTitle, docOpts);
      const docUrl = await uploadToR2(docBuf, `${id}-laporan-evaluasi-lkpd.doc`, "application/msword");

      // Update URL in database
      await query(`
        UPDATE guru_administrasi
        SET konten = JSONB_SET(konten::jsonb, '{docx_url}', $1)
        WHERE id = $2
      `, [JSON.stringify(docUrl), id]);

      return NextResponse.json({ downloadUrl: docUrl });
    } else {
      // PDF (default)
      const pdfBuf = await generateLaporanEvaluasiPdfBuffer(parsedData, docTitle, docOpts);
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
