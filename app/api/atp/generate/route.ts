import { generateAIContent } from "@/lib/ai";
import { query } from "@/lib/db";
import { consumeUserToken, getUserTokenAccess } from "@/lib/token-system";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// ==========================================
// ATP GENERATE API
// Generate Alur Tujuan Pembelajaran dengan AI
// ==========================================

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      judul_dokumen,
      school_id,
      school_name,
      school_npsn,
      subject_id,
      mapel,
      jenjang = 'SMA',
      kurikulum = 'merdeka',
      fase = 'E',
      semester = 'ganjil',
      tahun_ajaran,
      dimensi8 = [],
      tiga_pengalaman = false,
      pai_mode = null,
    } = body;

    let resolvedMapel = typeof mapel === 'string' ? mapel.trim() : '';

    if (!resolvedMapel && subject_id) {
      try {
        const subjectRes = await query("SELECT nama_mapel FROM subjects WHERE id = $1", [subject_id]);
        if (subjectRes.rows[0]?.nama_mapel) {
          resolvedMapel = subjectRes.rows[0].nama_mapel;
        }
      } catch (subjectErr) {
        console.error('Failed to resolve subject name by id:', subjectErr);
      }
    }

    if (!resolvedMapel && school_id) {
      try {
        const schoolSubjectRes = await query(
          "SELECT nama_mapel FROM subjects WHERE school_id = $1 ORDER BY nama_mapel ASC LIMIT 1",
          [school_id]
        );
        if (schoolSubjectRes.rows[0]?.nama_mapel) {
          resolvedMapel = schoolSubjectRes.rows[0].nama_mapel;
        }
      } catch (subjectErr) {
        console.error('Failed to resolve subject name by school:', subjectErr);
      }
    }

    if (!resolvedMapel) {
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
      : "Kurikulum Merdeka";

    const dimensi8Labels: Record<string, string> = {
      imtaq: 'Beriman, Bertakwa, Berakhlak Mulia',
      berkebinekaan_global: 'Berkebinekaan Global',
      bergotong_royong: 'Gotong Royong',
      merdeka: 'Merdeka',
      kreatif: 'Kreatif',
      bernalar_kritis: 'Bernalar Kritis',
      budi_pekerti_luhur: 'Mengakar pada Budi Pekerti Luhur',
      kreativitas: 'Kreativitas (Deep Learning)',
    };

    const dimensi8Context = dimensi8 && dimensi8.length > 0
      ? `PROFIL PELAJAR PANCASILA — 8 DIMENSI:
${dimensi8.map((k: string) => `- ${dimensi8Labels[k] || k}`).join('\n')}
Integrasikan dimensi ini dalam perencanaan pembelajaran.`
      : '';

    const paiContext = pai_mode && pai_mode !== 'none'
      ? `KETENTUAN GURU PAI (Kepka BKPDM No. 020/2026):
- Modus: ${pai_mode === 'hybrid_kbc' ? 'Hybrid KBC' : 'Integrasi Spiritual'}
- Integrasikan nilai Imtaq, Akhlakul Karimah, Hablumminallah, Habluminannas`
      : '';

    const schoolContext = school_name ? `
IDENTITAS:
- Sekolah: ${school_name}${school_npsn ? ` (NPSN: ${school_npsn})` : ''}
- Tahun Ajaran: ${tahun_ajaran || '...'}
- Kurikulum: ${kurikulumLabel}
- Fase: ${fase}
- Semester: ${semester === 'ganjil' ? 'Ganjil' : 'Genap'}`
      : '';

    const prompt = `
Anda adalah ahli kurikulum Indonesia. Susun dokumen ALUR TUJUAN PEMBELAJARAN (ATP) yang komprehensif dan terstruktur.

${schoolContext}
${dimensi8Context}
${paiContext}

SPESIFIKASI ATP:
- Mata Pelajaran: ${resolvedMapel}
- Jenjang: ${jenjang}
- Fase: ${fase} ${fase === 'E' ? '(SMA Kelas 10-11)' : fase === 'D' ? '(SMP Kelas 7-9)' : fase === 'C' ? '(SD Kelas 5-6)' : ''}
- Kurikulum: ${kurikulumLabel}
- Semester: ${semester === 'ganjil' ? 'Ganjil' : 'Genap'}
- Tahun Ajaran: ${tahun_ajaran || '2025/2026'}
${tiga_pengalaman ? '- Menggunakan pendekatan Deep Learning (3 Pengalaman Belajar)' : ''}

STRUKTUR ATP (tabel utama):

## ALUR TUJUAN PEMBELAJARAN (ATP)
### ${school_name || 'Sekolah'} | ${resolvedMapel} | ${jenjang} Fase ${fase} | Semester ${semester === 'ganjil' ? 'Ganjil' : 'Genap'}

### A. CAPAIAN PEMBELAJARAN (CP)
| No | Fase | Capaian Pembelajaran |
|---|---|---|
| 1 | ${fase} | [Tulis CP relevan untuk ${resolvedMapel}] |

### B. TUJUAN PEMBELAJARAN (TP)
| No | CP | Tujuan Pembelajaran |
|---|---|---|
| 1 | CP-1 | [Tulis TP spesifik dan terukur] |

### C. ALUR TP (Per Semester)

#### Semester ${semester === 'ganjil' ? 'GANJIL' : 'GENAP'}
| Minggu | Materi Pokok | Sub Materi | TP | JP | Aktivitas | Asesmen | Keterangan |
|---|---|---|---|---|---|---|---|
| 1 | [Materi 1] | [Sub 1.1, 1.2] | TP-1, TP-2 | ... | [Deskripsi aktivitas] | [Jenis asesmen] | Pendahuluan |
| 2 | [Materi 1] | [Sub 1.3] | TP-2 | ... | ... | ... | Lanjutan |
| 3 | [Materi 2] | [Sub 2.1, 2.2] | TP-3 | ... | ... | ... | |
...dst sampai minggu 16-18

#### Semester ${semester === 'ganjil' ? 'GANJIL' : 'GENAP'}
(sama struktur tabelnya)

### D. PROFIL PELAJAR PANCASILA
${dimensi8 && dimensi8.length > 0 ? dimensi8.map((k: string, i: number) => `${i + 1}. ${dimensi8Labels[k] || k}`).join('\n') : 'Integrasikan Profil Pelajar Pancasila secara tematik'}

CATATAN PENTING:
- JP = Jam Pelajaran (@35-45 menit)
- Alokasi JP per materi berdasarkan kompleksitas dan kedalaman
- Minggu efektif: ${semester === 'ganjil' ? 'Juli-Desember (~18 minggu)' : 'Januari-Juni (~17 minggu)'}
- Week 8-9: Penilaian Tengah Semester (PTS/STS)
- Week 16-17: Penilaian Akhir Semester (PAS/SAS)
${dimensi8 && dimensi8.length > 0 ? '- Setiap materi mengintegrasikan 8 Dimensi Profil Pelajar Pancasila' : ''}
${tiga_pengalaman ? '- Gunakan pendekatan 3 Pengalaman Belajar (Memahami, Mengaplikasi, Merefleksikan)' : ''}
${pai_mode ? '- Integrasikan nilai spiritual PAI dalam setiap pembelajaran' : ''}

Hasilkan dokumen ATP LENGKAP dalam format Markdown yang rapi.
Balas HANYA dalam format JSON:
{
  "judul": "ATP - ${resolvedMapel} ${jenjang} Fase ${fase} ${semester === 'ganjil' ? 'Ganjil' : 'Genap'} ${tahun_ajaran || ''}",
  "konten": "(Dokumen Markdown lengkap ATP)"
}
`;

    let parsed: any;
    try {
      const text = await generateAIContent(prompt);
      const cleanText = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (aiError: any) {
      console.error("ATP AI generation failed:", aiError);
      return NextResponse.json({ error: `Gagal generate ATP: ${aiError.message}` }, { status: 502 });
    }

    // Save ATP
    try {
      await query(`
        INSERT INTO guru_administrasi (
          user_id, tipe_dokumen, judul_dokumen, konten,
          school_id, subject_id, jenjang, kurikulum, fase, semester,
          dimensi8, tiga_pengalaman, pai_mode
        ) VALUES ($1, 'atp', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        userId,
        parsed.judul || judul_dokumen || `ATP - ${resolvedMapel}`,
        JSON.stringify({ konten: parsed.konten, generated_with_ai: true }),
        school_id || null,
        subject_id || null,
        jenjang,
        kurikulum,
        fase || null,
        semester,
        dimensi8 || [],
        tiga_pengalaman || false,
        pai_mode || null,
      ]);
    } catch (dbErr) {
      console.error("Failed to save ATP:", dbErr);
    }

    // Deduct token
    if (user.role !== "admin") {
      await consumeUserToken(userId, 1);
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("ATP Generate Error:", error);
    return NextResponse.json({ error: error.message || "Gagal generate ATP" }, { status: 500 });
  }
}
