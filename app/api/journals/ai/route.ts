import { generateAIContent } from "@/lib/ai";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { materi, aktivitas, tujuan, mapel, kelas, kurikulum } = await req.json();

    if (!materi || !aktivitas || !tujuan) {
      return NextResponse.json({ error: "materi, aktivitas, dan tujuan wajib diisi" }, { status: 400 });
    }

    // 1. SaaS Token Validation
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const userRes = await query("SELECT token_limit, role FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }
    const user = userRes.rows[0];

    if (user.role !== "admin" && (user.token_limit || 0) <= 0) {
      return NextResponse.json({ 
        error: "Kredit token GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan di Landing Page." 
      }, { status: 403 });
    }

    const kurikulumLabel = kurikulum === "merdeka" ? "Kurikulum Merdeka"
      : kurikulum === "k13" ? "Kurikulum 2013 (K13)"
      : kurikulum === "kbc" ? "Kurikulum Berbasis Cinta (KBC)"
      : kurikulum === "hybrid" ? "Kurikulum Hybrid (Gabungan)"
      : "Kurikulum Merdeka";

    const prompt = `
Anda adalah pakar pendidik dan kurikulum Indonesia. Bantu guru menyusun refleksi guru dan rencana tindak lanjut (remedial/pengayaan) secara akademis, formal, dan rapi untuk jurnal ajar.

Data aktivitas pembelajaran:
- Kurikulum: ${kurikulumLabel}
- Mata Pelajaran: ${mapel || "-"}
- Kelas: ${kelas || "-"}
- Materi Pembelajaran: ${materi}
- Tujuan Pembelajaran: ${tujuan}
- Aktivitas yang Dilakukan: ${aktivitas}

Harap berikan respons dalam JSON dengan skema berikut:
{
  "refleksi": "paragraf analisis hasil belajar, respon siswa, kendala, dan suasana kelas",
  "tindak_lanjut": "paragraf konkrit tentang rencana perbaikan mengajar, remedial bagi siswa kurang, atau pengayaan bagi siswa pintar"
}
`;

    // 2. Call universal AI service and parse response before token deduction
    let parsed: any;
    try {
      const text = await generateAIContent(prompt);
      parsed = JSON.parse(text);
    } catch (aiError: any) {
      console.error("Journal AI generation failed:", aiError);
      return NextResponse.json({ error: `Gagal memproses AI: ${aiError.message || aiError}` }, { status: 502 });
    }

    // 3. Deduct token on success
    if (user.role !== "admin") {
      await query("UPDATE users SET token_limit = GREATEST(0, token_limit - 1) WHERE id = $1", [userId]);
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Journal AI helper error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
