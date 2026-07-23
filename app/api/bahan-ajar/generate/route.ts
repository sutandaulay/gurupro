import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { getUserPoinAccess } from "@/src/services/poin-service";
import { estimateFeaturePoinCost } from "@/src/lib/ai-usage";
import { generateBahanAjar, estimateTotalTokenCost, type ModulAjarContext } from "@/lib/ai/generateBahanAjar";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { findOrCreateCmsUser } from "@/lib/institution-members";

// ==========================================
// POST /api/bahan-ajar/generate
// Generate Bahan Ajar - supports Modul Ajar or Standalone mode
// ==========================================

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      modulAjarId,       // Required for 'modul-ajar' mode
      standalone,        // boolean - if true, use standalone form data
      jenisOutput,
      jumlahSlideTarget,
      gayaVisual,
      handoutVersi,
      // Standalone form fields
      jenjang,
      fase,
      mapel,
      kelas,
      topik,
      tujuanPembelajaran,
      cp,
      jumlahPertemuan,
      alokasiWaktu,
    } = body;

    // Validasi jenisOutput
    if (!jenisOutput || !Array.isArray(jenisOutput) || jenisOutput.length === 0) {
      return NextResponse.json(
        { error: "jenisOutput wajib array non-empty: ['slide', 'lkpd', 'handout']" },
        { status: 400 }
      );
    }

    const validTypes = ["slide", "lkpd", "handout"];
    const invalidTypes = jenisOutput.filter((t: string) => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { error: `Jenis output tidak valid: ${invalidTypes.join(", ")}. Valid: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Auth
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json(
        { error: "Sesi tidak valid. Silakan login kembali." },
        { status: 401 }
      );
    }
    const userId = String(session.id);

    // Get user details
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

    // Find or create cms_users ID
    const cmsUserId = await findOrCreateCmsUser({
      id: user.id,
      email: user.email,
      nama_lengkap: user.nama_lengkap,
    });

    // Poin validation
    const poinAccess = await getUserPoinAccess(userId);
    if (!poinAccess.user) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    // Get Payload instance
    const payload = await getPayload();

    // ==========================================
    // Build ModulAjarContext based on mode
    // ==========================================

    let modulContext: ModulAjarContext;
    let modulAjarIdForRecord: string | null = null;
    let kurikulum = "kurikulum_merdeka";
    let jumlahPertemuanEffective = jumlahPertemuan || 4;

    if (standalone) {
      // STANDALONE MODE - build context from form data
      if (!mapel || !mapel.trim()) {
        return NextResponse.json(
          { error: "Mata Pelajaran wajib diisi untuk mode standalone" },
          { status: 400 }
        );
      }

      modulContext = {
        nama_modul: `Bahan Ajar ${mapel}${topik ? ` - ${topik}` : ''}`,
        jenjang: jenjang || "SD",
        fase: fase,
        mapel: mapel,
        kelas: kelas,
        cp: cp,
        tp: tujuanPembelajaran ? tujuanPembelajaran.split('\n').filter(Boolean) : undefined,
        topik: topik,
        kurikulum: kurikulum,
        jumlah_pertemuan: jumlahPertemuanEffective,
        alokasi_waktu_per_pertemuan: alokasiWaktu || "35 menit",
      };

      // No modulAjarId for standalone
      modulAjarIdForRecord = null;
    } else {
      // MODUL AJAR MODE - fetch from Payload CMS
      if (!modulAjarId) {
        return NextResponse.json(
          { error: "modulAjarId wajib diisi untuk mode dari Modul Ajar" },
          { status: 400 }
        );
      }

      const modulAjar = await payload.findByID({
        collection: "modul-ajar",
        id: modulAjarId,
        depth: 1,
      });

      if (!modulAjar) {
        return NextResponse.json(
          { error: "Modul Ajar tidak ditemukan." },
          { status: 404 }
        );
      }

      // Guard: cek kepemilikan
      const guruId = typeof modulAjar.guru === 'object'
        ? (modulAjar.guru as any)?.id
        : modulAjar.guru;

      if (guruId !== cmsUserId && poinAccess.user.role !== "admin") {
        return NextResponse.json(
          { error: "Anda bukan pemilik Modul Ajar ini." },
          { status: 403 }
        );
      }

      // Build context from Modul Ajar
      modulContext = {
        id: modulAjar.id as string,
        nama_modul: modulAjar.namaModul as string,
        jenjang: modulAjar.jenjang as string,
        fase: modulAjar.fase as string | undefined,
        mapel: modulAjar.mapel as string,
        kelas: modulAjar.kelas as string | undefined,
        cp: modulAjar.cp as string | undefined,
        tp: modulAjar.tp as string[] | undefined,
        atp: modulAjar.atp as any,
        topik: modulAjar.topik as string | undefined,
        materi_pokok: modulAjar.materiPokok as string[] | undefined,
        kurikulum: modulAjar.jenisKurikulum as string,
        jumlah_pertemuan: modulAjar.jumlahPertemuan as number | undefined,
        alokasi_waktu_per_pertemuan: modulAjar.alokasiWaktu as string | undefined,
      };

      modulAjarIdForRecord = modulAjarId;
      kurikulum = modulAjar.jenisKurikulum as string || "kurikulum_merdeka";
      jumlahPertemuanEffective = modulAjar.jumlahPertemuan || jumlahPertemuanEffective;
    }

    // Map jenisOutput
    const jenisOutputMap: Record<string, string> = {
      slide: "slides",
      lkpd: "lkpd",
      handout: "handout",
    };
    const serviceJenisOutput = jenisOutput.map((t: string) => jenisOutputMap[t]) as ("slides" | "lkpd" | "handout")[];

    // Estimate poin cost (fallback estimasi fitur)
    const estimatedPoin = estimateFeaturePoinCost("bahan-ajar");

    // Check poin quota
    if (!poinAccess.access.allowed) {
      const message = poinAccess.access.reason === "subscription_expired"
        ? "Masa aktif langganan akun Anda telah habis. Silakan perpanjang paket terlebih dahulu."
        : "Poin GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan.";
      return NextResponse.json(
        { error: message },
        { status: 402 }
      );
    }

    const remainingPoin = poinAccess.access.remainingPoin || 0;
    if (remainingPoin < estimatedPoin) {
      return NextResponse.json(
        { error: `Poin tidak cukup. Diperlukan: ${estimatedPoin}, Tersedia: ${remainingPoin}` },
        { status: 402 }
      );
    }

    // Create record with status generating
    const bahanAjarDoc = await payload.create({
      collection: "bahan-ajar",
      data: {
        modulAjar: modulAjarIdForRecord,
        guru: cmsUserId,
        jenisKurikulum: kurikulum,
        // Mode indicator
        isStandalone: standalone || false,
        // v2 options
        jenisOutput: jenisOutput.length === 1 ? jenisOutput[0] : "slide",
        jumlahSlideTarget: jumlahSlideTarget || 10,
        gayaVisual: gayaVisual || "minimalis",
        handoutVersi: handoutVersi || "guru",
        // Init fields
        status: "generating",
        slidesOutline: null,
        slidesOutlineV2: null,
        lkpd: null,
        handout: null,
        handoutV2: null,
        complianceChecklist: null,
        tokenCost: 0,
        errorMessage: null,
      },
    });

    // Generate bahan ajar via AI service
    try {
      const result = await generateBahanAjar(userId, modulContext, serviceJenisOutput);

      // Update record with results
      await payload.update({
        collection: "bahan-ajar",
        id: bahanAjarDoc.id,
        data: {
          status: "completed",
          slidesOutline: result.slides || null,
          slidesOutlineV2: result.slides || null,
          lkpd: result.lkpd || null,
          handout: result.handout || null,
          handoutV2: result.handout || null,
          complianceChecklist: result.complianceCheck || null,
          tokenCost: result.tokenUsed,
          errorMessage: null,
        },
      });

      return NextResponse.json({
        bahanAjarId: bahanAjarDoc.id,
        status: "completed",
        tokenUsed: result.tokenUsed,
        mode: standalone ? "standalone" : "modul-ajar",
        generatedContent: {
          slides: !!result.slides,
          lkpd: !!result.lkpd,
          handout: !!result.handout,
        },
        complianceCheck: result.complianceCheck,
        generationOptions: {
          jumlahSlideTarget,
          gayaVisual,
          handoutVersi,
        },
      });

    } catch (error: any) {
      // Update record with error
      await payload.update({
        collection: "bahan-ajar",
        id: bahanAjarDoc.id,
        data: {
          status: "failed",
          errorMessage: error.message || "Generation failed",
        },
      });

      if (error.message?.includes("Poin tidak cukup") || error.message?.includes("Kuota")) {
        return NextResponse.json(
          { error: error.message },
          { status: 402 }
        );
      }

      return NextResponse.json(
        { error: `Gagal generate bahan ajar: ${error.message}` },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("[BahanAjar] Generate error:", error);

    if (error.message?.includes("not exist")) {
      return NextResponse.json(
        { error: "Payload CMS belum diinisialisasi. Jalankan migration terlebih dahulu." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Gagal membuat bahan ajar" },
      { status: 500 }
    );
  }
}
