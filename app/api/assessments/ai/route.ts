import { generateAIContent } from "@/lib/ai";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { mapel, kelas, materi_capaian } = await req.json();

    if (!mapel || !kelas || !materi_capaian) {
      return NextResponse.json({ error: "mapel, kelas, dan materi_capaian wajib diisi" }, { status: 400 });
    }

    // 1. SaaS Token Validation
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
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
        error: "Kredit token GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan." 
      }, { status: 403 });
    }

    const prompt = `
Anda adalah asisten AI kurikulum sekolah Indonesia (Kurikulum Merdeka / K13). 
Tugas Anda adalah membuat rubrik penilaian, kisi-kisi asesmen, bank soal, dan saran pedagogis berdasarkan data berikut:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}
- Capaian Pembelajaran / Materi Utama: ${materi_capaian}

Harap berikan respons dalam JSON dengan format persis seperti ini:
{
  "rubrik": "Paragraf deskripsi kriteria ketuntasan minimal (KKM) serta aspek-aspek penilaian sikap, pengetahuan, dan keterampilan siswa secara rinci.",
  "soal": [
    {
      "pertanyaan": "Pertanyaan soal pilihan ganda 1",
      "pilihan": ["A. opsi1", "B. opsi2", "C. opsi3", "D. opsi4"],
      "kunci_jawaban": "A"
    },
    {
      "pertanyaan": "Pertanyaan soal pilihan ganda 2",
      "pilihan": ["A. opsi1", "B. opsi2", "C. opsi3", "D. opsi4"],
      "kunci_jawaban": "C"
    },
    {
      "pertanyaan": "Pertanyaan essay / uraian konkrit 3",
      "pilihan": [],
      "kunci_jawaban": "Kunci jawaban / ekspektasi jawaban ideal essay"
    }
  ],
  "saran_pedagogis": "Saran konkrit untuk guru mengenai strategi mengajar materi ini, termasuk alternatif intervensi untuk anak yang butuh remedial."
}
`;

    // 2. Call universal AI service and parse response before token deduction
    let parsed: any;
    try {
      const text = await generateAIContent(prompt);
      parsed = JSON.parse(text);
    } catch (aiError: any) {
      console.error("Assessment AI generation failed:", aiError);
      return NextResponse.json({ error: `Gagal memproses AI: ${aiError.message || aiError}` }, { status: 502 });
    }

    // 3. Deduct token on success
    if (user.role !== "admin") {
      await query("UPDATE users SET token_limit = GREATEST(0, token_limit - 1) WHERE id = $1", [userId]);
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Assessment AI helper error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
