import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { getUserTokenAccess } from "@/lib/token-system";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { findOrCreateCmsUser } from "@/lib/institution-members";

// ==========================================
// GET /api/bahan-ajar/[id]
// Get detail lengkap bahan ajar
// ==========================================

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "ID wajib diisi" },
        { status: 400 }
      );
    }

    // Auth (supports both manual login and Google OAuth)
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json(
        { error: "Sesi tidak valid. Silakan login kembali." },
        { status: 401 }
      );
    }
    const userId = String(session.id);

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

    // Token validation
    const tokenState = await getUserTokenAccess(userId);
    if (!tokenState.user) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    // Get Payload instance
    const payload = await getPayload();

    // Ambil bahan ajar dengan populate modulAjar
    const bahanAjar = await payload.findByID({
      collection: "bahan-ajar",
      id,
      depth: 2, // depth 2 untuk dapat data modulAjar
    });

    if (!bahanAjar) {
      return NextResponse.json(
        { error: "Bahan Ajar tidak ditemukan." },
        { status: 404 }
      );
    }

    // Guard: cek kepemilikan
    const guruId = typeof bahanAjar.guru === 'object'
      ? (bahanAjar.guru as any)?.id
      : bahanAjar.guru;

    if (guruId !== cmsUserId) {
      // Check if user is admin
      if (tokenState.user.role !== "admin") {
        return NextResponse.json(
          { error: "Anda bukan pemilik Bahan Ajar ini." },
          { status: 403 }
        );
      }
    }

    // Ambil modul ajar terkait
    const modulAjar = bahanAjar.modulAjar as any;

    // Build response
    const response = {
      id: bahanAjar.id,
      status: bahanAjar.status,
      slidesOutline: bahanAjar.slidesOutline,
      lkpd: bahanAjar.lkpd,
      handout: bahanAjar.handout,
      complianceChecklist: bahanAjar.complianceChecklist,
      tokenCost: bahanAjar.tokenCost,
      errorMessage: bahanAjar.status === "failed" ? bahanAjar.errorMessage : null,
      createdAt: bahanAjar.createdAt,
      updatedAt: bahanAjar.updatedAt,
      modulAjar: modulAjar ? {
        id: typeof modulAjar === 'object' ? modulAjar.id : modulAjar,
        namaModul: modulAjar?.namaModul,
        jenjang: modulAjar?.jenjang,
        fase: modulAjar?.fase,
        mapel: modulAjar?.mapel,
        kelas: modulAjar?.kelas,
        kurikulum: modulAjar?.jenisKurikulum,
        cp: modulAjar?.cp,
        tp: modulAjar?.tp,
        topik: modulAjar?.topik,
        jumlahPertemuan: modulAjar?.jumlahPertemuan,
      } : null,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error("[BahanAjar] Get detail error:", error);

    if (error.message?.includes("not exist")) {
      return NextResponse.json(
        { error: "Payload CMS belum diinisialisasi." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Gagal mengambil detail bahan ajar" },
      { status: 500 }
    );
  }
}
