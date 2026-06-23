import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAIConfig } from "./settings";

/**
 * Universal AI client helper that calls the dynamically configured LLM vendor
 * (Gemini, OpenAI, Claude, DeepSeek, or Offline Mock).
 */
export async function generateAIContent(
  prompt: string,
  systemInstruction?: string,
  isJson: boolean = true
): Promise<string> {
  const config = await getAIConfig();
  const vendor = config.default_vendor || "mock";

  console.log(`[AI SERVICE] Invoking vendor: ${vendor.toUpperCase()}`);

  // 1. OFFLINE MOCK MODE
  if (vendor === "mock") {
    // Generate realistic simulated content to save API credits during sandbox tests
    if (isJson) {
      if (prompt.includes("rpp") || prompt.includes("Rencana Pelaksanaan Pembelajaran")) {
        return JSON.stringify({
          judul: "RPP Simulasi - Kurikulum Merdeka",
          konten: `
# RENCANA PELAKSANAAN PEMBELAJARAN (RPP) SIMULASI
**Mata Pelajaran**: Matematika / IPA / IPS
**Kurikulum**: Kurikulum Merdeka

## I. PENDAHULUAN (Alokasi Waktu: 10 Menit)
- Guru menyapa siswa, berdoa, dan mengecek kehadiran.
- Guru menyampaikan materi apersepsi dan tujuan pembelajaran hari ini.

## II. KEGIATAN INTI (Alokasi Waktu: 50 Menit)
- **Mengamati**: Siswa memperhatikan ilustrasi masalah sehari-hari.
- **Menanya**: Siswa merumuskan pertanyaan terkait studi kasus.
- **Mengeksplorasi**: Kerja kelompok menyusun analisis.

## III. PENUTUP (Alokasi Waktu: 10 Menit)
- Siswa dan guru melakukan refleksi bersama.
- Guru mengumumkan tugas remedial dan pengayaan singkat.
          `.trim()
        });
      }

      if (prompt.includes("modul") || prompt.includes("Modul Ajar")) {
        return JSON.stringify({
          judul: "Modul Ajar Simulasi - Kurikulum Merdeka",
          konten: `
# MODUL AJAR SIMULASI
**Kurikulum**: Kurikulum Merdeka

### A. Informasi Umum
- **Model Pembelajaran**: Discovery Learning
- **Sarana Prasarana**: Laptop, LCD Projector
- **Target Murid**: Reguler

### B. Komponen Inti
- **Pertanyaan Pemantik**: Apakah Anda mengetahui apa itu sains?
- **Kegiatan Pembelajaran**: Diskusi kelompok, presentasi materi, asesmen formatif kuis mandiri.
          `.trim()
        });
      }

      if (prompt.includes("silabus") || prompt.includes("Silabus")) {
        return JSON.stringify({
          judul: "Silabus Semester Simulasi",
          konten: `
# SILABUS PEMBELAJARAN SEMESTER (SIMULASI)

| Pertemuan Ke | Kompetensi Dasar / CP | Materi Pembelajaran | Kegiatan | Asesmen |
|--------------|-----------------------|---------------------|----------|---------|
| 1 - 2 | Pengenalan Materi Dasar | Teori Utama dan Sejarah | Ceramah & Tanya Jawab | Keaktifan Kelas |
| 3 - 4 | Penerapan Kasus | Studi Kasus Nyata | Kerja Kelompok | Kuis Tertulis |
          `.trim()
        });
      }

      if (prompt.includes("soal") || prompt.includes('"soal":')) {
        // Mock question bank
        return JSON.stringify({
          soal: [
            {
              nomor: 1,
              pertanyaan: "Manakah di antara pilihan berikut yang merupakan contoh implementasi penalaran kritis (HOTS) murid?",
              tipe: "pg",
              tingkat: "sedang",
              kognitif: "C3",
              opsi: [
                "A. Menghafal seluruh isi teks pelajaran secara verbatim.",
                "B. Menyusun hipotesis baru berdasarkan perbandingan dua teori ilmiah.",
                "C. Menyalin catatan guru langsung dari papan tulis.",
                "D. Membaca rangkuman bab secara berulang sebelum ujian."
              ],
              kunci: "B",
              pembahasan: "Menyusun hipotesis baru melibatkan proses berpikir tingkat tinggi (C4-C5) di mana siswa menganalisis dan menciptakan sesuatu yang orisinal berdasarkan referensi.",
              indikator: "Mengidentifikasi aktivitas kognitif HOTS",
              elemen: "Penalaran Ilmiah",
              cp: "Siswa mampu menerapkan cara berpikir kritis dalam kehidupan.",
              tp: "Menganalisis jenis-jenis penalaran kritis murid.",
              skor: 5,
              gambar: null
            },
            {
              nomor: 2,
              pertanyaan: "Sebutkan dan jelaskan secara singkat tiga pilar utama dalam kurikulum pendidikan formal di Indonesia!",
              tipe: "essay",
              tingkat: "sulit",
              kognitif: "C4",
              opsi: null,
              kunci: "Tiga pilar utama kurikulum di Indonesia umumnya mencakup aspek Sikap (Karakter), Pengetahuan (Kognitif), dan Keterampilan (Psikomotorik) yang diintegrasikan secara utuh.",
              pembahasan: "Jawaban dinilai berdasarkan kejelasan penjelasan pada ketiga pilar utama tersebut secara logis.",
              indikator: "Menjelaskan pilar kurikulum",
              elemen: "Kebijakan Kurikulum",
              cp: "Siswa memahami dasar-dasar struktur pendidikan.",
              tp: "Menguraikan pilar kurikulum formal.",
              skor: 10,
              gambar: null
            }
          ]
        });
      }

      if (prompt.includes("refleksi") || prompt.includes("tindak_lanjut")) {
        return JSON.stringify({
          refleksi: "Proses pembelajaran simulasi berjalan kondusif. Mayoritas siswa aktif berpartisipasi dan memahami materi konsep dasar secara interaktif.",
          tindak_lanjut: "Guru merencanakan pemberian latihan mandiri tambahan untuk remedial siswa di bawah KKM dan modul pengayaan bagi siswa yang telah lulus."
        });
      }

      // Generic JSON mock fallback
      return JSON.stringify({
        success: true,
        message: "Respons JSON simulasi offline GuruPRO.",
        originalPromptPreview: prompt.substring(0, 100) + "..."
      });
    }

    return "Ini adalah respons teks simulasi offline GuruPRO. Konfigurasi AI diatur ke mode 'Mock'.";
  }

  // 2. GOOGLE GEMINI SENDER
  if (vendor === "gemini") {
    const apiKey = config.gemini.api_key;
    if (!apiKey) throw new Error("GEMINI_API_KEY tidak dikonfigurasi di admin panel.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: config.gemini.model_name || "gemini-2.5-flash",
      systemInstruction: systemInstruction,
      generationConfig: isJson ? { responseMimeType: "application/json" } : undefined
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text.trim();
  }

  // 3. OPENAI SENDER
  if (vendor === "openai") {
    const apiKey = config.openai.api_key;
    if (!apiKey) throw new Error("OPENAI_API_KEY tidak dikonfigurasi di admin panel.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.openai.model_name || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction || "You are a professional Indonesian education consultant." },
          { role: "user", content: prompt + (isJson ? "\n\nRespond ONLY with a valid, clean JSON object matching the requested schema. Do not output codeblocks." : "") }
        ],
        response_format: isJson ? { type: "json_object" } : undefined,
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "OpenAI API returned error status");
    }

    return data.choices[0].message.content.trim();
  }

  // 4. DEEPSEEK SENDER
  if (vendor === "deepseek") {
    const apiKey = config.deepseek.api_key;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY tidak dikonfigurasi di admin panel.");

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.deepseek.model_name || "deepseek-chat",
        messages: [
          { role: "system", content: systemInstruction || "You are a professional Indonesian education consultant." },
          { role: "user", content: prompt + (isJson ? "\n\nRespond ONLY with a valid, clean JSON object matching the requested schema. Do not output codeblocks." : "") }
        ],
        response_format: isJson ? { type: "json_object" } : undefined,
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "DeepSeek API returned error status");
    }

    return data.choices[0].message.content.trim();
  }

  // 5. ANTHROPIC CLAUDE SENDER
  if (vendor === "claude") {
    const apiKey = config.claude.api_key;
    if (!apiKey) throw new Error("CLAUDE_API_KEY tidak dikonfigurasi di admin panel.");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.claude.model_name || "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        system: systemInstruction || "You are a professional Indonesian education consultant.",
        messages: [
          { role: "user", content: prompt + (isJson ? "\n\nRespond ONLY with a valid, clean JSON object matching the requested schema. Do not wrap in markdown block. Return the JSON text raw." : "") }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Anthropic API returned error status");
    }

    return data.content[0].text.trim();
  }

  throw new Error(`AI Vendor tidak dikenali: ${vendor}`);
}
