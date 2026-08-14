import { generateAIContentWithUsage } from "@/lib/ai";
import { query } from "@/lib/db";
import { consumeUserPoinFromUsage, logFailedPoinUsage } from "@/src/services/poin-service";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookie } from "@/lib/session-sign";

export async function POST(req: Request) {
  try {
    const { materi, aktivitas, tujuan, mapel, kelas, kurikulum } = await req.json();

    if (!materi || !aktivitas || !tujuan) {
      return NextResponse.json({ error: "materi, aktivitas, dan tujuan wajib diisi" }, { status: 400 });
    }

    // 1. SaaS Poin Validation
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }
    const userId = session.id;

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

    // 2. Call universal AI service and parse response
    let parsed: any;
    let result: Awaited<ReturnType<typeof generateAIContentWithUsage>> | null = null;
    try {
      result = await generateAIContentWithUsage(prompt);
      if (!result.text) {
        throw new Error("AI generation returned empty response");
      }
      parsed = JSON.parse(result.text);

      // 3. Deduct Poin from actual usage (fallback estimasi bila usage null)
      if (session.role !== "admin") {
        await consumeUserPoinFromUsage(userId, result.usage, "journals-ai", {
          mapel: mapel || "-",
          jenjang: "-",
        });
      }
    } catch (aiError: any) {
      console.error("Journal AI generation failed:", aiError);
      await logFailedPoinUsage(userId, 0, "journals-ai", aiError.message, {
        mapel: mapel || "-",
        jenjang: "-",
      });
      return NextResponse.json({ error: `Gagal memproses AI: ${aiError.message || aiError}` }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Journal AI helper error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
