import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { findOrCreateCmsUser } from "@/lib/institution-members";

// ==========================================
// POST /api/modul-ajar/save
// Menyimpan Modul Ajar AI hasil generasi ke Payload CMS
// ==========================================

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      namaModul,
      jenjang,
      fase,
      mapel,
      kelas,
      jenisKurikulum,
      topik,
      tujuan,
    } = body;

    if (!namaModul || !mapel || !kelas || !topik || !jenjang) {
      return NextResponse.json(
        { error: "Parameter namaModul, mapel, kelas, topik, dan jenjang wajib diisi" },
        { status: 400 }
      );
    }

    // 1. Auth check
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

    // Find or create the cms_users ID (integer)
    const cmsUserId = await findOrCreateCmsUser({
      id: user.id,
      email: user.email,
      nama_lengkap: user.nama_lengkap,
    });

    // Get Payload instance
    const payload = await getPayload();

    // Map jenisKurikulum value to Payload enum format
    const kurikulumValue = jenisKurikulum === "merdeka" ? "kurikulum_merdeka" : "k13";

    // Create record in modul-ajar collection
    const modulAjarDoc = await payload.create({
      collection: "modul-ajar",
      data: {
        guru: cmsUserId,
        namaModul,
        jenjang,
        fase: fase || null,
        mapel,
        kelas: String(kelas),
        jenisKurikulum: kurikulumValue,
        topik,
        // Simple TP list
        tp: tujuan ? [tujuan] : [topik],
        // Default Completed so it can be used directly for Bahan Ajar
        status: "completed",
      },
    });

    return NextResponse.json({
      success: true,
      modulAjarId: modulAjarDoc.id,
    });

  } catch (error: any) {
    console.error("Save Modul Ajar error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menyimpan modul ajar" },
      { status: 500 }
    );
  }
}
