import { generateAIContentWithUsage } from "@/lib/ai";
import { query } from "@/lib/db";
import { getUserPoinAccess, logFailedPoinUsage } from "@/src/services/poin-service";
import { deductPoinFromAIResult } from "@/src/lib/ai-usage";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";
import { generateLkpdPdfBuffer, generateLkpdDocBuffer } from "@/lib/doc-compiler";
import { lkpdOutputSchema, lkpdFormInputSchema } from "@/lib/schemas/lkpd";
import { z } from "zod";
import { truncateText } from "@/lib/ai/validation-utils";
import { parseSessionCookie } from "@/lib/session-sign";

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
    const session = parseSessionCookie(sessionCookie);
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const userId = session.id;

    const poinState = await getUserPoinAccess(userId);
    if (!poinState.user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }
    const user = poinState.user;

    if (!poinState.access.allowed) {
      const message = poinState.access.reason === "subscription_expired"
        ? "Masa aktif langganan akun Anda telah habis. Silakan perpanjang paket terlebih dahulu."
        : "Poin GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan.";
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
    let aiResult: Awaited<ReturnType<typeof generateAIContentWithUsage>> | null = null;
    try {
      aiResult = await generateAIContentWithUsage(prompt, lkpdSystemPrompt, true);
      console.log("[Generate LKPD] Raw AI response length:", aiResult?.text?.length);

      const text = aiResult.text;
      if (!text || text.trim() === "") {
        throw new Error("AI mengembalikan respons kosong");
      }

      const cleanText = text.replace(/```json|```/g, "").trim();
      parsed = lkpdOutputSchema.parse(JSON.parse(cleanText));

      console.log("[Generate LKPD] Successfully generated LKPD with", parsed.aktivitas.length, "activities");
    } catch (aiError: unknown) {
      console.error("LKPD AI generation failed:", aiError);
      const aiMsg = aiError instanceof Error ? aiError.message : String(aiError ?? "Unknown error");

      // Log failed usage
      await logFailedPoinUsage(userId, 0, "generate-lkpd", aiMsg);

      return NextResponse.json(
        { error: `Gagal memproses AI: ${aiMsg}` },
        { status: 502 }
      );
    }

    // Compile & Upload LKPD files
    let pdfUrl: string | null = null;
    let docxUrl: string | null = null;
    try {
      const docTitle = `LKPD - ${parsed.identitas.mataPelajaran} (Fase ${parsed.identitas.fase})`;

      // Fetch user info for signature
      const userRes = await query(
        "SELECT nama_lengkap, nip, signature_url FROM users WHERE id = $1",
        [userId]
      );
      const userInfo = userRes.rows[0] || {};

      // Fetch school info for kop sekolah and kepala signature
      let schoolData: any = { nama_sekolah: input.school_name || null, alamat: null, npsn: input.school_npsn || null, logo: null, nama_kepala_sekolah: null, nip_kepala_sekolah: null, kepala_signature_url: null };
      if (input.school_id) {
        try {
          const schoolRes = await query(
            `SELECT s.nama_sekolah, s.alamat, s.npsn, s.logo,
                    i.nama_kepala_sekolah, i.nip_kepala_sekolah,
                    ks.signature_url AS kepala_signature_url
             FROM user_schools us
             JOIN schools s ON s.id = us.school_id
             LEFT JOIN institutions i ON i.school_id = s.id
             LEFT JOIN users ks ON ks.nama_sekolah = s.nama_sekolah AND ks.role = 'kepala_sekolah'
             WHERE us.user_id = $1 AND s.id = $2`,
            [userId, input.school_id]
          );
          if (schoolRes.rows[0]) {
            schoolData = schoolRes.rows[0];
          }
        } catch (_) {}
      }

      const pdfBuf = await generateLkpdPdfBuffer(parsed, docTitle, {
        logoUrl: schoolData.logo,
        namaSekolah: schoolData.nama_sekolah,
        alamat: schoolData.alamat,
        npsn: schoolData.npsn,
        kepalaNama: schoolData.nama_kepala_sekolah,
        kepalaNip: schoolData.nip_kepala_sekolah,
        guruNama: userInfo.nama_lengkap,
        guruNip: userInfo.nip,
        guruSignatureUrl: userInfo.signature_url,
        kepalaSignatureUrl: schoolData.kepala_signature_url,
        lokasi: schoolData.nama_sekolah,
        tanggal: new Date(),
      });
      pdfUrl = await uploadToR2(pdfBuf, `${Date.now()}-lkpd.pdf`, "application/pdf");

      const docBuf = generateLkpdDocBuffer(parsed, docTitle, {
        logoUrl: schoolData.logo,
        namaSekolah: schoolData.nama_sekolah,
        alamat: schoolData.alamat,
        npsn: schoolData.npsn,
        kepalaNama: schoolData.nama_kepala_sekolah,
        kepalaNip: schoolData.nip_kepala_sekolah,
        guruNama: userInfo.nama_lengkap,
        guruNip: userInfo.nip,
        guruSignatureUrl: userInfo.signature_url,
        kepalaSignatureUrl: schoolData.kepala_signature_url,
        lokasi: schoolData.nama_sekolah,
        tanggal: new Date(),
      });
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

    // Deduct Poin only if AI was used and succeeded
    if (user.role !== "admin" && aiResult?.usage) {
      try {
        await deductPoinFromAIResult(
          { success: true, usage: aiResult.usage },
          userId,
          "generate-lkpd",
          {}
        );
        console.log(`[Generate LKPD] Poin deducted`);
      } catch (poinError: unknown) {
        console.error("[Generate LKPD] Poin deduction failed:", poinError);
      }
    }

    return NextResponse.json({
      ...parsed,
      pdf_url: pdfUrl,
      docx_url: docxUrl,
      modulAjarRef: modulAjarRef,
    });
  } catch (error: unknown) {
    console.error("LKPD Generation Error:", error);
    const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
