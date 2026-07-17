import { generateAIContent } from "@/lib/ai";
import { NextResponse } from "next/server";
import { getActivePricingPlans } from "@/lib/settings";
import { cookies } from "next/headers";
import { getUserPoinAccess, consumeUserPoin, logFailedPoinUsage } from "@/src/services/poin-service";
import { calculatePoinFromTokens } from "@/src/lib/ai-usage";

export async function POST(req: Request) {
  try {
    // Auth: chatbot hanya untuk user yang sudah login
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login terlebih dahulu." }, { status: 401 });
    }
    let userId: string | null = null;
    try {
      const sessionData = JSON.parse(sessionCookie);
      userId = sessionData?.id || null;
    } catch {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }
    if (!userId) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    // Poin check (non-admin)
    const userDb = await (await import("@/lib/db")).query(
      "SELECT role FROM users WHERE id = $1",
      [userId]
    );
    const role = userDb?.rows?.[0]?.role;
    if (role !== "admin") {
      const poinAccess = await getUserPoinAccess(userId);
      if (!poinAccess.access.allowed) {
        return NextResponse.json({
          error: poinAccess.access.reason === "subscription_expired"
            ? "Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu."
            : "Poin GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan di Landing Page.",
          reason: poinAccess.access.reason,
          remainingPoin: 0,
        }, { status: 403 });
      }
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    let pricingStr = "";
    try {
      const plans = await getActivePricingPlans();
      pricingStr = plans
        .map((p: any) => `${p.package_name} (Rp${Number(p.price).toLocaleString("id-ID")}, ${p.tokens} token, ${p.duration_days} hari)`)
        .join(", ");
    } catch (e) {
      pricingStr = "Paket Pro 3 Bulan (Rp135.000), 6 Bulan (Rp240.000), 1 Tahun (Rp420.000).";
    }

    const systemPrompt = `
Anda adalah Asisten Customer Service AI GuruPRO yang ramah dan profesional.
Tugas Anda adalah melayani pengunjung landing page GuruPRO dan menjawab pertanyaan mereka terkait platform GuruPRO, fitur-fitur, paket langganan, dan cara pendaftaran.

Informasi Platform GuruPRO:
1. Fitur Utama:
   - Pembuat Bank Soal Otomatis (PG, Isian, Essay, PG-Kompleks, Benar/Salah, Menjodohkan, Sebab-Akibat, Urutan, Tabel).
   - Administrasi Guru Lengkap (RPP, Modul Ajar, Silabus, LKPD, Laporan LKPD untuk Kepsek).
   - Keuangan Guru (Tabungan impian, Portofolio Investasi Emas/Saham/Reksadana, analisis cash flow).
   - Jurnal Kegiatan & Rapor Presensi/Nilai Siswa.
   - PWA (Progressive Web App) - Bisa diinstal di Android, iPhone, Windows, dan Mac.
2. Paket Harga (Pricing):
   - ${pricingStr}
   - Ada paket 3 bulan, 6 bulan, dan 1 tahun dengan kuota token AI.
3. Referral Program:
   - Undang teman dapat Rp10.000 tunai dan +20 Token. Teman dapat +10 Token.

Jawablah pertanyaan pengguna secara ringkas, sopan, dan persuasif dalam Bahasa Indonesia.
Jangan pernah memberikan informasi di luar lingkup GuruPRO.

Berikut riwayat obrolan:
${messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Asisten'}: ${m.content}`).join("\n")}
Asisten:`;

    const reply = await generateAIContent(systemPrompt);
    const cleanReply = (reply.data as string || reply.response?.text?.() || "").replace(/```markdown|```/g, "").trim();
    const rawUsage = reply.rawUsage;

    // Deduct Poin based on actual usage (non-admin)
    if (role !== "admin") {
      try {
        const poinCalc = calculatePoinFromTokens(
          rawUsage?.promptTokenCount || 0,
          rawUsage?.candidatesTokenCount || 0,
          rawUsage?.cachedContentTokenCount || 0
        );

        await consumeUserPoin(userId, poinCalc.rawTokens, "chatbot", {
          model: "gemini-2.5-flash-lite",
          provider: "gemini",
        });

        console.log(`[Chatbot] Poin deducted: ${poinCalc.poinNeeded} (${poinCalc.rawTokens} raw tokens)`);
      } catch (poinError: any) {
        console.error("[Chatbot] Poin deduction failed:", poinError);
      }
    }

    return NextResponse.json({ reply: cleanReply });
  } catch (error: any) {
    console.error("Chatbot API error:", error);
    return NextResponse.json({ error: error.message || "Failed to process chat" }, { status: 500 });
  }
}
