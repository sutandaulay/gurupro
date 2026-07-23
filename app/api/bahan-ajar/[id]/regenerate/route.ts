import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { getSession } from "@/lib/session";
import { getUserTokenAccess } from "@/lib/token-system";
import { regenerateBahanAjarPartial, estimatePartialTokenCost, type ModulAjarContext } from "@/lib/ai/generateBahanAjar";
import { query } from "@/lib/db";
import { findOrCreateCmsUser } from "@/lib/institution-members";

// ==========================================
// POST /api/bahan-ajar/[id]/regenerate
// Regenerate satu jenis output saja
// ==========================================

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { jenis } = body;

    // Validasi input
    if (!id) {
      return NextResponse.json(
        { error: "ID wajib diisi" },
        { status: 400 }
      );
    }

    if (!jenis) {
      return NextResponse.json(
        { error: "jenis wajib diisi: 'slide' | 'lkpd' | 'handout'" },
        { status: 400 }
      );
    }

    // Validasi jenis
    const validTypes = ["slide", "lkpd", "handout"];
    const invalidTypes = jenis.filter ? jenis.filter((t: string) => !validTypes.includes(t)) : (!validTypes.includes(jenis) ? [jenis] : []);
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { error: `Jenis tidak valid. Valid: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Auth
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json(
        { error: "Sesi tidak aktif. Silakan login kembali." },
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

    // Ambil bahan ajar
    const bahanAjar = await payload.findByID({
      collection: "bahan-ajar",
      id,
      depth: 2,
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
      if (tokenState.user.role !== "admin") {
        return NextResponse.json(
          { error: "Anda bukan pemilik Bahan Ajar ini." },
          { status: 403 }
        );
      }
    }

    // Ambil modul ajar terkait
    const modulAjar = bahanAjar.modulAjar as any;
    if (!modulAjar) {
      return NextResponse.json(
        { error: "Modul Ajar tidak ditemukan." },
        { status: 404 }
      );
    }

    // Map jenis dari API format ke service format
    const jenisMap: Record<string, "slides" | "lkpd" | "handout"> = {
      slide: "slides",
      lkpd: "lkpd",
      handout: "handout",
    };
    const serviceJenis = jenisMap[jenis];

    // Estimate token cost
    const costEstimate = estimatePartialTokenCost(serviceJenis, []);

    // Check token quota
    if (!tokenState.access.allowed) {
      const message = tokenState.access.reason === "subscription_expired"
        ? "Masa aktif langganan akun Anda telah habis."
        : "Kredit token GuruPRO Anda telah habis!";
      return NextResponse.json(
        { error: message },
        { status: 402 }
      );
    }

    const remainingTokens = tokenState.access.remainingTokens || 0;
    if (remainingTokens < costEstimate.estimatedTokens) {
      return NextResponse.json(
        { error: `Token tidak cukup. Diperlukan: ${costEstimate.estimatedTokens}, Tersedia: ${remainingTokens}` },
        { status: 402 }
      );
    }

    // Build ModulAjarContext
    const modulContext: ModulAjarContext = {
      id: typeof modulAjar === 'object' ? modulAjar.id : modulAjar,
      nama_modul: modulAjar?.namaModul,
      jenjang: modulAjar?.jenjang,
      fase: modulAjar?.fase,
      mapel: modulAjar?.mapel,
      kelas: modulAjar?.kelas,
      cp: modulAjar?.cp,
      tp: modulAjar?.tp,
      atp: modulAjar?.atp,
      topik: modulAjar?.topik,
      materi_pokok: modulAjar?.materiPokok,
      kurikulum: modulAjar?.jenisKurikulum,
      jumlah_pertemuan: modulAjar?.jumlahPertemuan,
      alokasi_waktu_per_pertemuan: modulAjar?.alokasiWaktu,
    };

    // Regenerate via AI service
    try {
      const result = await regenerateBahanAjarPartial(userId, modulContext, serviceJenis);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Gagal regenerate" },
          { status: 500 }
        );
      }

      // Update field terkait saja
      const updateData: Record<string, any> = {};
      switch (jenis) {
        case "slide":
          updateData.slidesOutline = result.data;
          break;
        case "lkpd":
          updateData.lkpd = result.data;
          break;
        case "handout":
          updateData.handout = result.data;
          break;
      }

      // Tambah token cost baru ke total
      const currentCost = (bahanAjar.tokenCost as number) || 0;
      const newCost = currentCost + (result.tokenUsed || 0);
      updateData.tokenCost = newCost;
      updateData.status = "completed";
      updateData.errorMessage = null;

      await payload.update({
        collection: "bahan-ajar",
        id,
        data: updateData,
      });

      return NextResponse.json({
        bahanAjarId: id,
        jenis,
        status: "completed",
        tokenUsed: result.tokenUsed,
        totalTokenCost: newCost,
        regeneratedContent: result.data,
      });

    } catch (error: any) {
      console.error("[BahanAjar] Regenerate error:", error);

      if (error.message?.includes("Poin tidak cukup")) {
        return NextResponse.json(
          { error: error.message },
          { status: 402 }
        );
      }

      return NextResponse.json(
        { error: `Gagal regenerate: ${error.message}` },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("[BahanAjar] Regenerate endpoint error:", error);

    return NextResponse.json(
      { error: error.message || "Gagal regenerate bahan ajar" },
      { status: 500 }
    );
  }
}
