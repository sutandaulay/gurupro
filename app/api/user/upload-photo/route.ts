import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { uploadToR2 } from "@/lib/r2";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const formData = await req.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File foto tidak ditemukan." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Tipe file tidak didukung. Gunakan JPEG, PNG, WebP, atau GIF." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ukuran file maksimal 2MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let fileName = `profile-${userId}`;
    const ext = file.name.split(".").pop();
    if (ext) fileName += `.${ext}`;

    const url = await uploadToR2(buffer, fileName, file.type);

    if (!url) {
      return NextResponse.json({ error: "Gagal mengupload foto. Server storage tidak tersedia." }, { status: 500 });
    }

    await query("UPDATE users SET photo_url = $1 WHERE id = $2", [url, userId]);

    return NextResponse.json({
      message: "Foto profil berhasil diperbarui!",
      photo_url: url,
    });
  } catch (error: any) {
    console.error("Upload photo API error:", error);
    return NextResponse.json({ error: error.message || "Gagal mengupload foto." }, { status: 500 });
  }
}
