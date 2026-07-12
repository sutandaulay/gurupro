import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { canAccessLaporanEvaluasiLkpd, isLaporanEvaluasiCreator } from "@/lib/rbac/institution-permissions";

/**
 * GET /api/laporan-evaluasi-lkpd
 * List Laporan Evaluasi LKPD documents
 * RBAC: Principal/Vice Principal can view all, teachers can view their own
 */
export async function GET(req: Request) {
  try {
    // Auth
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;
    const userIdNum = parseInt(userId, 10);

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");
    const institutionId = schoolId ? parseInt(schoolId, 10) : null;

    let queryStr = `
      SELECT
        id,
        judul_dokumen,
        konten,
        created_at,
        user_id,
        school_id,
        jenjang,
        fase
      FROM guru_administrasi
      WHERE tipe_dokumen = 'laporan_evaluasi_lkpd'
    `;
    const params: any[] = [];

    // RBAC: Check if user can view all or only their own
    let canViewAll = false;
    if (institutionId && !isNaN(institutionId)) {
      const access = await canAccessLaporanEvaluasiLkpd(userIdNum, institutionId);
      canViewAll = access.canViewAll;
    }

    if (canViewAll) {
      // View all in institution
      if (institutionId) {
        params.push(institutionId);
        queryStr += ` AND school_id = $${params.length}`;
      }
    } else {
      // View only own documents
      params.push(userId);
      queryStr += ` AND user_id = $${params.length}`;
    }

    queryStr += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await query(queryStr, params);

    // Parse konten JSON
    const laporanList = result.rows.map((row) => {
      const konten = typeof row.konten === "string"
        ? JSON.parse(row.konten)
        : row.konten;

      return {
        id: row.id,
        judul: row.judul_dokumen,
        identitas: konten?.identitas || {},
        ringkasanEksekutif: konten?.ringkasanEksekutif || "",
        createdAt: row.created_at,
        isOwner: String(row.user_id) === userId,
        pdfUrl: konten?.pdf_url || null,
        docxUrl: konten?.docx_url || null,
      };
    });

    return NextResponse.json({
      laporan: laporanList,
      canViewAll,
    });
  } catch (error: any) {
    console.error("GET /api/laporan-evaluasi-lkpd error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengambil daftar laporan" },
      { status: 500 }
    );
  }
}
