import { generateAIContent } from "@/lib/ai";
import { query } from "@/lib/db";
import { consumeUserToken, getUserTokenAccess } from "@/lib/token-system";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";
import { generateLkpdPdfBuffer, generateLkpdDocBuffer } from "@/lib/doc-compiler";
import { lkpdOutputSchema, lkpdFormInputSchema } from "@/lib/schemas/lkpd";
import { z } from "zod";
import { truncateText } from "@/lib/ai/validation-utils";

// ==========================================
// LKPD GENERATOR - Lembar Kerja Peserta Didik
// Student worksheet based on Modul Ajar or manual input
// ==========================================

const lkpdSystemPrompt = `Kamu adalah asisten penyusun LKPD (Lembar Kerja Peserta Didik) untuk siswa Indonesia,
sesuai prinsip Pembelajaran Mendalam (Permendikdasmen No. 1/2026 & 13/2025).

ATURAN WAJIB:
1. LKPD ditujukan untuk SISWA, bukan guru — bahasa harus sesuai usia/fase, instruksi jelas dan actionable, bukan uraian teori panjang.
2. Aktivitas harus mencerminkan tahap yang diminta (memahami dan/atau mengaplikasi).
3. Tiap aktivitas punya jenisRespon yang sesuai isinya — variasikan sesuai kebutuhan (isian singkat untuk fakta, tabel untuk perbandingan, dst).
4. refleksiSingkat maksimal 3 pertanyaan, singkat dan personal (contoh: "Bagian mana yang paling sulit buatmu? Kenapa?") — bukan pertanyaan formal seperti asesmen.
5. Jika sumber dari Modul Ajar, SELARASKAN dengan tujuanPembelajaran dan aktivitas inti yang sudah ada di sana — jangan buat LKPD yang temanya melenceng dari Modul Ajar induknya.

BATASAN PANJANG PER-FIELD (WAJIB DIIKUTI):
- petunjukPengerjaan (setiap item): MAKSIMAL 150 KARAKTER
- tujuanKegiatan: MAKSIMAL 300 KARAKTER
- instruksi aktivitas (setiap item): MAKSIMAL 400 KARAKTER
- refleksiSingkat (setiap item): MAKSIMAL 200 KARAKTER

LARANGAN FORMAT MARKDOWN DI DALAM JSON VALUE:
- ❌ Jangan pakai **bold**, *italic*, # heading
- ❌ Jangan pakai bullet list ( - , * ) di dalam string
- ❌ Jangan pakai \`code block\` di dalam string
- ✅ Gunakan plain text biasa saja

OUTPUT JSON SCHEMA:
{
  "identitas": {
    "mataPelajaran": "string",
    "fase": "A/B/C/D/E/F",
    "topik": "string",
    "namaSiswa": null,
    "kelompok": null
  },
  "petunjukPengerjaan": ["string (2-5 items, maks 150 karakter per item)"],
  "tujuanKegiatan": "string (maks 300 karakter)",
  "aktivitas": [
    {
      "nomor": number,
      "instruksi": "string (jelas, untuk siswa, maks 400 karakter)",
      "tahap": "memahami | mengaplikasi",
      "jenisRespon": "isian_singkat | uraian | tabel | gambar_diagram | checklist",
      "ruangJawabanBaris": number (1-10)
    }
  ],
  "refleksiSingkat": ["string (1-3 items, maks 200 karakter per item)"]
}

CONTOH OUTPUT YANG BENAR:
{
  "identitas": {
    "mataPelajaran": "Matematika",
    "fase": "D",
    "topik": "Bangun Datar Segitiga",
    "namaSiswa": null,
    "kelompok": null
  },
  "petunjukPengerjaan": [
    "Baca soal dengan teliti sebelum menjawab.",
    "Kerjakan soal yang mudah terlebih dahulu.",
    "Tulis jawaban di ruang yang tersedia."
  ],
  "tujuanKegiatan": "Ananda dapat menghitung luas dan keliling segitiga dengan tepat.",
  "aktivitas": [
    {
      "nomor": 1,
      "instruksi": "Amati gambar segitiga di bawah. Hitung luasnya dengan rumus L = ½ × alas × tinggi.",
      "tahap": "memahami",
      "jenisRespon": "isian_singkat",
      "ruangJawabanBaris": 2
    },
    {
      "nomor": 2,
      "instruksi": "Buat soal cerita tentang penerapan segitiga dalam kehidupan sehari-hari, lalu selesaikan.",
      "tahap": "mengaplikasi",
      "jenisRespon": "uraian",
      "ruangJawabanBaris": 5
    }
  ],
  "refleksiSingkat": [
    "Apa yang sudah kamu pahami dari materi ini?",
    "Apa yang masih membingungkan?"
  ]
}

CATATAN: AI TIDAK SELALU PATUH BATASAN KARAKTER. LAKUKAN TRUNCATE DI LAYER VALIDASI.

Keluarkan HANYA JSON valid sesuai schema, tanpa teks pembuka/penutup/markdown fence.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate input
    const parseResult = lkpdFormInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Input tidak valid", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Auth
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const tokenState = await getUserTokenAccess(userId);
    if (!tokenState.user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }
    const user = tokenState.user;

    if (!tokenState.access.allowed) {
      const message = tokenState.access.reason === "subscription_expired"
        ? "Masa aktif langganan akun Anda telah habis. Silakan perpanjang paket terlebih dahulu."
        : "Kredit token GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan.";
      return NextResponse.json({ error: message }, { status: 403 });
    }

    // Prepare context
    let modulAjarContext = null;
    let mapel = input.mataPelajaran || "Umum";
    let fase = input.fase || "E";
    let topik = input.topikUtama || "Umum";
    let tujuanPembelajaran = input.tujuanPembelajaran || "Tidak ditentukan";
    let modulAjarRef = input.modulAjarId || null;

    // If from Modul Ajar, fetch context
    if (input.sumberData === "dari_modul_ajar" && input.modulAjarId) {
      try {
        const modulResult = await query(`
          SELECT mapel, fase, topik, tp, materi_pokok
          FROM modul_ajar
          WHERE id = $1 AND guru_id = $2
        `, [input.modulAjarId, userId]);

        if (modulResult.rows.length > 0) {
          const modul = modulResult.rows[0];
          mapel = modul.mapel || mapel;
          fase = modul.fase || fase;
          topik = modul.topik || topik;

          // Parse TP array
          if (modul.tp) {
            const tpData = typeof modul.tp === 'string' ? JSON.parse(modul.tp) : modul.tp;
            if (Array.isArray(tpData)) {
              tujuanPembelajaran = tpData.join("; ");
            }
          }

          modulAjarContext = {
            id: input.modulAjarId,
            mapel,
            fase,
            topik,
            tp: tujuanPembelajaran,
          };
        }
      } catch (dbErr) {
        console.error("Failed to fetch Modul Ajar context:", dbErr);
      }
    }

    // Prepare prompt
    const tahapLabel = input.tahapFokus === 'gabungan' ? 'Memahami dan Mengaplikasi'
      : input.tahapFokus === 'memahami' ? 'Memahami'
      : 'Mengaplikasi';

    const jenisLabel = input.jenisAktivitas === 'kelompok' ? 'kerja kelompok' : 'kerja individu';

    const prompt = `
BUAT LKPD (LEMBAR KERJA PESERTA DIDIK) SESUAI SPESIFIKASI BERIKUT:

## IDENTITAS
- Mata Pelajaran: ${mapel}
- Fase: ${fase}
- Topik: ${topik}
- Jenis Aktivitas: ${jenisLabel}
- Tahap Fokus: ${tahapLabel}

## TUJUAN PEMBELAJARAN
${tujuanPembelajaran}

## KONTEKS MODUL AJAR (jika ada)
${modulAjarContext ? `Modul Ajar ID: ${modulAjarContext.id}
Topik: ${modulAjarContext.topik}
Tujuan Pembelajaran: ${modulAjarContext.tp}` : 'Tidak ada modul ajar terkait - buat LKPD secara mandiri'}

## INSTRUKSI KHUSUS
1. LKPD ini用于 siswa (bukan guru) - gunakan bahasa yang sesuai usia
2. Aktivitas fokus pada tahap: ${tahapLabel}
3. Variasikan jenis respon: beberapa isian singkat, beberapa uraian, dst - JANGAN semua "uraian"
4. Pertanyaan refleksi harus personal dan singkat (bukan soal formal)
5. Ruang jawaban harus cukup luas untuk ditulis tangan
6. Desain ready untuk PRINT (fotokopi) - minim warna/dekorasi

Keluarkan HANYA JSON valid tanpa markdown fence atau teks pembuka.
`;

    let parsed: z.infer<typeof lkpdOutputSchema>;
    try {
      const text = await generateAIContent(prompt, lkpdSystemPrompt, true);
      console.log("[Generate LKPD] Raw AI response length:", text?.length);

      if (!text || text.trim() === "") {
        throw new Error("AI mengembalikan respons kosong");
      }

      const cleanText = text.replace(/```json|```/g, "").trim();
      parsed = lkpdOutputSchema.parse(JSON.parse(cleanText));

      console.log("[Generate LKPD] Successfully generated LKPD with", parsed.aktivitas.length, "activities");
    } catch (aiError: any) {
      console.error("LKPD AI generation failed:", aiError);
      return NextResponse.json(
        { error: `Gagal memproses AI: ${aiError.message || aiError}` },
        { status: 502 }
      );
    }

    // Compile & Upload LKPD files
    let pdfUrl: string | null = null;
    let docxUrl: string | null = null;
    try {
      const docTitle = `LKPD - ${parsed.identitas.mataPelajaran} (Fase ${parsed.identitas.fase})`;

      const pdfBuf = await generateLkpdPdfBuffer(parsed, docTitle);
      pdfUrl = await uploadToR2(pdfBuf, `${Date.now()}-lkpd.pdf`, "application/pdf");

      const docBuf = generateLkpdDocBuffer(parsed, docTitle);
      docxUrl = await uploadToR2(docBuf, `${Date.now()}-lkpd.doc`, "application/msword");
    } catch (uploadErr) {
      console.error("Failed to compile or upload LKPD files:", uploadErr);
    }

    // Save to database
    const judulDokumen = `LKPD - ${parsed.identitas.topik} (Fase ${parsed.identitas.fase})`;
    try {
      await query(`
        INSERT INTO guru_administrasi (
          user_id, tipe_dokumen, judul_dokumen, konten,
          school_id, jenjang, kurikulum, fase
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        userId,
        'lkpd',
        judulDokumen,
        JSON.stringify({
          identitas: parsed.identitas,
          petunjukPengerjaan: parsed.petunjukPengerjaan,
          tujuanKegiatan: parsed.tujuanKegiatan,
          aktivitas: parsed.aktivitas,
          refleksiSingkat: parsed.refleksiSingkat,
          generated_with_ai: true,
          pdf_url: pdfUrl,
          docx_url: docxUrl,
          modulAjarRef: modulAjarRef,
        }),
        input.school_id || null,
        input.jenjang || null,
        input.kurikulum || null,
        parsed.identitas.fase,
      ]);
    } catch (dbErr) {
      console.error("Failed to save LKPD:", dbErr);
    }

    // Deduct token
    if (user.role !== "admin") {
      await consumeUserToken(userId, 1);
    }

    return NextResponse.json({
      ...parsed,
      pdf_url: pdfUrl,
      docx_url: docxUrl,
      modulAjarRef: modulAjarRef,
    });
  } catch (error: any) {
    console.error("LKPD Generation Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal generate LKPD" },
      { status: 500 }
    );
  }
}
