import { generateAIContent } from "@/lib/ai";
import { query } from "@/lib/db";
import { consumeUserToken, getUserTokenAccess } from "@/lib/token-system";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// ==========================================
// PROTA GENERATOR - Program Tahunan
// Menghasilkan tabel Prota untuk seluruh semester
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
      jenjang,
      kurikulum,
      semester = 'ganjil',
      // Teaching context
      subjects = [], // array of { id, nama_mapel } or just string names
      mapel,
      kelas,
      topics = [], // array of topic names
    } = body;

    if (!mapel && (!subjects || subjects.length === 0)) {
      return NextResponse.json({ error: "Mapel atau daftar mata pelajaran wajib diisi" }, { status: 400 });
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

    // Prepare subject list
    const subjectList = subjects.length > 0
      ? subjects.map((s: any) => typeof s === 'string' ? s : s.nama_mapel).join(', ')
      : mapel;

    // Prepare topic list for each semester
    const topicList = Array.isArray(topics) && topics.length > 0
      ? topics.join(', ')
      : 'Seluruh topik Capaian Pembelajaran yang relevan';

    const schoolContext = school_name ? `
IDENTITAS SEKOLAH:
- Sekolah: ${school_name}${school_npsn ? ` (NPSN: ${school_npsn})` : ''}
- Tahun Ajaran: ${tahun_ajaran || '...'}
- Kurikulum: ${kurikulumLabel}
- Jenjang: ${jenjang || 'SD/MI'}
` : '';

    const prompt = `
Anda adalah ahli kurikulum Indonesia. Susun dokumen PROGRAM TAHUNAN (PROTA) yang lengkap dan profesional.

${schoolContext}

SPESIFIKASI:
- Mata Pelajaran: ${subjectList}
- Jenjang: ${jenjang || 'SD/MI'}
- Kelas: ${kelas || 'Semua kelas'}
- Kurikulum: ${kurikulumLabel}
- Tahun Ajaran: ${tahun_ajaran || '2025/2026'}
${topicList !== 'Seluruh topik Capaian Pembelajaran yang relevan' ? `- Topik: ${topicList}` : ''}

FORMAT PROTA (tabel Markdown):

## PROGRAM TAHUNAN (PROTA)
### ${school_name || 'Sekolah'} | Tahun Ajaran ${tahun_ajaran || '...'} | ${kurikulumLabel}

| No | Semester | Materi / Bab | Alokasi JP | Bulan | Keterangan |
|---|---|---|---|---|---|
| 1 | Ganjil | Alokasi JP untuk semester ganjil | ... JP | Juli - Desember | |
| 2 | Genap | Alokasi JP untuk semester genap | ... JP | Januari - Juni | |

### Detail per Semester:

#### SEMESTER GANJIL
| No | Materi/Bab | Alokasi JP | Bulan Pelaksanaan | CP/TP Referensi |
|---|---|---|---|---|
| 1 | ... | ... JP | ... | ... |

#### SEMESTER GENAP
| No | Materi/Bab | Alokasi JP | Bulan Pelaksanaan | CP/TP Referensi |
|---|---|---|---|---|
| 1 | ... | ... JP | ... | ... |

CATATAN PENTING:
- JP = Jam Pelajaran (setiap JP = 35-45 menit)
- Alokasi JP berdasarkan Capaian Pembelajaran (CP) Kurikulum yang berlaku
- Distribusi materi merata sepanjang semester dengan mempertimbangkan minggu efektif
- Waktu ujian/ASESMEN: STS (~minggu 8-9), SAS (~minggu 16-17)
- Include waktu untuk pembelajaran, penilaian, dan tindak lanjut

Hasilkan dokumen PROTA lengkap dalam format Markdown yang rapi dan profesional.
Balas HANYA dalam format JSON:
{
  "judul": "Program Tahunan (Prota) - ${subjectList} ${jenjang || ''} ${tahun_ajaran || ''}",
  "konten": "(Dokumen Markdown lengkap Prota)"
}
`;

    let parsed: any;
    try {
      const text = await generateAIContent(prompt);
      const cleanText = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (aiError: any) {
      console.error("Prota AI generation failed:", aiError);
      return NextResponse.json({ error: `Gagal generate Prota: ${aiError.message}` }, { status: 502 });
    }

    // Save to guru_administrasi
    try {
      await query(`
        INSERT INTO guru_administrasi (
          user_id, tipe_dokumen, judul_dokumen, konten,
          school_id, jenjang, kurikulum, semester
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        userId,
        'prota',
        parsed.judul || `Program Tahunan - ${subjectList}`,
        JSON.stringify({ konten: parsed.konten }),
        school_id || null,
        jenjang || null,
        kurikulum || null,
        semester || null,
      ]);
    } catch (dbErr) {
      console.error("Failed to save prota:", dbErr);
    }

    // Deduct token
    if (user.role !== "admin") {
      await consumeUserToken(userId, 1);
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Prota Generation Error:", error);
    return NextResponse.json({ error: error.message || "Gagal generate Prota" }, { status: 500 });
  }
}
