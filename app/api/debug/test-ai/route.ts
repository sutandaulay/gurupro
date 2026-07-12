import { generateAIContent } from "@/lib/ai";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    console.log("[Debug AI] Testing AI generation...");

    const testPrompt = `Buat 3 soal pilihan ganda tentang matematika SD kelas 1. Balas HANYA dalam format JSON:
{
  "soal": [
    {
      "nomor": 1,
      "pertanyaan": "...",
      "tipe": "pg",
      "tingkat": "mudah",
      "kognitif": "C1",
      "opsi": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "kunci": "A",
      "pembahasan": "...",
      "indikator": "...",
      "elemen": "...",
      "cp": "...",
      "tp": "...",
      "skor": 1,
      "gambar": null
    }
  ]
}`;

    const result = await generateAIContent(testPrompt);

    return NextResponse.json({
      success: true,
      rawResponse: result,
      responseLength: result?.length
    });
  } catch (error: any) {
    console.error("[Debug AI] Error:", error);
    return NextResponse.json({
      error: error.message || String(error),
      stack: error.stack
    }, { status: 500 });
  }
}
