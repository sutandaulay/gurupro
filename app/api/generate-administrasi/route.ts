import { generateAIContent } from "@/lib/ai";
import { query } from "@/lib/db";
import { consumeUserToken, getUserTokenAccess } from "@/lib/token-system";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      tipe,
      mapel,
      kelas,
      kurikulum,
      topik,
      tujuan,
      // === NEW: School Context ===
      school_id,
      school_name,
      school_npsn,
      school_address,
      // === NEW: Deep Learning Context (Kerangka 8334) ===
      dimensi8 = [],
      tiga_pengalaman = false,
      pengalaman_keys = [],
      pai_mode = null, // 'none' | 'spiritual_only' | 'hybrid_kbc'
      jenjang = 'SD',
      fase = null,
      semester = null,
      tahun_ajaran = null,
    } = body;

    if (!tipe || !mapel || !kelas || !topik) {
      return NextResponse.json({ error: "Parameter tipe, mapel, kelas, dan topik wajib diisi" }, { status: 400 });
    }

    // 1. SaaS Token Validation
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

    // === Build Context ===
    const kurikulumLabel = kurikulum === "merdeka" ? "Kurikulum Merdeka"
      : kurikulum === "k13" ? "Kurikulum 2013 (K13)"
      : kurikulum === "kbc" ? "Kurikulum Berbasis Cinta (KBC)"
      : kurikulum === "hybrid" ? "Kurikulum Hybrid (Gabungan)"
      : "Kurikulum Merdeka";

    // School Identity Context
    const schoolContext = school_name ? `
IDENTITAS SEKOLAH:
- Nama Sekolah: ${school_name}
${school_npsn ? `- NPSN: ${school_npsn}` : ''}
${school_address ? `- Alamat: ${school_address}` : ''}
- Nama Guru: ${user.nama_lengkap || 'Guru'}
${tahun_ajaran ? `- Tahun Ajaran: ${tahun_ajaran}${semester ? `, Semester ${semester}` : ''}` : ''}
${jenjang ? `- Jenjang: ${jenjang}${fase ? ` (Fase ${fase})` : ''}` : ''}
` : '';

    // 8 Dimensi Profil Lulusan Context
    const dimensi8Labels: Record<string, string> = {
      imtaq: '1. Beriman, Bertakwa, Berakhlak Mulia (Imtaq)',
      berkebinekaan_global: '2. Berkebinekaan Global',
      bergotong_royong: '3. Gotong Royong',
      merdeka: '4. Merdeka',
      kreatif: '5. Kreatif',
      bernalar_kritis: '6. Bernalar Kritis',
      budi_pekerti_luhur: '7. Mengakar pada Budi Pekerti Luhur',
      kreativitas: '8. Kreativitas (Deep Learning)',
    };
    const dimensi8Context = dimensi8 && dimensi8.length > 0
      ? `PROFIL PELAJAR PANCASILA — 8 DIMENSI (Kerangka 8334):
Pilih dan integrasikan dimensi berikut dalam pembelajaran:
${dimensi8.map((k: string) => `- ${dimensi8Labels[k] || k}`).join('\n')}
Catatan: Integrasikan nilai-nilai ini secara NARATIF dalam setiap komponen pembelajaran.`
      : kurikulum === 'merdeka'
      ? `PROFIL PELAJAR PANCASILA:
Mengintegrasikan Profil Pelajar Pancasila sebagai tujuan akhir pembelajaran.`
      : '';

    // 3 Pengalaman Belajar Context
    const tigaPengalamanLabels: Record<string, string> = {
      memahami: 'Memahami (Understand - C2): Eksplorasi konsep, tanya jawab, demonstrasi',
      mengaplikasi: 'Mengaplikasi (Apply - C3): Simulasi, latihan, proyek mini, LKPD',
      merefleksikan: 'Merefleksikan (Reflect - C4+): Diskusi reflektif, presentasi, asesmen diri',
    };
    const tigaPengalamanContext = tiga_pengalaman
      ? `STRUKTUR 3 PENGALAMAN BELAJAR (DEEP LEARNING):
${(pengalaman_keys && pengalaman_keys.length > 0 ? pengalaman_keys : ['memahami', 'mengaplikasi', 'merefleksikan']).map((k: string) =>
        `- ${tigaPengalamanLabels[k] || k}`
      ).join('\n')}
PERATURAN WAJIB:
1. Setiap fase harus memiliki KEGIATAN SUBSTANTIF, bukan hanya ceremonial
2. Fase "Memahami" → minimal 2 aktivitas berbeda (eksplorasi, demonstrasi, tanya jawab)
3. Fase "Mengaplikasi" → harus ada produk/hasil kerja nyata
4. Fase "Merefleksikan" → harus ada asesmen diri dan transfer pengetahuan
5. Alokasi waktu proporsional: Memahami (30%), Mengaplikasi (45%), Merefleksikan (25%)`
      : '';

    // PAI Mode Context
    const paiModeContext = pai_mode && pai_mode !== 'none'
      ? `KETENTUAN KHUSUS GURU PAI (Kepka BKPDM No. 020/2026):
- Modus: ${pai_mode === 'hybrid_kbc' ? 'Hybrid Kurikulum Berbasis Cinta (KBC)' : 'Integrasi Nilai Spiritual'}
${pai_mode === 'hybrid_kbc' ? `- Modul Ajar mengintegrasikan pendekatan Kurikulum Berbasis Cinta (KBC)
- Referensi: Kepka BKPDM No. 020/2026 tentang Kurikulum Berbasis Cinta
- Integrasikan nilai spiritual (Imtaq, Akhlak, Hablumminallah, Habluminannas)` : ''}
${pai_mode === 'spiritual_only' ? `- Modul Ajar mengintegrasikan nilai-nilai spiritual ke dalam setiap kegiatan` : ''}
- Setiap fase pembelajaran harus mengandung unsur:
  • Hablumminallah (Hubungan dengan Allah SWT)
  • Habluminannas (Hubungan dengan sesama manusia)
  • Akhlakul Karimah (Karakter mulia)
  • Internalisasi nilai keimanan dan ketakwaan`
      : '';

    // Combine all context
    const deepLearningContext = [
      schoolContext,
      dimensi8Context,
      tigaPengalamanContext,
      paiModeContext,
    ].filter(Boolean).join('\n\n');

    // === BUILD PROMPTS ===
    let prompt = "";

    if (tipe === "rpp") {
      const faseInfo = fase ? `Fase ${fase}` : '';
      prompt = `
Anda adalah ahli kurikulum pendidikan Indonesia. Susunlah dokumen Rencana Pelaksanaan Pembelajaran (RPP) yang komprehensif dan siap pakai${tiga_pengalaman ? ' dengan struktur 3 Pengalaman Belajar (Deep Learning)' : ''}.

${deepLearningContext}

Spesifikasi RPP:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}${faseInfo ? ` (${faseInfo})` : ''}
- Kurikulum: ${kurikulumLabel}
- Materi Pokok / Topik: ${topik}
- Tujuan Pembelajaran: ${tujuan || "Disusun logis sesuai topik"}

${tiga_pengalaman ? `FORMAT RPP DENGAN 3 PENGALAMAN BELAJAR (WAJIB):
Fase 1: MEMAHAMKI (Memahami)
  • Aktivitas: eksplorasi konsep, tanya jawab, demonstrasi
  • Produk: catatan konsep, peta pikiran, hasil diskusi
  • Alokasi: ~30% dari JP

Fase 2: MENGAPLIKASI (Mengaplikasi)
  • Aktivitas: simulasi, latihan terbimbing, proyek mini, LKPD
  • Produk: hasil kerja nyata, penyelesaian masalah
  • Alokasi: ~45% dari JP

Fase 3: MEREFLEKSIKAN (Merefleksikan)
  • Aktivitas: diskusi reflektif, presentasi, asesmen diri
  • Produk: refleksi tertulis, portofolio, rencana tindak lanjut
  • Alokasi: ~25% dari JP` : `STRUKTUR RPP (format standar):
1. Identitas Pembelajaran
2. Tujuan Pembelajaran (berbasis ABCD)
3. Langkah-langkah Pembelajaran (Pendahuluan, Kegiatan Inti, Penutup)
4. Metode dan Model Pembelajaran
5. Media, Alat, dan Sumber Belajar
6. Asesmen/Penilaian (Sikap, Pengetahuan, Keterampilan)
7. Rencana Tindak Lanjut (Remedial & Pengayaan)`}

Hasilkan dokumen RPP dalam format Markdown yang rapi.
Balas HANYA dalam format JSON:
{
  "judul": "RPP - ${mapel} Kelas ${kelas} - ${topik}",
  "konten": "(Teks Markdown lengkap RPP)"
}
`;
    } else if (tipe === "modul") {
      const faseInfo = fase ? `Fase ${fase}` : '';
      prompt = `
Anda adalah ahli kurikulum pendidikan Indonesia. Susunlah dokumen Modul Ajar LENGKAP yang relevan untuk ${kurikulumLabel}${tiga_pengalaman ? ' dengan pendekatan Deep Learning (3 Pengalaman Belajar)' : ''}.

${deepLearningContext}

Spesifikasi Modul Ajar:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}${faseInfo ? ` (${faseInfo})` : ''}
- Kurikulum: ${kurikulumLabel}
- Topik / Materi Pokok: ${topik}
- Tujuan Pembelajaran: ${tujuan || "Disusun logis sesuai TP Capaian Pembelajaran"}

STRUKTUR MODUL AJAR LENGKAP (3 Komponen):

1. INFORMASI UMUM:
   - Identitas (Sekolah, Mata Pelajaran, Kelas, Fase, Semester)
   - Kompetensi Awal
   - ${dimensi8 && dimensi8.length > 0 ? 'Profil Pelajar Pancasila — 8 Dimensi (lihat konteks di atas)' : 'Profil Pelajar Pancasila'}
   - Sarana Prasarana
   - Target Peserta Didik
   - Model Pembelajaran

2. KOMPONEN INTI:
   - Tujuan Pembelajaran
   - Pemahaman Bermakna
   - Pertanyaan Pemantik
   ${tiga_pengalaman ? `   - KEGIATAN PEMBELAJARAN (3 Pengalaman Belajar):
     a) MEMAHAMKI: Eksplorasi, demonstrasi, tanya jawab
     b) MENGAPLIKASI: Simulasi, LKPD, proyek mini
     c) MEREFLEKSIKAN: Refleksi, presentasi, asesmen diri` : `   - Kegiatan Pembelajaran (Pendahuluan, Inti, Penutup)`}
   - Asesmen Formatif & Sumatif
   - Pengayaan & Remedial
   - Refleksi Peserta Didik & Guru

3. LAMPIRAN:
   - LKPD (Lembar Kerja Peserta Didik)
   - Bahan Bacaan Guru & Peserta Didik
   - Glosarium
   - Daftar Pustaka

Hasilkan dokumen Modul Ajar dalam format Markdown yang rapi dan elegan.
Balas HANYA dalam format JSON:
{
  "judul": "Modul Ajar - ${mapel} Kelas ${kelas} - ${topik}",
  "konten": "(Teks Markdown lengkap Modul Ajar)"
}
`;
    } else if (tipe === "silabus") {
      prompt = `
Anda adalah ahli kurikulum pendidikan Indonesia. Susunlah dokumen Silabus Pembelajaran Semester yang terperinci dan relevan.

${deepLearningContext}

Spesifikasi Silabus:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}
- Kurikulum: ${kurikulumLabel}
- Topik Utama: ${topik}
- Alokasi Waktu: 1 Semester${semester ? ` (Semester ${semester})` : ''}

STRUKTUR SILABUS (Tabel Markdown):
1. Capaian Pembelajaran / Kompetensi Dasar
2. Tujuan Pembelajaran
3. Indikator Pencapaian Kompetensi
4. Materi Pemelajaran
5. ${tiga_pengalaman ? 'KEGIATAN PEMBELAJARAN (3 Pengalaman Belajar)' : 'Kegiatan Pembelajaran'} (Pendekatan Saintifik/TPACK)
6. Alokasi Waktu (JP)
7. Asesmen Penilaian (Formatif & Sumatif)
8. Sumber Belajar${dimensi8 && dimensi8.length > 0 ? '\n9. Profil Pelajar Pancasila — Dimensi yang Ditarget' : ''}

Hasilkan dokumen Silabus dalam format Markdown dengan tabel yang rapi.
Balas HANYA dalam format JSON:
{
  "judul": "Silabus Semester - ${mapel} Kelas ${kelas} - ${topik}",
  "konten": "(Teks Markdown lengkap Silabus)"
}
`;
    } else if (tipe === "lkpd") {
      prompt = `
Anda adalah ahli kurikulum pendidikan Indonesia. Susunlah dokumen Lembar Kerja Peserta Didik (LKPD) yang menarik dan menantang${tiga_pengalaman ? ' dengan pendekatan 3 Pengalaman Belajar' : ''}.

${deepLearningContext}

Spesifikasi LKPD:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}
- Kurikulum: ${kurikulumLabel}
- Topik / Bab: ${topik}
- Tujuan Pembelajaran: ${tujuan || "Disusun logis sesuai topik"}

STRUKTUR LKPD:
1. Judul LKPD yang menarik dan relevan
2. Identitas (Nama, Kelas, Kelompok, Tanggal)
3. Petunjuk Pengisian
4. Indikator / Tujuan Pembelajaran
5. Ringkasan Materi Singkat (Stimulus)
${tiga_pengalaman ? `6. AKTIVITAS A — MEMAHAMKI: Eksplorasi konsep, analisis, tanya jawab
7. AKTIVITAS B — MENGAPLIKASI: Latihan, simulasi, proyek mini
8. AKTIVITAS C — MEREFLEKSIKAN: Refleksi, asesmen diri` : '6. Aktivitas / Tugas (Individu & Kelompok)'}
9. Lembar Penilaian / Asesmen Diri (Refleksi)

Hasilkan dokumen LKPD dalam format Markdown yang rapi dengan visual yang menarik.
Balas HANYA dalam format JSON:
{
  "judul": "LKPD - ${mapel} Kelas ${kelas} - ${topik}",
  "konten": "(Teks Markdown lengkap LKPD)"
}
`;
    } else if (tipe === "prota") {
      // Program Tahunan Generator
      prompt = `
Anda adalah ahli kurikulum pendidikan Indonesia. Susunlah dokumen PROGRAM TAHUNAN (PROTA) yang komprehensif.

${deepLearningContext}

Spesifikasi PROTA:
- Mata Pelajaran: ${mapel}
- Jenjang: ${jenjang}
- Kelas: ${kelas}
- Kurikulum: ${kurikulumLabel}
- Topik Utama: ${topik}
${tahun_ajaran ? `- Tahun Ajaran: ${tahun_ajaran}` : ''}

STRUKTUR PROTA (tabel):
| No | Semester | Materi/Bab | Alokasi JP | Keterangan |
|---|---|---|---|---|
| 1 | Ganjil | ... | ... | ... |

Catatan:
- Alokasi JP berdasarkan Capaian Pembelajaran
- Distribusi materi merata sepanjang semester
${dimensi8 && dimensi8.length > 0 ? '- Integrasikan 8 Dimensi Profil Pelajar Pancasila' : ''}

Hasilkan dokumen PROTA dalam format Markdown dengan tabel yang rapi.
Balas HANYA dalam format JSON:
{
  "judul": "Program Tahunan (Prota) - ${mapel} ${jenjang} ${tahun_ajaran || ''}",
  "konten": "(Teks Markdown lengkap Prota)"
}
`;
    } else if (tipe === "prosem") {
      // Program Semester Generator
      prompt = `
Anda adalah ahli kurikulum pendidikan Indonesia. Susunlah dokumen PROGRAM SEMESTER (PROSEM) yang detail dan terstruktur.

${deepLearningContext}

Spesifikasi PROSEM:
- Mata Pelajaran: ${mapel}
- Jenjang: ${jenjang}
- Kelas: ${kelas}
- Kurikulum: ${kurikulumLabel}
- Semester: ${semester || 'Ganjil'}
${tahun_ajaran ? `- Tahun Ajaran: ${tahun_ajaran}` : ''}
- Minggu Efektif: 16-18 minggu

STRUKTUR PROSEM (tabel per minggu):
| Minggu | Bulan | Materi/Bab | JP | Keterangan |
|---|---|---|---|---|
| 1 | Juli | ... | ... | ... |

Catatan:
- Distribusi materi berdasarkan Prota
- Include UTS/PTS di minggu tengah semester
- Include Ujian Akhir Semester
${dimensi8 && dimensi8.length > 0 ? '- Integrasikan 8 Dimensi Profil Pelajar Pancasila' : ''}
${tiga_pengalaman ? '- Gunakan pendekatan 3 Pengalaman Belajar dalam alokasi JP' : ''}

Hasilkan dokumen PROSEM dalam format Markdown dengan tabel mingguan.
Balas HANYA dalam format JSON:
{
  "judul": "Program Semester (Prosem) - ${mapel} ${jenjang} ${semester || 'Ganjil'} ${tahun_ajaran || ''}",
  "konten": "(Teks Markdown lengkap Prosem)"
}
`;
    } else {
      // laporan_lkpd
      prompt = `
Anda adalah ahli kurikulum dan supervisi pendidikan Indonesia. Susunlah Laporan Evaluasi Pelaksanaan LKPD formal untuk Kepala Sekolah.

${deepLearningContext}

Spesifikasi Laporan:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}
- Kurikulum: ${kurikulumLabel}
- Topik / Bab: ${topik}
${school_name ? `- Sekolah: ${school_name}` : ''}

STRUKTUR LAPORAN LKPD:
1. Judul Laporan Evaluasi Pelaksanaan LKPD
2. Informasi Umum (Nama Guru, Sekolah, Tanggal)
3. Pendahuluan (Latar Belakang & Tujuan)
4. Deskripsi Pelaksanaan KBM
5. Analisis Ketercapaian (KKM, Keaktifan, Respons)
6. Kendala & Solusi
7. Kesimpulan & Rekomendasi
8. Tanda Tangan (Guru & Kepala Sekolah)

Hasilkan dokumen formal dalam format Markdown yang rapi.
Balas HANYA dalam format JSON:
{
  "judul": "Laporan LKPD - ${mapel} Kelas ${kelas} - ${topik}",
  "konten": "(Teks Markdown lengkap Laporan)"
}
`;
    }

    // 2. Call AI service
    let parsed: any;
    try {
      const text = await generateAIContent(prompt);
      const cleanText = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (aiError: any) {
      console.error("Administrasi AI generation failed:", aiError);
      return NextResponse.json({ error: `Gagal memproses AI: ${aiError.message || aiError}` }, { status: 502 });
    }

    // 3. Save document with FK context (best effort - non-blocking)
    try {
      await query(`
        INSERT INTO guru_administrasi (
          user_id, tipe_dokumen, judul_dokumen, konten,
          school_id, jenjang, kurikulum, fase, semester,
          dimensi8, tiga_pengalaman, pai_mode
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        userId,
        tipe,
        parsed.judul,
        JSON.stringify({ konten: parsed.konten, generated_with_deep_learning: true }),
        school_id || null,
        jenjang || null,
        kurikulum || null,
        fase || null,
        semester || null,
        dimensi8 || [],
        tiga_pengalaman || false,
        pai_mode || null,
      ]);
    } catch (dbError) {
      // Non-blocking: document still returned even if save fails
      console.error("Failed to save admin document:", dbError);
    }

    // 4. Deduct token on success
    if (user.role !== "admin") {
      await consumeUserToken(userId, 1);
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("AI Admin Generation Error:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat dokumen AI" }, { status: 500 });
  }
}
