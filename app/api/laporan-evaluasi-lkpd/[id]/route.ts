import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { canAccessLaporanEvaluasiLkpd, isLaporanEvaluasiCreator } from "@/lib/rbac/institution-permissions";

/**
 * GET /api/laporan-evaluasi-lkpd/[id]
 * Fetch a specific Laporan Evaluasi LKPD document
 * RBAC: Principal/Vice Principal can view all, teachers can view their own
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
        created_at,
        updated_at
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
    let canView = isCreator;

    if (institutionId && !isNaN(institutionId)) {
      const access = await canAccessLaporanEvaluasiLkpd(userIdNum, institutionId);
      if (access.canViewAll) {
        canView = true;
      }
    }

    if (!canView) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke laporan ini" },
        { status: 403 }
      );
    }

    // Parse konten
    const konten = typeof row.konten === "string"
      ? JSON.parse(row.konten)
      : row.konten;

    return NextResponse.json({
      id: row.id,
      judul: row.judul_dokumen,
      ...konten,
      pdfUrl: konten?.pdf_url || null,
      docxUrl: konten?.docx_url || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isOwner: isCreator,
    });
  } catch (error: any) {
    console.error("GET /api/laporan-evaluasi-lkpd/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengambil laporan" },
      { status: 500 }
    );
  }
}
