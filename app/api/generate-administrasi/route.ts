import { generateAIContent } from "@/lib/ai";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tipe, mapel, kelas, kurikulum, topik, tujuan } = body;

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
    const userRes = await query("SELECT token_limit, role, subscription_end FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }
    const user = userRes.rows[0];

    if (user.role !== "admin" && user.subscription_end) {
      const isExpired = new Date(user.subscription_end).getTime() - new Date().getTime() <= 0;
      if (isExpired) {
        if ((user.token_limit || 0) > 0) {
          await query("UPDATE users SET token_limit = 0 WHERE id = $1", [userId]);
        }
        return NextResponse.json({ 
          error: "Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu." 
        }, { status: 403 });
      }
    }

    if (user.role !== "admin" && (user.token_limit || 0) <= 0) {
      return NextResponse.json({ 
        error: "Kredit token GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan di Landing Page." 
      }, { status: 403 });
    }

    const kurikulumLabel = kurikulum === "merdeka" ? "Kurikulum Merdeka"
      : kurikulum === "k13" ? "Kurikulum 2013 (K13)"
      : kurikulum === "kbc" ? "Kurikulum Berbasis Cinta (KBC)"
      : kurikulum === "hybrid" ? "Kurikulum Hybrid (Gabungan)"
      : "Kurikulum Merdeka";

    let prompt = "";
    if (tipe === "rpp") {
      prompt = `
Anda adalah ahli kurikulum pendidikan Indonesia. Susunlah dokumen Rencana Pelaksanaan Pembelajaran (RPP) yang komprehensif, logis, dan siap pakai.
Spesifikasi RPP:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}
- Kurikulum: ${kurikulumLabel}
- Materi Pokok / Topik: ${topik}
- Tujuan Pembelajaran: ${tujuan || "Disusun logis sesuai topik"}

Struktur RPP wajib mengandung elemen berikut:
1. Identitas Pembelajaran
2. Tujuan Pembelajaran (berbasis ABCD)
3. Langkah-langkah Pembelajaran (Pendahuluan, Kegiatan Inti, Penutup) dengan alokasi waktu
4. Metode dan Model Pembelajaran
5. Media, Alat, dan Sumber Belajar
6. Asesmen/Penilaian (Sikap, Pengetahuan, Keterampilan)
7. Rencana Tindak Lanjut (Remedial & Pengayaan)

Hasilkan dokumen RPP ini dalam format Markdown yang rapi dan elegan.
Balas HANYA dalam format JSON dengan skema berikut:
{
  "judul": "RPP - ${mapel} Kelas ${kelas} - ${topik}",
  "konten": "(Teks Markdown lengkap RPP di sini)"
}
`;
    } else if (tipe === "modul") {
      prompt = `
Anda adalah ahli kurikulum pendidikan Indonesia. Susunlah dokumen Modul Ajar lengkap yang relevan untuk ${kurikulumLabel}.
Spesifikasi Modul Ajar:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}
- Topik / Materi Pokok: ${topik}
- Tujuan Pembelajaran: ${tujuan || "Disusun logis sesuai TP Capaian Pembelajaran"}

Struktur Modul Ajar wajib mengandung elemen berikut:
1. Informasi Umum (Identitas, Kompetensi Awal, Profil Pelajar Pancasila, Sarpras, Target Peserta Didik, Model Pembelajaran)
2. Komponen Inti (Tujuan Pembelajaran, Pemahaman Bermakna, Pertanyaan Pemantik, Kegiatan Pembelajaran Lengkap, Asesmen Formatif & Sumatif, Pengayaan & Remedial, Refleksi Peserta Didik & Guru)
3. Lampiran (Lembar Kerja Peserta Didik/LKPD, Bahan Bacaan Guru & Peserta Didik, Glosarium, Daftar Pustaka)

Hasilkan dokumen Modul Ajar ini dalam format Markdown yang rapi dan elegan.
Balas HANYA dalam format JSON dengan skema berikut:
{
  "judul": "Modul Ajar - ${mapel} Kelas ${kelas} - ${topik}",
  "konten": "(Teks Markdown lengkap Modul Ajar di sini)"
}
`;
    } else if (tipe === "silabus") {
      prompt = `
Anda adalah ahli kurikulum pendidikan Indonesia. Susunlah dokumen Silabus Pembelajaran Semester yang terperinci.
Spesifikasi Silabus:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}
- Kurikulum: ${kurikulumLabel}
- Topik Utama: ${topik}
- Alokasi Waktu: 1 Semester

Struktur Silabus wajib mengandung kolom/elemen berikut:
1. Capaian Pembelajaran / Kompetensi Dasar
2. Indikator Pencapaian Kompetensi
3. Materi Pemelajaran / Materi Pokok
4. Kegiatan Pembelajaran (Pendekatan Saintifik/TPACK)
5. Alokasi Waktu (JP)
6. Asesmen Penilaian
7. Sumber Belajar

Hasilkan dokumen Silabus ini dalam format Markdown yang rapi dan menggunakan tabel Markdown untuk visualisasi silabus yang bagus.
Balas HANYA dalam format JSON dengan skema berikut:
{
  "judul": "Silabus Semester - ${mapel} Kelas ${kelas} - ${topik}",
  "konten": "(Teks Markdown lengkap Silabus di sini)"
}
`;
    } else if (tipe === "lkpd") {
      prompt = `
Anda adalah ahli kurikulum pendidikan Indonesia. Susunlah dokumen Lembar Kerja Peserta Didik (LKPD) yang menarik dan menantang untuk siswa.
Spesifikasi LKPD:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}
- Kurikulum: ${kurikulumLabel}
- Topik / Bab: ${topik}
- Tujuan Pembelajaran: ${tujuan || "Disusun logis sesuai topik"}

Struktur LKPD wajib mengandung elemen berikut:
1. Judul Lembar Kerja Peserta Didik (LKPD) yang menarik
2. Identitas Siswa (Nama, Kelas, Kelompok, Tanggal)
3. Petunjuk Pengisian / Belajar
4. Indikator/Tujuan Pembelajaran
5. Ringkasan Materi Singkat (Stimulus)
6. Aktivitas / Tugas Individu (Soal Isian, Pertanyaan Pemantik)
7. Aktivitas / Tugas Kelompok (Diskusi / Eksperimen / Studi Kasus)
8. Lembar Penilaian / Observasi Diri Siswa (Refleksi)

Hasilkan dokumen LKPD ini dalam format Markdown yang rapi dan elegan.
Balas HANYA dalam format JSON dengan skema berikut:
{
  "judul": "LKPD - ${mapel} Kelas ${kelas} - ${topik}",
  "konten": "(Teks Markdown lengkap LKPD di sini)"
}
`;
    } else {
      // laporan_lkpd
      prompt = `
Anda adalah ahli kurikulum dan supervisi pendidikan Indonesia. Susunlah Laporan Evaluasi Pelaksanaan LKPD formal yang ditujukan kepada Kepala Sekolah (Kepsek) sebagai laporan pertanggungjawaban guru.
Spesifikasi Laporan:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}
- Kurikulum: ${kurikulumLabel}
- Topik / Bab: ${topik}

Struktur Laporan LKPD wajib mengandung elemen berikut:
1. Judul Laporan Evaluasi Pelaksanaan LKPD (Formal)
2. Informasi Umum (Nama Guru, Sekolah, Tanggal Pelaksanaan)
3. Pendahuluan (Latar Belakang & Tujuan Penggunaan LKPD)
4. Deskripsi Pelaksanaan KBM menggunakan LKPD
5. Analisis Ketercapaian Hasil Belajar Siswa (Ketuntasan KKM, Keaktifan, Respons Siswa)
6. Kendala yang Dihadapi & Solusi Alternatif
7. Kesimpulan & Rekomendasi Tindak Lanjut untuk Kepala Sekolah
8. Bagian Lembar Tanda Tangan & Pengesahan oleh Kepala Sekolah dan Guru Pengajar di bagian paling bawah.

Hasilkan dokumen Laporan LKPD ini dalam format Markdown yang rapi, formal, dan elegan.
Balas HANYA dalam format JSON dengan skema berikut:
{
  "judul": "Laporan LKPD - ${mapel} Kelas ${kelas} - ${topik}",
  "konten": "(Teks Markdown lengkap Laporan LKPD di sini)"
}
`;
    }

    // 2. Call universal AI service and parse response before token deduction
    let parsed: any;
    try {
      const text = await generateAIContent(prompt);
      const cleanText = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (aiError: any) {
      console.error("Administrasi AI generation failed:", aiError);
      return NextResponse.json({ error: `Gagal memproses AI: ${aiError.message || aiError}` }, { status: 502 });
    }

    // 3. Deduct token on success
    if (user.role !== "admin") {
      await query("UPDATE users SET token_limit = GREATEST(0, token_limit - 1) WHERE id = $1", [userId]);
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("AI Admin Generation Error:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat dokumen AI" }, { status: 500 });
  }
}
