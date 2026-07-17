import { generateAIContent } from "@/lib/ai";
import { query } from "@/lib/db";
import { getUserPoinAccess, consumeUserPoin, logFailedPoinUsage } from "@/src/services/poin-service";
import { calculatePoinFromTokens } from "@/src/lib/ai-usage";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonrepair as repair } from "jsonrepair";
import { uploadToR2 } from "@/lib/r2";
import { generatePdfBuffer, generateDocBuffer } from "@/lib/doc-compiler";

// ==========================================
// PROSEM GENERATOR - Program Semester
// Menghasilkan tabel Prosem mingguan per semester
// ==========================================

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      // School context
      school_id,
      school_name,
      school_npsn,
      // Academic context
      tahun_ajaran_id,
      tahun_ajaran,
      semester = 'ganjil',
      jenjang,
      kurikulum,
      // Teaching context
      subject_id,
      mapel,
      kelas,
      minggu_efektif = 18,
      topics = [],
      dimensi8 = [],
    } = body;

    if (!mapel) {
      return NextResponse.json({ error: "Mata pelajaran wajib diisi" }, { status: 400 });
    }

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

    const kurikulumLabel = kurikulum === "merdeka" ? "Kurikulum Merdeka"
      : kurikulum === "k13" ? "Kurikulum 2013"
      : kurikulum === "kbc" ? "Kurikulum Berbasis Cinta (KBC)"
      : kurikulum === "hybrid" ? "Kurikulum Hybrid" : "Kurikulum Merdeka";

    const semesterLabel = semester === 'ganjil' ? 'Ganjil' : 'Genap';
    const bulanSemester = semester === 'ganjil'
      ? ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
      : ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];

    const dimensi8Labels: Record<string, string> = {
      imtaq: 'Beriman & Bertakwa',
      berkebinekaan_global: 'Berkebinekaan Global',
      bergotong_royong: 'Gotong Royong',
      merdeka: 'Merdeka',
      kreatif: 'Kreatif',
      bernalar_kritis: 'Bernalar Kritis',
      budi_pekerti_luhur: 'Budi Pekerti Luhur',
      kreativitas: 'Kreativitas',
    };

    const dimensi8Context = dimensi8 && dimensi8.length > 0
      ? `DIMENSI PROFIL LULUSAN YANG DITARGET:
${dimensi8.map((k: string) => `- ${dimensi8Labels[k] || k}`).join('\n')}`
      : '';

    const schoolContext = school_name ? `
IDENTITAS:
- Sekolah: ${school_name}${school_npsn ? ` (NPSN: ${school_npsn})` : ''}
- Tahun Ajaran: ${tahun_ajaran || '2025/2026'}
- Semester: ${semesterLabel}
- Kurikulum: ${kurikulumLabel}
` : '';

    const topicList = Array.isArray(topics) && topics.length > 0
      ? topics.join(', ')
      : `Seluruh topik Capaian Pembelajaran ${kurikulumLabel} untuk ${mapel}`;

    const prompt = `
Anda adalah ahli kurikulum Indonesia. Susun dokumen PROGRAM SEMESTER (PROSEM) yang detail, realistis, dan siap pakai.

${schoolContext}

SPESIFIKASI:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas || '...'}
- Semester: ${semesterLabel}
- Tahun Ajaran: ${tahun_ajaran || '2025/2026'}
- Kurikulum: ${kurikulumLabel}
- Jenjang: ${jenjang || 'SD/MI'}
- Minggu Efektif: ${minggu_efektif} minggu
- Topik: ${topicList}

${dimensi8Context}

FORMAT PROSEM (tabel Markdown):

## PROGRAM SEMESTER (PROSEM)
### ${school_name || 'Sekolah'} | ${mapel} | ${kelas || ''} | Semester ${semesterLabel} | ${tahun_ajaran || ''}

| Minggu | Bulan | Materi / Topik | JP | Kompetensi | Keterangan |
|---|---|---|---|---|---|
${bulanSemester.map((bulan, idx) => {
  const mingguStart = semester === 'ganjil' ? idx * 3 + 1 : idx * 3 + 1;
  return `| ${mingguStart} | ${bulan} | ... | ... JP | ... | ... |`;
}).join('\n')}

### Detail Mingguan:

| Minggu | Materi Pokok | Sub Materi | JP | Aktivitas | Asesmen | Keterangan |
|---|---|---|---|---|---|---|
| 1 | ... | ... | ... | ... | ... | Awal semester |
${Array.from({ length: Math.min(minggu_efektif, 18) }, (_, i) =>
  `| ${i + 1} | ${(i === Math.floor(minggu_efektif / 2) - 1) ? '📝 STS / PTS' : (i === minggu_efektif - 1) ? '📝 SAS / PAS' : '...'} | ... | ... JP | ... | ... | ... |`
).join('\n')}

ALOKASI WAKTU PER BLOK:
- Bulan 1-2: Pendahuluan & Materi Awal (~${Math.ceil(minggu_efektif * 0.1)} minggu)
- Bulan 3-4: ${semester === 'ganjil' ? 'Penilaian Tengah Semester (PTS/STS)' : 'Materi Indepth'} (~${Math.ceil(minggu_efektif * 0.35)} minggu)
- Bulan 5-6: Materi Lanjutan (~${Math.ceil(minggu_efektif * 0.4)} minggu)
- Minggu Terakhir: ${semester === 'ganjil' ? 'UAS/PAT' : 'Remedial & Pengayaan'}

CATATAN:
- JP = Jam Pelajaran
- Sesuaikan dengan kalender pendidikan yang berlaku di daerah
- Alokasi JP per topik berdasarkan bobot CP/TP
- ${dimensi8Context ? 'Integrasikan dimensi Profil Pelajar Pancasila dalam setiap kegiatan' : ''}

Hasilkan seluruh dokumen PROSEM tersebut langsung dalam format Markdown dengan tabel mingguan yang rapi. Jangan membungkus dokumen ini di dalam format JSON. Balas HANYA dengan teks Markdown lengkap tersebut.
`;

    let parsed: any;
    try {
      const text = await generateAIContent(prompt, undefined, false);
      const cleanMarkdown = text.trim();
      const docTitle = `Program Semester (Prosem) - ${mapel} ${kelas || ''} ${semesterLabel} ${tahun_ajaran || ''}`;

      parsed = {
        judul: docTitle,
        konten: cleanMarkdown,
      };

      // Compile & Upload Prosem files
      let pdfUrl: string | null = null;
      let docxUrl: string | null = null;
      try {
        const cleanMarkdown = (parsed.konten || "").trim();
        const docTitle = parsed.judul || `Program Semester - ${mapel} Kelas ${kelas || ""}`;

        const pdfBuf = await generatePdfBuffer(cleanMarkdown, docTitle);
        pdfUrl = await uploadToR2(pdfBuf, `${Date.now()}-prosem.pdf`, "application/pdf");

        const docBuf = generateDocBuffer(cleanMarkdown, docTitle);
        docxUrl = await uploadToR2(docBuf, `${Date.now()}-prosem.doc`, "application/msword");
      } catch (uploadErr) {
        console.error("Failed to compile or upload Prosem files to R2:", uploadErr);
      }

      parsed.pdf_url = pdfUrl;
      parsed.docx_url = docxUrl;

    } catch (aiError: any) {
      console.error("Prosem AI generation failed:", aiError);
      return NextResponse.json({ error: `Gagal generate Prosem: ${aiError.message}` }, { status: 502 });
    }

    // Save
    try {
      await query(`
        INSERT INTO guru_administrasi (
          user_id, tipe_dokumen, judul_dokumen, konten,
          school_id, subject_id, jenjang, kurikulum, semester, dimensi8
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        userId,
        'prosem',
        parsed.judul || `Program Semester - ${mapel} ${semesterLabel}`,
        JSON.stringify({ 
          markdown: parsed.konten, 
          pptx_url: null,
          pdf_url: parsed.pdf_url || null,
          docx_url: parsed.docx_url || null
        }),
        school_id || null,
        subject_id || null,
        jenjang || null,
        kurikulum || null,
        semester,
        dimensi8 || [],
      ]);
    } catch (dbErr) {
      console.error("Failed to save prosem:", dbErr);
    }

    // Deduct Poin based on actual usage
    if (user.role !== "admin") {
      try {
        const poinCalc = calculatePoinFromTokens(
          aiResult?.rawUsage?.promptTokenCount || 0,
          aiResult?.rawUsage?.candidatesTokenCount || 0,
          aiResult?.rawUsage?.cachedContentTokenCount || 0
        );

        await consumeUserPoin(userId, poinCalc.rawTokens, "generate-prosem", {
          model: "gemini-2.5-flash-lite",
          provider: "gemini",
        });

        console.log(`[Generate Prosem] Poin deducted: ${poinCalc.poinNeeded} (${poinCalc.rawTokens} raw tokens)`);
      } catch (poinError) {
        console.error("[Generate Prosem] Poin deduction failed:", poinError);
      }
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Prosem Generation Error:", error);
    return NextResponse.json({ error: error.message || "Gagal generate Prosem" }, { status: 500 });
  }
}
