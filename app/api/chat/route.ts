import { generateAIContent } from "@/lib/ai";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `Kamu adalah CS assistant GuruPRO AI, platform administrasi keguruan berbasis AI untuk guru Indonesia. Bantu pengguna dengan informasi tentang fitur (RPP AI, absensi, jurnal, rapor, PKG), harga (Rp49.000/bulan), cara daftar, dan pertanyaan umum. Jawab dalam Bahasa Indonesia yang ramah dan profesional. Jika pertanyaan di luar produk GuruPRO, arahkan ke kontak CS manusia di wa.me/6281283960337.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const conversation = messages
      .slice(-10)
      .map(
        (m: any) =>
          `${m.role === "user" ? "User" : "Asisten"}: ${m.content}`
      )
      .join("\n");

    const prompt = `${SYSTEM_PROMPT}\n\nBerikut riwayat obrolan:\n${conversation}\nAsisten:`;

    const reply = await generateAIContent(prompt);
    const cleanReply = reply.replace(/^```markdown\s*|```\s*$/g, "").trim();

    return NextResponse.json({ reply: cleanReply });
  } catch (error: any) {
    console.error("/api/chat error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses chat" },
      { status: 500 }
    );
  }
}
