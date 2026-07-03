/**
 * GuruPRO AI Prompt Templates
 * Kumpulan prompt untuk berbagai fitur AI
 */

// ============================================
// JOURNAL PROMPTS
// ============================================

export interface JournalGenerateInput {
  nama_guru: string;
  mapel: string;
  kelas: string;
  tanggal: string;
  materi?: string;
  topik?: string;
  jumlah_siswa_hadir: number;
  jumlah_siswa_tidak_hadir: number;
  catatan_guru?: string;
  jenjang: string;
}

export function generateJournalPrompt(input: JournalGenerateInput): string {
  return `
# Tugas: Buat Jurnal Mengajar

## Informasi Guru
- Nama Guru: ${input.nama_guru}
- Mata Pelajaran: ${input.mapel}
- Kelas: ${input.kelas}
- Jenjang: ${input.jenjang}
- Tanggal: ${input.tanggal}
- Jumlah Siswa Hadir: ${input.jumlah_siswa_hadir}
- Jumlah Siswa Tidak Hadir: ${input.jumlah_siswa_tidak_hadir}
${input.materi ? `- Materi yang Diajarkan: ${input.materi}` : ''}
${input.topik ? `- Topik: ${input.topik}` : ''}
${input.catatan_guru ? `- Catatan Guru: ${input.catatan_guru}` : ''}

## Format Output JSON
Buatkan JSON dengan struktur berikut (HANYA JSON, tanpa teks lain di luar JSON):

{
  "materi_pembelajaran": "Deskripsi materi yang diajarkan (maks 255 karakter)",
  "tujuan_pembelajaran": [
    "Tujuan 1 - spesifik dan terukur",
    "Tujuan 2 - spesifik dan terukur",
    "Tujuan 3 - spesifik dan terukur"
  ],
  "aktivitas_pembelajaran": "Langkah-langkah pembelajaran yang dilakukan (minimal 3 fase: pendahuluan, inti, penutup)",
  "media_pembelajaran": "Media yang digunakan",
  "asesmen_pembelajaran": "Cara menilai pemahaman siswa",
  "refleksi_guru": "Refleksi diri tentang pembelajaran hari ini (hambatan, keberhasilan, solusi)",
  "tindak_lanjut": "Rencana tindak lanjut untuk pertemuan berikutnya"
}

## Aturan:
1. Gunakan bahasa Indonesia formal yang sesuai untuk administrasi guru
2. Tujuan pembelajaran harus SMART (Spesifik, Measurable, Achievable, Relevant, Time-bound)
3. Aktivitas pembelajaran harus mencakup 3 fase: Pendahuluan, Inti, Penutup
4. Refleksi harus mencakup: apa yang berjalan baik, hambatan, dan solusi
5. Tindak lanjut harus actionable dan spesifik
6. Respons dalam format JSON valid saja, tanpa markdown code block
`.trim();
}

// ============================================
// REFLECTION PROMPTS
// ============================================

export interface ReflectionGenerateInput {
  nama_guru: string;
  mapel: string;
  kelas: string;
  materi: string;
  aktivitas: string;
  jumlah_hadir: number;
  jumlah_tidak_hadir: number;
  catatan?: string;
}

export function generateReflectionPrompt(input: ReflectionGenerateInput): string {
  return `
# Tugas: Buat Refleksi Diri Guru

## Informasi Pembelajaran
- Guru: ${input.nama_guru}
- Mata Pelajaran: ${input.mapel}
- Kelas: ${input.kelas}
- Materi: ${input.materi}
- Aktivitas: ${input.aktivitas}
- Kehadiran: ${input.jumlah_hadir} hadir, ${input.jumlah_tidak_hadir} tidak hadir
${input.catatan ? `- Catatan: ${input.catatan}` : ''}

## Format Output
Buatkan refleksi diri dalam format paragraf bahasa Indonesia formal yang mencakup:

1. **Hal yang Berjalan dengan Baik**
   - Jelaskan apa yang berhasil dalam pembelajaran hari ini
   - Sertakan contoh spesifik

2. **Hambatan/Kendala**
   - Identifikasi kendala yang dihadapi
   - Jelaskan penyebabnya

3. **Solusi yang Dilakukan**
   - Langkah konkret yang sudah diambil untuk mengatasi kendala

4. **Langkah Improvement**
   - Rencana perbaikan untuk pertemuan berikutnya

## Aturan:
1. Gunakan bahasa formal Indonesia untuk administrasi
2. Setiap poin ditulis dalam paragraf yang terpisah
3. Bersikap objektif dan reflektif
4. Sertakan contoh konkret yang bisa diverifikasi
5. Total output maksimal 500 kata

## Output Format:
{
  "berjalan_baik": "paragraf tentang keberhasilan",
  "hambatan": "paragraf tentang kendala",
  "solusi": "paragraf tentang solusi yang dilakukan",
  "improvement": "paragraf tentang rencana improvement"
}
`.trim();
}

// ============================================
// FOLLOW-UP / TINDAK LANJUT PROMPTS
// ============================================

export interface FollowUpGenerateInput {
  nama_guru: string;
  mapel: string;
  kelas: string;
  topik_sekarang: string;
  topik_selanjutnya?: string;
  siswa_belum_paham?: string[];
  siswa_advance?: string[];
}

export function generateFollowUpPrompt(input: FollowUpGenerateInput): string {
  return `
# Tugas: Buat Rencana Tindak Lanjut

## Informasi
- Guru: ${input.nama_guru}
- Mata Pelajaran: ${input.mapel}
- Kelas: ${input.kelas}
- Topik yang Baru Selesai: ${input.topik_sekarang}
${input.topik_selanjutnya ? `- Topik Selanjutnya: ${input.topik_selanjutnya}` : ''}
${input.siswa_belum_paham && input.siswa_belum_paham.length > 0 ? `- Siswa Perlu Remedial: ${input.siswa_belum_paham.join(', ')}` : ''}
${input.siswa_advance && input.siswa_advance.length > 0 ? `- Siswa Avanzado (Perlu Pengayaan): ${input.siswa_advance.join(', ')}` : ''}

## Format Output JSON:
{
  "persiapan_materi": [
    "Langkah 1 untuk menyiapkan materi",
    "Langkah 2 untuk menyiapkan materi"
  ],
  "remedial": [
    {
      "siswa": "Nama siswa",
      "materi_yang_perlu_dipelajari": "materi spesifik",
      "cara_pembelajaran": "metode remedial yang disarankan"
    }
  ],
  "pengayaan": [
    {
      "siswa": "Nama siswa",
      "materi_pengayaan": "materi tingkat lanjut",
      "tugas": "tugas pengayaan"
    }
  ],
  "catatan_orang_tua": "Catatan yang perlu diinformasikan ke orang tua (jika ada)"
}

## Aturan:
1. Remedial harus fokus pada siswa yang belum mencapai KKM
2. Pengayaan untuk siswa yang sudah melampaui standar
3. Setiap rencana harus actionable dan spesifik
4. Gunakan bahasa Indonesia formal
5. Output dalam format JSON valid saja
`.trim();
}

// ============================================
// RAPOR PROMPTS
// ============================================

export interface RaportGenerateInput {
  nama_siswa: string;
  mapel: string;
  nilai: number;
  kkm: number;
  jenjang: string;
  semester: string;
  tahun_ajaran: string;
  aspek_kompetensi?: string;
  nilai_sebelumnya?: number;
}

export function generateRaportPrompt(input: RaportGenerateInput): string {
  const isLulus = input.nilai >= input.kkm;
  const trend = input.nilai_sebelumnya
    ? (input.nilai > input.nilai_sebelumnya ? 'meningkat' : input.nilai < input.nilai_sebelumnya ? 'menurun' : 'stabil')
    : null;

  return `
# Tugas: Buat Deskripsi Raport

## Informasi Siswa
- Nama: ${input.nama_siswa}
- Mata Pelajaran: ${input.mapel}
- Jenjang: ${input.jenjang}
- Nilai: ${input.nilai}
- KKM: ${input.kkm}
- Status: ${isLulus ? 'TUNTAS' : 'BELUM TUNTAS'}
- Semester: ${input.semester}
- Tahun Ajaran: ${input.tahun_ajaran}
${input.aspek_kompetensi ? `- Aspek Kompetensi: ${input.aspek_kompetensi}` : ''}
${trend ? `- Trend Nilai: ${trend} dari semester sebelumnya` : ''}

## Format Output:
{
  "deskripsi": "Deskripsi rapor dalam 2-3 kalimat (maksimal 150 karakter per kalimat)",
  "saran": "Saran untuk siswa/orang tua (opsional, maksimal 2 kalimat)"
}

## Aturan Penulisan:
1. SELALU gunakan format: "Ananda [nama_siswa]" di awal kalimat
2. Fokus pada KEBIJAKAN yang sesuai dengan nilai:
   - Jika NILAI >= KKM (Lulus):
     * Apresiasi kemampuan yang baik
     * Sorot pencapaian spesifik
     * Berikan motivasi untuk berkembang lebih jauh
   - Jika NILAI < KKM (Belum Tuntas):
     * Motivasi positif, BUKAN menyalahkan
     * Jelaskan area yang perlu ditingkatkan
     * Berikan saran perbaikan yang spesifik
3. Bahasa: Formal Indonesia untuk sekolah
4. Nada: Sopan, mendukung, dan inspiratif
5. Hindari: "Murid ini", "Siswa ini" - gunakan "Ananda"
6. Panjang total: Maksimal 500 karakter

## Contoh Output (Nilai Baik):
Input: nama=Andi, nilai=88, kkm=75, mapel=Matematika
Output: {
  "deskripsi": "Ananda Andi menunjukkan kemampuan yang sangat baik dalam memahami konsep matematika. Siswa mampu menerapkan operasi hitung dengan tepat dan mandiri. Apresiasi atas usaha dan konsistensinya dalam belajar.",
  "saran": "Terus berlatih soal-soal aplikasi untuk memperdalam pemahaman. Great job!"
}

## Contoh Output (Nilai Kurang):
Input: nama=Sari, nilai=62, kkm=75, mapel=Bahasa Indonesia
Output: {
  "deskripsi": "Ananda Sari masih membutuhkan bimbingan tambahan dalam memahami kosakata baru. Dengan usaha lebih dan latihan membaca rutin, kemampuan ini dapat ditingkatkan.",
  "saran": "Disarankan membaca buku cerita 15 menit setiap hari dan mencatat kosakata baru yang ditemukan."
}
`.trim();
}

// ============================================
// CHAT ADMINISTRASI PROMPTS
// ============================================

export interface ChatContext {
  nama_guru: string;
  mapel?: string;
  kelas?: string;
  jenjang?: string;
  hari_ini_tanggal: string;
  tugas_pending?: string[];
}

export function generateChatSystemPrompt(context: ChatContext): string {
  return `
# Sistem: GuruPRO AI Chat Administrasi

## Peran Anda
Kamu adalah asisten AI yang membantu GURU di Indonesia dalam mengerjakan ADMINISTRASI SEKOLAH.

## Konteks Guru:
- Nama: ${context.nama_guru}
${context.mapel ? `- Mata Pelajaran: ${context.mapel}` : ''}
${context.kelas ? `- Kelas yang diampu: ${context.kelas}` : ''}
${context.jenjang ? `- Jenjang: ${context.jenjang}` : ''}
- Tanggal: ${context.hari_ini_tanggal}
${context.tugas_pending && context.tugas_pending.length > 0 ? `- Tugas Pending:\n  ${context.tugas_pending.map(t => `- ${t}`).join('\n  ')}` : ''}

## Kemampuan Anda:
1. **Membuat Jurnal Mengajar** - Buat jurnal harian otomatis
2. **Membuat RPP/Modul Ajar** - Rancang rencana pembelajaran
3. **Membuat Soal** - Generate soal PG, essay, HOTS
4. **Membuat Deskripsi Raport** - AI writer untuk rapor siswa
5. **Membuat Pesan WA** - Template pesan untuk komunikasi dengan orang tua
6. **Analisis Kelas** - Analisis nilai dan kehadiran siswa
7. **Rekomendasi Remedial** - Saran pembelajaran remedial

## Aturan:
1. Jawab dalam Bahasa Indonesia yang formal
2. Jika tidak yakin, tanyakan informasi tambahan
3. Prioritaskan tugas yang mendesak
4. Berikan jawaban yang actionable
5. SELALU tawarkan bantuan lain setelah menyelesaikan tugas

## Contoh Interaksi:
User: "Buat jurnal hari ini"
AI: "Baik! Untuk membuat jurnal mengajar, saya perlu informasi:
- Mata pelajaran apa yang diajarkan?
- Kelas berapa?
- Materi apa yang disampaikan?
- Ada catatan khusus?"

## Format Respons:
1. Selalu ramah dan profesional
2. Gunakan emoji secukupnya untuk keterbacaan
3. Jika tugas bisa langsung dikerjakan, langsung buatkan
4. Jika perlu info tambahan, tanyakan dengan jelas
`.trim();
}

// ============================================
// ABSENT ALERT PROMPTS
// ============================================

export interface AbsentAlertInput {
  nama_siswa: string;
  kelas: string;
  nama_guru: string;
  nama_sekolah: string;
  jumlah_tidak_hadir: number;
  periode: string; // "3 hari berturut-turut", "minggu ini"
  contact_wali?: string;
}

export function generateAbsentAlertPrompt(input: AbsentAlertInput): string {
  return `
# Tugas: Buat Pesan WhatsApp untuk Wali Murid

## Informasi:
- Siswa: ${input.nama_siswa}
- Kelas: ${input.kelas}
- Guru: ${input.nama_guru}
- Sekolah: ${input.nama_sekolah}
- Keadaan: Tidak hadir ${input.jumlah_tidak_hadir} ${input.periode}
${input.contact_wali ? `- No. WA Wali: ${input.contact_wali}` : ''}

## Format Output:
{
  "subject": "Subjek pesan singkat",
  "message": "Isi pesan WhatsApp lengkap",
  "tone": "formal/informal",
  "urgency": "low/medium/high"
}

## Aturan:
1. Pesan sopan dan profesional
2. Tidak menyalahkan siswa atau keluarga
3. Minta konfirmasi kondisi siswa
4. Tawarkan bantuan jika diperlukan
5. Sertakan nomor sekolah untuk kontak
6. Panjang pesan: 1-3 paragraf

## Contoh Pesan:
---
Yth. Bapak/Ibu Wali Murid dari Ananda ${input.nama_siswa},

Dengan hormat, kami informasikan bahwa Ananda ${input.nama_siswa} tidak dapat hadir ke sekolah selama ${input.jumlah_tidak_hadir} hari ${input.periode}.

Kami mohon konfirmasi mengenai kondisi Ananda. Jika ada sesuatu yang perlu kami bantu, jangan ragu untuk menghubungi kami.

Terima kasih atas perhatiannya.

Hormat kami,
${input.nama_guru}
Guru Kelas ${input.kelas}
${input.nama_sekolah}
---
`.trim();
}

// ============================================
// LESSON MEMORY PROMPTS
// ============================================

export function generateLessonRecommendationPrompt(
  lastTopic: string,
  lastSubtopic: string,
  curriculum: string,
  nextTopics: string[]
): string {
  return `
# Tugas: Berikan Rekomendasi untuk Pertemuan Berikutnya

## Informasi Pembelajaran Sebelumnya:
- Topik Terakhir: ${lastTopic}
- Subtopik Terakhir: ${lastSubtopic}
- Kurikulum: ${curriculum}
- Topik selanjutnya yang tersedia: ${nextTopics.join(', ')}

## Format Output:
{
  "greeting": "Sapaan untuk guru",
  "summary_last": "Ringkasan singkat apa yang dilakukan terakhir kali",
  "suggestion": "Rekomendasi untuk melanjutkan",
  "next_topic": "Topik yang disarankan",
  "preparation_tips": [
    "Tips persiapan 1",
    "Tips persiapan 2"
  ]
}

## Aturan:
1. Ramah dan mendukung
2. Fokus pada kelanjutan pembelajaran
3. Berikan tips praktis untuk persiapan
4. Gunakan bahasa Indonesia formal untuk guru
`.trim();
}

// ============================================
// ANALYTICS PROMPTS
// ============================================

export interface ClassAnalyticsInput {
  kelas: string;
  mapel: string;
  jenjang: string;
  jumlah_siswa: number;
  rata_rata_nilai: number;
  kkm: number;
  siswa_belum_tuntas: { nama: string; nilai: number }[];
  siswa_tuntas: number;
  persentase_hadir: number;
  trend_nilai: 'meningkat' | 'menurun' | 'stabil';
}

export function generateAnalyticsPrompt(input: ClassAnalyticsInput): string {
  return `
# Tugas: Analisis Kelas

## Data Kelas:
- Kelas: ${input.kelas}
- Mata Pelajaran: ${input.mapel}
- Jenjang: ${input.jenjang}
- Jumlah Siswa: ${input.jumlah_siswa}
- Rata-rata Nilai: ${input.rata_rata_nilai}
- KKM: ${input.kkm}
- Siswa Tuntas: ${input.siswa_tuntas} siswa
- Siswa Belum Tuntas: ${input.siswa_belum_tuntas.length} siswa
- Persentase Kehadiran: ${input.persentase_hadir}%
- Trend Nilai: ${input.trend_nilai}

## Siswa yang Perlu Remedial:
${input.siswa_belum_tuntas.map(s => `- ${s.nama}: ${s.nilai}`).join('\n')}

## Format Output:
{
  "summary": "Ringkasan analisis kelas dalam 2-3 kalimat",
  "kekuatan_kelas": [
    "Poin positif kelas"
  ],
  "area_perbaikan": [
    "Area yang perlu diperbaiki"
  ],
  "rekomendasi": [
    {
      "jenis": "remedial/pengayaan/policy",
      "description": "Deskripsi rekomendasi"
    }
  ],
  "siswa_prioritas_remedial": [
    {
      "nama": "Nama siswa",
      "nilai": number,
      "priority": "high/medium/low"
    }
  ]
}

## Aturan:
1. Analisis berdasarkan data faktual
2. Berikan rekomendasi yang actionable
3. Prioritaskan siswa dengan nilai jauh di bawah KKM
4. Fokus pada SOLUSI, bukan masalah
5. Gunakan bahasa Indonesia formal
`.trim();
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Estimate tokens (rough estimation)
 * ~4 karakter = 1 token untuk teks Indonesia
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Parse JSON response safely
 */
export function parseAISafeResponse<T>(response: string, fallback: T): T {
  try {
    // Remove markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.slice(7);
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.slice(3);
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.slice(0, -3);
    }

    return JSON.parse(cleanResponse.trim()) as T;
  } catch {
    console.error('Failed to parse AI response:', response);
    return fallback;
  }
}
