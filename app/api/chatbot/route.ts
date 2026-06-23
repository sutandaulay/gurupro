import { generateAIContent } from "@/lib/ai";
import { NextResponse } from "next/server";
import { getPricingConfig } from "@/lib/settings";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    let pricingStr = "";
    try {
      const pricing = await getPricingConfig();
      pricingStr = JSON.stringify(pricing);
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
    const cleanReply = reply.replace(/```markdown|```/g, "").trim();

    return NextResponse.json({ reply: cleanReply });
  } catch (error: any) {
    console.error("Chatbot API error:", error);
    return NextResponse.json({ error: error.message || "Failed to process chat" }, { status: 500 });
  }
}
