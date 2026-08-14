import { generateAIContentWithUsage } from "@/lib/ai";
import { NextResponse } from "next/server";
import { getActivePricingPlans } from "@/lib/settings";
import { cookies } from "next/headers";
import { getUserPoinAccess, logFailedPoinUsage } from "@/src/services/poin-service";
import { deductPoinFromAIResult } from "@/src/lib/ai-usage";
import { enforceOutputLimits } from "@/lib/ai/limits";
import { parseSessionCookie } from "@/lib/session-sign";

export async function POST(req: Request) {
  try {
    // Auth: chatbot hanya untuk user yang sudah login
    const sessionData = parseSessionCookie((await cookies()).get("gurupro_session")?.value);
    const userId = sessionData?.id || null;
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

    const reply = await generateAIContentWithUsage(systemPrompt, undefined, false); // isJson=false for free text
    const cleanReply = enforceOutputLimits(reply.text.replace(/```markdown|```/g, "").trim());

    // Deduct Poin based on actual usage (non-admin)
    if (role !== "admin") {
      try {
        await deductPoinFromAIResult(
          { success: true, usage: reply.usage },
          userId,
          "chatbot",
          {}
        );

          console.log(`[Chatbot] Poin deducted`);
      } catch (poinError: unknown) {
        console.error("[Chatbot] Poin deduction failed:", poinError);
      }
    }

    return NextResponse.json({ reply: cleanReply });
  } catch (error: unknown) {
    console.error("Chatbot API error:", error);
    const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
