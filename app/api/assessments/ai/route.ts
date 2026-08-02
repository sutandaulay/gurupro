import { generateAIContentWithUsage } from "@/lib/ai";
import { query } from "@/lib/db";
import { getUserPoinAccess, logFailedPoinUsage } from "@/src/services/poin-service";
import { deductPoinFromAIResult } from "@/src/lib/ai-usage";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { mapel, kelas, materi_capaian, kurikulum } = await req.json();

    if (!mapel || !kelas || !materi_capaian) {
      return NextResponse.json({ error: "mapel, kelas, dan materi_capaian wajib diisi" }, { status: 400 });
    }

    // 1. SaaS Poin Validation
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const poinState = await getUserPoinAccess(userId);
    if (!poinState.user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }
    const user = poinState.user;

    if (!poinState.access.allowed) {
      const message = poinState.access.reason === "subscription_expired"
        ? "Masa aktif langganan akun Anda telah habis. Silakan perpanjang paket terlebih dahulu."
        : "Poin GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan.";
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const kurikulumLabel = kurikulum === "merdeka" ? "Kurikulum Merdeka"
      : kurikulum === "k13" ? "Kurikulum 2013 (K13)"
      : kurikulum === "kbc" ? "Kurikulum Berbasis Cinta (KBC)"
      : kurikulum === "hybrid" ? "Kurikulum Hybrid (Gabungan)"
      : "Kurikulum Merdeka";

    const prompt = `
Anda adalah asisten AI kurikulum sekolah Indonesia. 
Tugas Anda adalah membuat rubrik penilaian, kisi-kisi asesmen, bank soal, dan saran pedagogis berdasarkan data berikut:
- Kurikulum: ${kurikulumLabel}
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

    // 2. Call universal AI service and parse response
    let parsed: any;
    let aiResult: Awaited<ReturnType<typeof generateAIContentWithUsage>> | null = null;
    try {
      aiResult = await generateAIContentWithUsage(prompt);
      const cleanText = (aiResult.text || '').trim();
      if (!cleanText) {
        throw new Error("AI generation returned empty response");
      }

      try {
        parsed = JSON.parse(cleanText);
      } catch {
        parsed = { raw: cleanText };
      }

      if (!parsed) {
        throw new Error("AI generation failed");
      }
    } catch (aiError: unknown) {
      console.error("Assessment AI generation failed:", aiError);
      const aiMsg = aiError instanceof Error ? aiError.message : String(aiError ?? "Unknown error");

      // Log failed usage
      await logFailedPoinUsage(userId, 0, "assessments-ai", aiMsg);

      return NextResponse.json({ error: `Gagal memproses AI: ${aiMsg}` }, { status: 502 });
    }

    // 3. Deduct Poin based on actual usage
    if (user.role !== "admin") {
      try {
        await deductPoinFromAIResult(
          { success: true, usage: aiResult?.usage || null },
          userId,
          "assessments-ai",
          { mapel, jenjang: kurikulum }
        );

          console.log(`[Assessments AI] Poin deducted`);
        } catch (poinError: unknown) {
        console.error("[Assessments AI] Poin deduction failed:", poinError);
      }
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Assessment AI helper error:", error);
    const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
