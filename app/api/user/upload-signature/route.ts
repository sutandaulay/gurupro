import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { parseSessionCookie } from "@/lib/session-sign";
import { uploadToR2 } from "@/lib/r2";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 500 * 1024; // 500KB — signature images are small

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);

    if (!session) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }

    const userId = session.id;

    const formData = await req.formData();
    const file = formData.get("signature") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File tanda tangan tidak ditemukan." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Tipe file tidak didukung. Gunakan PNG, JPEG, atau WebP." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ukuran file maksimal 500KB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const ext = file.name.split(".").pop() || "png";
    const fileName = `signature-${userId}.${ext}`;

    const url = await uploadToR2(buffer, fileName, file.type);

    if (!url) {
      return NextResponse.json({ error: "Gagal mengupload tanda tangan. Server storage tidak tersedia." }, { status: 500 });
    }

    await query("UPDATE users SET signature_url = $1 WHERE id = $2", [url, userId]);

    return NextResponse.json({
      message: "Tanda tangan berhasil diupload!",
      signature_url: url,
    });
  } catch (error: any) {
    console.error("Upload signature API error:", error);
    return NextResponse.json({ error: error.message || "Gagal mengupload tanda tangan." }, { status: 500 });
  }
}
