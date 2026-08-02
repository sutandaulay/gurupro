import { generateAIContentWithUsage } from "@/lib/ai";
import { query } from "@/lib/db";
import { getUserPoinAccess, logFailedPoinUsage } from "@/src/services/poin-service";
import { deductPoinFromAIResult } from "@/src/lib/ai-usage";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";
import { generateLaporanEvaluasiPdfBuffer, generateLaporanEvaluasiDocBuffer } from "@/lib/doc-compiler";
import {
  laporanEvaluasiLkpdInputSchema,
  laporanEvaluasiLkpdOutputSchema
} from "@/lib/schemas/laporan-evaluasi-lkpd";
import { z } from "zod";
import {
  getUserInstitutionRole,
  isInstitutionMember,
  canViewAllTeachers,
} from "@/lib/rbac/institution-permissions";

// ==========================================
// LAPORAN EVALUASI LKPD GENERATOR
// Evaluation report for school leadership (Principal/Vice Principal)
// NOT a planning document - formal administrative language
// ==========================================

const systemPromptCache = `Kamu adalah asisten penyusun Laporan Evaluasi LKPD untuk dilaporkan ke Kepala Sekolah/Wakasek,
berdasarkan data hasil kerja siswa yang sudah direkap.

ATURAN WAJIB:
1. Nada bahasa ADMINISTRATIF-FORMAL, ditujukan ke pimpinan sekolah, bukan ke siswa atau sesama guru.
2. ringkasanEksekutif harus BISA DIBACA DALAM 30 DETIK - padat, langsung ke temuan penting, tanpa
   basa-basi seremonial.
3. capaianPerKKTP dihitung dari data yang diberikan (bukan mengarang angka) - jika data kualitatif
   saja (tanpa angka), berikan estimasi kategori berdasarkan deskripsi guru dan tandai jelas bahwa
   ini estimasi kualitatif bukan hitungan pasti.
4. JANGAN sebutkan nama siswa individual di ringkasanEksekutif atau temuanUtama - cukup agregat
   ("6 dari 32 siswa" bukan daftar nama). Nama detail per siswa (jika ada) disimpan terpisah di
   data mentah, bukan di narasi laporan ini.
5. rekomendasiTindakLanjut harus actionable dan spesifik untuk kelas/topik ini, bukan saran umum
   seperti "tingkatkan motivasi belajar".

BATASAN PANJANG PER-FIELD (WAJIB DIIKUTI):
- ringkasanEksekutif: MAKSIMAL 500 KARAKTER
- temuanUtama (setiap item): MAKSIMAL 300 KARAKTER
- rekomendasiTindakLanjut (setiap item): MAKSIMAL 250 KARAKTER
- siswaPerluPerhatian.catatan: MAKSIMAL 500 KARAKTER

LARANGAN FORMAT MARKDOWN DI DALAM JSON VALUE:
- ❌ Jangan pakai **bold**, *italic*, # heading
- ❌ Jangan pakai bullet list ( - , * ) di dalam string
- ❌ Jangan pakai \`code block\` di dalam string
- ✅ Gunakan plain text biasa saja

OUTPUT JSON SCHEMA:
{
  "identitas": {
    "mataPelajaran": "string",
    "kelas": "string",
    "periodeEvaluasi": "string",
    "jumlahSiswa": number,
    "guruPengampu": "string | null",
    "lkpdRef": "string | null"
  },
  "ringkasanEksekutif": "string (maksimal 500 karakter)",
  "capaianPerKKTP": [
    {
      "kktp": "string (maksimal 200 karakter)",
      "persentaseTuntas": number (0-100),
      "kategoriCapaian": "sangat_baik | baik | cukup | perlu_perhatian"
    }
  ],
  "temuanUtama": ["string (1-5 items, maksimal 300 karakter per item)"],
  "siswaPerluPerhatian": {
    "catatan": "string (maksimal 500 karakter, agregat bukan nama individual)",
    "jumlahSiswaTerdampak": number
  } | null,
  "rekomendasiTindakLanjut": ["string (1-5 items, maksimal 250 karakter per item)"],
  "isEstimasiKualitatif": boolean
}

CONTOH OUTPUT YANG BENAR:
{
  "identitas": {
    "mataPelajaran": "Matematika",
    "kelas": "VII-A",
    "periodeEvaluasi": "Semester Ganjil 2026/2027",
    "jumlahSiswa": 32,
    "guruPengampu": "Budi Santoso, S.Pd.",
    "lkpdRef": "LKPD-BNG-VII-2026"
  },
  "ringkasanEksekutif": "Secara umum, 75% siswa (24 dari 32) telah tuntas pada LKPD Bangun Datar. Capaian paling tinggi pada topik segitiga (87%) namun perlu perhatian pada topik lingkaran (58%).",
  "capaianPerKKTP": [
    {"kktp": "Mengidentifikasi jenis bangun datar", "persentaseTuntas": 87, "kategoriCapaian": "sangat_baik"},
    {"kktp": "Menghitung luas bangun datar", "persentaseTuntas": 72, "kategoriCapaian": "baik"},
    {"kktp": "Menghitung keliling bangun datar", "persentaseTuntas": 58, "kategoriCapaian": "perlu_perhatian"}
  ],
  "temuanUtama": [
    "Sebagian besar siswa sudah mampu mengidentifikasi jenis bangun datar dengan baik.",
    "Kemampuan menghitung keliling masih perlu ditingkatkan."
  ],
  "siswaPerluPerhatian": {
    "catatan": "8 siswa memerlukan remedial pada topik keliling lingkaran.",
    "jumlahSiswaTerdampak": 8
  },
  "rekomendasiTindakLanjut": [
    "Lakukan remedial terbimbing untuk 8 siswa.",
    "Sediakan latihan soal bertingkat."
  ],
  "isEstimasiKualitatif": false
}

CATATAN: AI TIDAK SELALU PATUH BATASAN KARAKTER. LAKUKAN TRUNCATE DI LAYER VALIDASI.

Keluarkan HANYA JSON valid sesuai schema, tanpa teks pembuka/penutup/markdown fence.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate input
    const parseResult = laporanEvaluasiLkpdInputSchema.safeParse(body);
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

    // RBAC Check: Get user's institution role
    let userRoles: string[] = [];
    let institutionId: number | null = null;

    if (input.school_id) {
      institutionId = parseInt(input.school_id, 10);
      if (!isNaN(institutionId)) {
        const userIdNum = parseInt(userId, 10);
        userRoles = await getUserInstitutionRole(userIdNum, institutionId) || [];
      }
    }

    // Check if user can view all teachers (principal/vice principal/operator/admin)
    const canAccess = canViewAllTeachers(
      parseInt(userId, 10),
      institutionId || 0
    );

    // If not in institution context OR not authorized
    if (!institutionId || !canAccess) {
      // Allow individual users to generate (for personal tracking)
      // But document will be marked with akses_terbatas: false for individual context
      console.log("[Laporan Evaluasi LKPD] User not in institution context, allowing individual access");
    }

    // Fetch LKPD data for context
    let lkpdData: any = null;
    let kktpList: string[] = [];

    try {
      // Try to fetch from guru_administrasi table
      const lkpdResult = await query(`
        SELECT konten, judul_dokumen, school_id, jenjang, fase
        FROM guru_administrasi
        WHERE id = $1 AND tipe_dokumen = 'lkpd'
      `, [input.lkpdRef]);

      if (lkpdResult.rows.length > 0) {
        lkpdData = lkpdResult.rows[0];
        const konten = typeof lkpdData.konten === 'string'
          ? JSON.parse(lkpdData.konten)
          : lkpdData.konten;

        // Extract KKTP from LKPD activities if available
        if (konten.aktivitas && Array.isArray(konten.aktivitas)) {
          kktpList = konten.aktivitas.map((act: any) =>
            `Aktivitas ${act.nomor}: ${act.instruksi.substring(0, 100)}`
          );
        }
      }
    } catch (dbErr) {
      console.error("Failed to fetch LKPD data:", dbErr);
    }

    // Get user profile for guruPengampu
    let guruPengampu = null;
    try {
      const userResult = await query(`
        SELECT name, full_name FROM users WHERE id = $1
      `, [userId]);
      if (userResult.rows.length > 0) {
        guruPengampu = userResult.rows[0].full_name || userResult.rows[0].name || null;
      }
    } catch (dbErr) {
      console.error("Failed to fetch user profile:", dbErr);
    }

    // Build data context for AI
    let dataContext = "";
    let isEstimasiKualitatif = false;

    switch (input.dataHasil) {
      case 'upload_excel':
        if (input.excelUrl) {
          dataContext = `
DATA HASIL (dari upload Excel):
- File: ${input.excelUrl}
- Format: Data numerik per siswa per KKTP
- Silakan proses data dan hitung persentase tuntas per KKTP
`;
        }
        break;

      case 'input_manual':
        if (input.dataSiswa && input.dataSiswa.length > 0) {
          const dataSiswaSummary = input.dataSiswa
            .slice(0, 10) // Include first 10 for context
            .map((s: any) => {
              if (s.skorPerKKTP) {
                const scores = Object.values(s.skorPerKKTP) as number[];
                const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
                return `${s.namaSiswa}: skor rata-rata ${avgScore.toFixed(1)}`;
              }
              if (s.statusPerKKTP) {
                const statuses = Object.values(s.statusPerKKTP) as boolean[];
                const tuntas = statuses.filter(Boolean).length;
                const total = statuses.length;
                return `${s.namaSiswa}: ${tuntas}/${total} KKTP tuntas`;
              }
              return s.namaSiswa;
            })
            .join('\n');

          dataContext = `
DATA HASIL (input manual):
- Jumlah siswa: ${input.jumlahSiswa}
- Sample data (10 pertama):
${dataSiswaSummary}
- (Total ${input.dataSiswa.length} siswa)
`;
        }
        break;

      case 'ringkasan_kualitatif':
        isEstimasiKualitatif = true;
        dataContext = `
DATA HASIL (ringkasan kualitatif):
- Teacher observation: ${input.ringkasanKualitatif || 'Tidak ada ringkasan'}
- Catatan guru: ${input.catatanGuru || 'Tidak ada'}
- NOTE: Karena data kualitatif, persentase adalah estimasi, bukan hitungan pasti
`;
        break;
    }

    // Prepare prompt
    const prompt = `
BUAT LAPORAN EVALUASI LKPD UNTUK KEPALA SEKOLAH/WAKASEK

## IDENTITAS
- Mata Pelajaran: ${lkpdData?.mapel || input.school_name || 'Umum'}
- Kelas: ${lkpdData?.kelas || 'Tidak ditentukan'}
- Periode Evaluasi: ${input.periodeEvaluasi}
- Jumlah Siswa: ${input.jumlahSiswa}
- Guru Pengampu: ${guruPengampu || 'Tidak diketahui'}
- LKPD yang dievaluasi: ${lkpdData?.judul_dokumen || `ID: ${input.lkpdRef}`}

## KKTP YANG DINILAI (dari LKPD)
${kktpList.length > 0 ? kktpList.map((k: string, i: number) => `${i + 1}. ${k}`).join('\n') : '- KKTP tidak tersedia, gunakan aktivitas sebagai dasar penilaian'}

## DATA HASIL EVALUASI
${dataContext}

## INSTRUKSI KHUSUS
1. ringkasanEksekutif: WAJIB bisa dibaca dalam 30 detik oleh Kepsek yang sibuk
2. capaianPerKKTP: Hitung persentase tuntas berdasarkan data yang diberikan
   - sangat_baik: >= 85% tuntas
   - baik: >= 70% tuntas
   - cukup: >= 50% tuntas
   - perlu_perhatian: < 50% tuntas
3. siswaPerluPerhatian: HANYA agregat ("3 siswa"), JANGAN tampilkan nama individual
4. rekomendasiTindakLanjut: WAJIB actionable dan spesifik untuk kelas ini
5. Jika data kualitatif (ringkasan_kualitatif), berikan estimasi dan set isEstimasiKualitatif: true

Keluarkan HANYA JSON valid tanpa markdown fence atau teks pembuka.
`;

    let parsed: z.infer<typeof laporanEvaluasiLkpdOutputSchema>;
    let aiResult: Awaited<ReturnType<typeof generateAIContentWithUsage>> | null = null;
    try {
      aiResult = await generateAIContentWithUsage(prompt, systemPromptCache, true);
      console.log("[Generate Laporan Evaluasi LKPD] Raw AI response length:", aiResult?.text?.length);

      const text = aiResult.text;
      if (!text || text.trim() === "") {
        throw new Error("AI mengembalikan respons kosong");
      }

      const cleanText = text.replace(/```json|```/g, "").trim();
      parsed = laporanEvaluasiLkpdOutputSchema.parse(JSON.parse(cleanText));

      console.log("[Generate Laporan Evaluasi LKPD] Successfully generated report with",
        parsed.capaianPerKKTP.length, "KKTP evaluated");
    } catch (aiError: unknown) {
      console.error("Laporan Evaluasi LKPD AI generation failed:", aiError);
      const aiMsg = aiError instanceof Error ? aiError.message : String(aiError ?? "Unknown error");

      // Log failed usage
      await logFailedPoinUsage(userId, 0, "generate-laporan-evaluasi-lkpd", aiMsg);

      return NextResponse.json(
        { error: `Gagal memproses AI: ${aiMsg}` },
        { status: 502 }
      );
    }

    // Compile & Upload files
    let pdfUrl: string | null = null;
    let docxUrl: string | null = null;

    try {
      const docTitle = `Laporan Evaluasi LKPD - ${parsed.identitas.mataPelajaran} (${parsed.identitas.periodeEvaluasi})`;

      const pdfBuf = await generateLaporanEvaluasiPdfBuffer(parsed, docTitle);
      pdfUrl = await uploadToR2(pdfBuf, `${Date.now()}-laporan-evaluasi-lkpd.pdf`, "application/pdf");

      const docBuf = generateLaporanEvaluasiDocBuffer(parsed, docTitle);
      docxUrl = await uploadToR2(docBuf, `${Date.now()}-laporan-evaluasi-lkpd.doc`, "application/msword");
    } catch (uploadErr) {
      console.error("Failed to compile or upload files:", uploadErr);
    }

    // Save to database
    const judulDokumen = `Laporan Evaluasi LKPD - ${parsed.identitas.mataPelajaran} (${parsed.identitas.periodeEvaluasi})`;

    try {
      await query(`
        INSERT INTO guru_administrasi (
          user_id, tipe_dokumen, judul_dokumen, konten,
          school_id, jenjang, kurikulum, fase
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        userId,
        'laporan_evaluasi_lkpd',
        judulDokumen,
        JSON.stringify({
          identitas: parsed.identitas,
          ringkasanEksekutif: parsed.ringkasanEksekutif,
          capaianPerKKTP: parsed.capaianPerKKTP,
          temuanUtama: parsed.temuanUtama,
          siswaPerluPerhatian: parsed.siswaPerluPerhatian,
          rekomendasiTindakLanjut: parsed.rekomendasiTindakLanjut,
          isEstimasiKualitatif: parsed.isEstimasiKualitatif || isEstimasiKualitatif,
          generated_with_ai: true,
          pdf_url: pdfUrl,
          docx_url: docxUrl,
          lkpdRef: input.lkpdRef,
          dataHasil: input.dataHasil,
        }),
        input.school_id || null,
        lkpdData?.jenjang || null,
        lkpdData?.kurikulum || null,
        lkpdData?.fase || null,
      ]);
    } catch (dbErr) {
      console.error("Failed to save Laporan Evaluasi LKPD:", dbErr);
    }

    // Deduct Poin only if AI was used and succeeded
    if (user.role !== "admin" && aiResult?.usage) {
      try {
        await deductPoinFromAIResult({ success: true, usage: aiResult.usage }, userId, "generate-laporan-evaluasi-lkpd", {});
        console.log(`[Generate Laporan Evaluasi LKPD] Poin deducted`);
      } catch (poinError: unknown) {
        console.error("[Generate Laporan Evaluasi LKPD] Poin deduction failed:", poinError);
      }
    }

    return NextResponse.json({
      ...parsed,
      pdf_url: pdfUrl,
      docx_url: docxUrl,
      lkpdRef: input.lkpdRef,
      akses_terbatas: canAccess, // True if principal/vp can view
    });
  } catch (error: unknown) {
    console.error("Laporan Evaluasi LKPD Generation Error:", error);
    const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
