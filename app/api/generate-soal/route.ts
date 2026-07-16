import { generateAIContent } from "@/lib/ai";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { consumeUserToken, getUserTokenAccess } from "@/lib/token-system";
import { cookies } from "next/headers";
import { truncateText } from "@/lib/ai/validation-utils";

/**
 * Enforce Bank Soal output limits - truncate sesuai batas karakter
 */
function enforceSoalLimits(soal: any[]): any[] {
  if (!Array.isArray(soal)) return [];

  return soal.map((item: any) => ({
    ...item,
    pertanyaan: truncateText(item.pertanyaan, 500) || 'Pertanyaan tidak tersedia',
    opsi: Array.isArray(item.opsi)
      ? item.opsi.map((o: string) => truncateText(o, 150)).slice(0, 6)
      : null,
    kunci: item.kunci,
    pembahasan: truncateText(item.pembahasan, 300) || null,
    indikator: truncateText(item.indikator, 200) || null,
    elemen: truncateText(item.elemen, 150) || null,
    cp: truncateText(item.cp, 200) || null,
    tp: truncateText(item.tp, 200) || null,
    skor: item.skor || 1,
    gambar: item.gambar ? truncateText(item.gambar, 200) : null,
  }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // SaaS Token Validation
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    // Ambil data user
    const tokenState = await getUserTokenAccess(userId);
    if (!tokenState.user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }
    const user = tokenState.user;

    if (!tokenState.access.allowed) {
      const message = tokenState.access.reason === "subscription_expired"
        ? "Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu."
        : "Kredit token GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan di Landing Page.";
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const kurikulumName = body.kurikulum === 'merdeka' ? 'Kurikulum Merdeka' : body.kurikulum === 'k13' ? 'Kurikulum 2013 (K13)' : body.kurikulum === 'kbc' ? 'Kurikulum Berbasis Kompetensi (KBC)' : 'Kurikulum Hybrid';
    const bahasaName = body.bahasa === 'ar' ? 'Bahasa Arab (Full Hijaiyah)' : body.bahasa === 'en' ? 'Bahasa Inggris (Full English)' : 'Bahasa Indonesia';
    const opsiCount = parseInt(body.opsiPG) || 4;

    const keyMap: { [key: string]: string } = {
      pg: 'pg',
      isian: 'isian',
      essay: 'essay',
      pgKompleks: 'pg-kompleks',
      'pg-kompleks': 'pg-kompleks',
      bs: 'bs',
      jodoh: 'jodoh',
      urutan: 'urutan',
      tabel: 'tabel',
      sebabAkibat: 'sebab-akibat',
      'sebab-akibat': 'sebab-akibat'
    };

    const qtyString = Object.entries(body.qty || {})
      .filter(([type, qty]) => keyMap.hasOwnProperty(type) && (Number(qty) || 0) > 0)
      .map(([type, qty]) => {
        const standardType = keyMap[type];
        return `- Tipe "${standardType}": Buatlah sebanyak ${qty} soal`;
      })
      .join("\n");

    const levelsString = (body.activeLevels || []).join(", ");
    const proporsi = body.proporsi || { mudah: 40, sedang: 40, sulit: 20 };

    const visualMapping = body.visualMapping || { ilustrasi: [], diagram: [], mindmap: [] };
    const visQty = {
      ilustrasi: Number(body.qty?.ilustrasi) || 0,
      diagram: Number(body.qty?.diagram) || 0,
      mindmap: Number(body.qty?.mindmap) || 0
    };

    let visualInstructions = "";
    if (visQty.ilustrasi > 0 || visQty.diagram > 0 || visQty.mindmap > 0) {
      visualInstructions = `\n6. **Ketentuan Visual & Gambar (SANGAT PENTING)**:`;
      if (visQty.ilustrasi > 0) {
        const targets = (visualMapping.ilustrasi || []).map((t: string) => keyMap[t] || t).join(", ");
        visualInstructions += `\n   - Wajib menyertakan ilustrasi gambar visual (tulis deskripsi gambar di field 'gambar') pada tepat ${visQty.ilustrasi} butir soal. Gambar ini wajib diterapkan pada tipe soal: [${targets || 'Tipe soal apa saja'}].`;
      }
      if (visQty.diagram > 0) {
        const targets = (visualMapping.diagram || []).map((t: string) => keyMap[t] || t).join(", ");
        visualInstructions += `\n   - Wajib menyertakan diagram/grafik data (tulis deskripsi di field 'gambar') pada tepat ${visQty.diagram} butir soal. Diagram ini wajib diterapkan pada tipe soal: [${targets || 'Tipe soal apa saja'}].`;
      }
      if (visQty.mindmap > 0) {
        const targets = (visualMapping.mindmap || []).map((t: string) => keyMap[t] || t).join(", ");
        visualInstructions += `\n   - Wajib menyertakan peta konsep/mindmap (tulis deskripsi di field 'gambar') pada tepat ${visQty.mindmap} butir soal. Peta konsep ini wajib diterapkan pada tipe soal: [${targets || 'Tipe soal apa saja'}].`;
      }
      visualInstructions += `\n   - Selain soal yang ditentukan di atas, field 'gambar' wajib bernilai null. Jangan letakkan ilustrasi di luar tipe soal yang telah dipetakan!`;
    } else {
      visualInstructions = `\n6. **Ketentuan Visual & Gambar**: Field 'gambar' wajib bernilai null untuk semua soal.`;
    }

    const prompt = `
Anda adalah ahli pembuat soal pendidikan profesional untuk sekolah di Indonesia. 
Buatlah kumpulan soal ujian berkualitas tinggi berdasarkan spesifikasi berikut ini secara ketat:

1. **Informasi Umum**:
   - Mata Pelajaran: ${body.mapel || 'Umum'}
   - Kelas: ${body.kelas} (${body.jenjang})
   - Kurikulum: ${kurikulumName}
   - Topik / Materi Utama: ${body.topik}
   - Tujuan Pembelajaran: ${body.tujuan || 'Tidak ada spesifikasi khusus'}
   - Bahasa Pengantar: ${bahasaName}
   - Jenis Asesmen: ${body.jenisAsesmen}
   - Pendekatan Soal: ${body.pendekatan} (standar / literasi AKM / numerasi AKM)

2. **Materi Referensi (Sumber Soal)**:
   ${body.materiManual ? `Gunakan materi referensi berikut sebagai bahan utama pembuatan soal:\n\"\"\"\n${body.materiManual}\n\"\"\"` : 'Gunakan pengetahuan umum kurikulum pendidikan yang valid.'}

3. **Jumlah & Tipe Soal**:
   Buatlah total soal dengan tipe dan kuantitas berikut secara tepat:
   ${qtyString}

4. **Tingkat Kesulitan & Kognitif**:
   - Distribusi tingkat kesulitan wajib mengikuti proporsi ini secara proporsional: ${proporsi.mudah}% mudah, ${proporsi.sedang}% sedang, ${proporsi.sulit}% sulit.
   - Gunakan tingkatan kognitif Bloom's Taxonomy berikut secara merata pada soal: ${levelsString}.

5. **Ketentuan Format Soal per Tipe**:
   - **pg** (Pilihan Ganda): Sediakan tepat ${opsiCount} pilihan jawaban (contoh: jika 4 opsi, berikan pilihan A, B, C, D). Field 'opsi' berupa array string. Field 'kunci' berupa huruf jawaban yang benar (contoh: "A").
   - **isian** (Isian Singkat): Pertanyaan yang membutuhkan jawaban singkat. Field 'opsi' harus null. Field 'kunci' berupa kunci jawaban singkat yang tepat (string).
   - **essay** (Uraian / Essay): Pertanyaan deskriptif/analitis. Field 'opsi' harus null. Field 'kunci' berisi penjelasan panjang atau poin-poin kunci jawaban penilaian (string).
   - **pg-kompleks** (Pilihan Ganda Kompleks): Pertanyaan dengan lebih dari satu jawaban benar. Sediakan pilihan jawaban (A, B, C, D...). Field 'kunci' berupa array berisi huruf-huruf pilihan yang benar (contoh: ["A", "C"]).
   - **bs** (Benar / Salah): Pertanyaan pernyataan. Field 'opsi' berupa ["Benar", "Salah"]. Field 'kunci' berisi "Benar" atau "Salah".
   - **jodoh** (Menjodohkan): Menyandingkan pertanyaan dengan jawaban. Field 'pertanyaan' berisi instruksi menjodohkan. Sediakan field 'kunci' berupa array pasangan objek, misalnya: [{"kunci": "Jakarta", "nilai": "Indonesia"}, {"kunci": "Tokyo", "nilai": "Jepang"}].
   - **urutan**: Mengurutkan langkah-langkah atau kronologi. Sediakan field 'opsi' berisi daftar langkah acak. Sediakan field 'kunci' berupa array berisi urutan indeks atau teks yang benar.
   - **tabel**: Pertanyaan melengkapi tabel data. Sediakan field 'kunci' berupa string penjelasan pengisian.
   - **sebab-akibat**: Pertanyaan yang memiliki Pernyataan dan Alasan. Pilihan jawaban wajib A-E standar sebab-akibat (A: Pernyataan benar, alasan benar, berhubungan; B: Benar, benar, tidak berhubungan; C: Pernyataan benar, alasan salah; D: Pernyataan salah, alasan benar; E: Keduanya salah).

${visualInstructions}

Output harus berupa JSON murni dengan format schema berikut:

BATASAN PANJANG PER-FIELD (WAJIB DIIKUTI):
- pertanyaan (per soal): MAKSIMAL 500 KARAKTER
- opsi (setiap item): MAKSIMAL 150 KARAKTER
- pembahasan: MAKSIMAL 300 KARAKTER
- indikator: MAKSIMAL 200 KARAKTER
- elemen: MAKSIMAL 150 KARAKTER
- cp: MAKSIMAL 200 KARAKTER
- tp: MAKSIMAL 200 KARAKTER
- gambar (deskripsi): MAKSIMAL 200 KARAKTER

LARANGAN FORMAT MARKDOWN DI DALAM JSON VALUE:
- ❌ Jangan pakai **bold**, *italic*, # heading di dalam string
- ❌ Jangan pakai bullet list ( - , * ) di dalam string
- ✅ Gunakan plain text biasa saja

JSON SCHEMA:
{
  "soal": [
    {
      "nomor": 1,
      "pertanyaan": "string (maks 500 karakter)",
      "tipe": "pg" | "isian" | "essay" | "pg-kompleks" | "bs" | "jodoh" | "urutan" | "tabel" | "sebab-akibat",
      "tingkat": "mudah" | "sedang" | "sulit",
      "kognitif": "C1" | "C2" | "C3" | "C4" | "C5" | "C6",
      "opsi": ["A (maks 150 karakter)", "B", "C", "D"] | null,
      "kunci": "A" | ["A", "C"] | [{"kunci": "...", "nilai": "..."}],
      "pembahasan": "string (maks 300 karakter) | null",
      "indikator": "string (maks 200 karakter) | null",
      "elemen": "string (maks 150 karakter) | null",
      "cp": "string (maks 200 karakter) | null",
      "tp": "string (maks 200 karakter) | null",
      "skor": 1 | 2 | 3 | 5,
      "gambar": "deskripsi visual (maks 200 karakter) | null"
    }
  ]
}

CATATAN: AI TIDAK SELALU PATUH BATASAN KARAKTER. LAKUKAN TRUNCATE DI LAYER VALIDASI.`;

    // Call universal AI service and parse response before token deduction
    let parsed: any;
    try {
      const text = await generateAIContent(prompt);
      console.log("[Generate Soal] Raw AI response length:", text?.length);
      console.log("[Generate Soal] Raw AI response preview:", text?.substring(0, 500));

      if (!text || text.trim() === "") {
        throw new Error("AI mengembalikan respons kosong");
      }

      const cleanText = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleanText);

      // Validate response has soal array
      if (!parsed.soal || !Array.isArray(parsed.soal)) {
        console.error("[Generate Soal] Invalid response structure:", parsed);
        throw new Error("Respons AI tidak memiliki format yang benar (missing soal array)");
      }

      // Enforce character limits on all soal
      parsed.soal = enforceSoalLimits(parsed.soal);

      console.log("[Generate Soal] Successfully generated and validated", parsed.soal.length, "questions");
    } catch (aiError: any) {
      console.error("Generate Soal AI generation failed:", aiError);
      return NextResponse.json({ error: `Gagal memproses AI: ${aiError.message || aiError}` }, { status: 502 });
    }

    // Deduct token on success
    if (user.role !== "admin") {
      await consumeUserToken(userId, 1);
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat soal" }, { status: 500 });
  }
}