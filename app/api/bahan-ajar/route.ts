import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { findOrCreateCmsUser } from "@/lib/institution-members";

// ==========================================
// GET /api/bahan-ajar
// List all bahan ajar for current user
// ==========================================

export async function GET(req: Request) {
  try {
    // Auth (supports both manual login and Google OAuth)
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json(
        { error: "Sesi tidak valid. Silakan login kembali." },
        { status: 401 }
      );
    }
    const userId = session.id;

    // Get user details from users table to sync with cms_users
    const userRes = await query(
      "SELECT id, email, nama_lengkap FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }
    const user = userRes.rows[0];

    // Find or create the cms_users ID
    const cmsUserId = await findOrCreateCmsUser({
      id: user.id,
      email: user.email,
      nama_lengkap: user.nama_lengkap,
    });

    // Get Payload instance
    const payload = await getPayload();

    // Query bahan ajar dengan populate
    const { docs } = await payload.find({
      collection: "bahan-ajar",
      where: {
        guru: {
          equals: cmsUserId,
        },
      },
      sort: "-createdAt",
      limit: 50,
      depth: 1,
    });

    // Transform response
    const items = docs.map((doc: any) => {
      const modulAjar = doc.modulAjar;
      return {
        id: doc.id,
        status: doc.status,
        modulAjar: modulAjar
          ? {
              id: typeof modulAjar === "object" ? modulAjar.id : modulAjar,
              namaModul: modulAjar?.namaModul,
              mapel: modulAjar?.mapel,
              jenjang: modulAjar?.jenjang,
              kurikulum: modulAjar?.jenisKurikulum,
            }
          : null,
        complianceChecklist: doc.complianceChecklist,
        tokenCost: doc.tokenCost,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    return NextResponse.json({ data: items });

  } catch (error: any) {
    console.error("[BahanAjar] List error:", error);

    if (error.message?.includes("not exist")) {
      return NextResponse.json(
        { error: "Payload CMS belum diinisialisasi." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Gagal mengambil daftar bahan ajar" },
      { status: 500 }
    );
  }
}
