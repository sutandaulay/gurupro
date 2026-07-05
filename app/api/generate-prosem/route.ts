import { generateAIContent } from "@/lib/ai";
import { query } from "@/lib/db";
import { consumeUserToken, getUserTokenAccess } from "@/lib/token-system";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

Hasilkan dokumen PROSEM lengkap dalam format Markdown.
Balas HANYA dalam format JSON:
{
  "judul": "Program Semester (Prosem) - ${mapel} ${kelas || ''} ${semesterLabel} ${tahun_ajaran || ''}",
  "konten": "(Dokumen Markdown lengkap Prosem)"
}
`;

    let parsed: any;
    try {
      const text = await generateAIContent(prompt);
      const cleanText = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleanText);
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
        JSON.stringify({ konten: parsed.konten }),
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

    // Deduct token
    if (user.role !== "admin") {
      await consumeUserToken(userId, 1);
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Prosem Generation Error:", error);
    return NextResponse.json({ error: error.message || "Gagal generate Prosem" }, { status: 500 });
  }
}
