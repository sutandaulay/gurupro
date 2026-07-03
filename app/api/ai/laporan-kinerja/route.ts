/**
 * API Route: /api/ai/laporan-kinerja
 * Generate Laporan Kinerja with AI (SSE streaming)
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

const genAI = process.env.GOOGLE_AI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
  : null

// POST /api/ai/laporan-kinerja - Generate laporan kinerja
export async function POST(req: Request) {
  // Check auth
  const sessionCookie = req.headers.get('cookie')?.split(';')
    ?.find(c => c.trim().startsWith('gurupro_session='))

  if (!sessionCookie) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
  const guruId = sessionData.id

  const body = await req.json()
  const { tahunAjaranId, semester, catatanTambahan } = body

  if (!tahunAjaranId || !semester) {
    return NextResponse.json(
      { error: 'tahun_ajaran_id dan semester wajib diisi' },
      { status: 400 }
    )
  }

  if (!genAI) {
    return NextResponse.json(
      { error: 'AI service not configured' },
      { status: 500 }
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        )
      }

      try {
        // STEP 1: Collect data
        send({ step: 'collecting', message: 'Mengumpulkan data aktivitas...' })

        const [guruData, sekolahData, pelatihanData, evidenceSummary] = await Promise.all([
          getGuruData(guruId),
          getSekolahData(guruId),
          getPelatihanData(guruId, tahunAjaranId, semester),
          getEvidenceSummaryData(guruId, tahunAjaranId, semester),
        ])

        if (!guruData) {
          throw new Error('Data guru tidak ditemukan')
        }

        send({ step: 'analyzing', message: 'Menganalisis capaian kinerja...' })

        // STEP 2: Build prompt
        const prompt = buildLaporanPrompt({
          guru: guruData,
          sekolah: sekolahData,
          pelatihan: pelatihanData,
          evidenceSummary,
          semester,
          catatanTambahan,
        })

        send({ step: 'generating', message: 'AI menyusun narasi laporan...' })

        // STEP 3: Generate with Gemini streaming
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          ],
        })

        const result = await model.generateContentStream({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        })

        let fullText = ''
        for await (const chunk of result.stream) {
          const text = chunk.text()
          fullText += text
          send({ step: 'chunk', text })
        }

        // STEP 4: Parse JSON
        send({ step: 'saving', message: 'Menyimpan laporan...' })

        const cleanJson = fullText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim()

        let laporanContent
        try {
          laporanContent = JSON.parse(cleanJson)
        } catch {
          // If JSON parse fails, create a simple structure
          laporanContent = {
            sections: [
              {
                heading: 'Laporan Kinerja',
                content: cleanJson.substring(0, 2000),
              },
            ],
            ringkasan_singkat: 'Laporan berhasil dibuat.',
          }
        }

        // STEP 5: Save to DB
        const tahunAjaran = await query(
          `SELECT nama FROM tahun_ajaran WHERE id = $1`,
          [tahunAjaranId]
        )
        const tahunAjaranNama = tahunAjaran.rows[0]?.nama || tahunAjaranId

        const insertResult = await query(
          `INSERT INTO laporan_kinerja (
            guru_id, tahun_ajaran_id, semester, judul,
            content, evidence_summary, status, ai_generated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING id`,
          [
            guruId,
            tahunAjaranId,
            semester,
            `Laporan Kinerja Semester ${semester === 'ganjil' ? 'Ganjil' : 'Genap'} ${tahunAjaranNama}`,
            JSON.stringify(laporanContent),
            JSON.stringify(evidenceSummary),
            'draft',
          ]
        )

        send({ step: 'complete', laporan_id: insertResult.rows[0].id })
        controller.close()

      } catch (err: any) {
        console.error('Laporan Kinerja generation error:', err)
        send({ step: 'error', message: err.message || 'Gagal generate laporan' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

async function getGuruData(guruId: string) {
  const result = await query(
    `SELECT id, nama_lengkap, email, whatsapp, nama_sekolah
     FROM users WHERE id = $1`,
    [guruId]
  )
  return result.rows[0] || null
}

async function getSekolahData(guruId: string) {
  const result = await query(
    `SELECT s.nama_sekolah, s.npsn, s.alamat, s.nama_kepala_sekolah
     FROM schools s
     WHERE s.user_id = $1
     LIMIT 1`,
    [guruId]
  )
  return result.rows[0] || { nama_sekolah: 'Sekolah', npsn: '', alamat: '' }
}

async function getPelatihanData(guruId: string, tahunAjaranId: string, semester: string) {
  const result = await query(
    `SELECT nama_pelatihan, penyelenggara, jenis, lingkup,
            durasi_jam, tanggal_mulai, tanggal_selesai,
            nomor_sertifikat, deskripsi, kompetensi_dikembangkan,
            file_sertifikat_url
     FROM pelatihan_guru
     WHERE guru_id = $1 AND tahun_ajaran_id = $2 AND semester = $3
     ORDER BY tanggal_mulai DESC`,
    [guruId, tahunAjaranId, semester]
  )
  return result.rows
}

async function getEvidenceSummaryData(guruId: string, tahunAjaranId: string, semester: string) {
  // Get counts by category
  const categoryResult = await query(
    `SELECT kategori, COUNT(*) as jumlah
     FROM evidence_log
     WHERE guru_id = $1 AND tahun_ajaran_id = $2 AND semester = $3
     GROUP BY kategori`,
    [guruId, tahunAjaranId, semester]
  )

  const categoryMap: Record<string, number> = {}
  categoryResult.rows.forEach((r: any) => {
    categoryMap[r.kategori] = parseInt(r.jumlah)
  })

  // Get journal stats
  const journalResult = await query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE refleksi_guru IS NOT NULL AND LENGTH(refleksi_guru) > 20) as dengan_refleksi
     FROM teacher_journals
     WHERE teacher_id = $1`,
    [guruId]
  )

  // Get assessment stats
  const assessmentResult = await query(
    `SELECT COUNT(DISTINCT a.id) as total_asesmen,
            COUNT(DISTINCT sg.student_id) FILTER (WHERE sg.nilai_akhir < a.kkm) as belum_tuntas
     FROM assessments a
     LEFT JOIN student_grades sg ON sg.assessment_id = a.id
     WHERE a.school_id IN (SELECT id FROM schools WHERE user_id = $1)`,
    [guruId]
  )

  // Get schedule/mapel info
  const mapelResult = await query(
    `SELECT DISTINCT sub.nama_mapel, c.nama_kelas
     FROM schedules s
     JOIN subjects sub ON sub.id = s.subject_id
     JOIN classes c ON c.id = s.class_id
     WHERE s.school_id IN (SELECT id FROM schools WHERE user_id = $1)`,
    [guruId]
  )

  return {
    total_pembelajaran: categoryMap['pelaksanaan'] || 0,
    total_jurnal: parseInt(journalResult.rows[0]?.total || '0'),
    jurnal_dengan_refleksi: parseInt(journalResult.rows[0]?.dengan_refleksi || '0'),
    total_modul_ajar: categoryMap['perencanaan'] || 0,
    total_penilaian: categoryMap['penilaian'] || 0,
    total_remedial: categoryMap['tindak_lanjut'] || 0,
    total_komunikasi: categoryMap['kolaborasi_ortu'] || 0,
    total_refleksi: categoryMap['refleksi'] || 0,
    mapel: [...new Set(mapelResult.rows.map((r: any) => r.nama_mapel))],
    kelas: [...new Set(mapelResult.rows.map((r: any) => r.nama_kelas))],
  }
}

// ─── PROMPT BUILDER ──────────────────────────────────────────────────────────

interface LaporanPromptData {
  guru: any
  sekolah: any
  pelatihan: any[]
  evidenceSummary: any
  semester: string
  catatanTambahan?: string
}

function buildLaporanPrompt(data: LaporanPromptData): string {
  const { guru, sekolah, pelatihan, evidenceSummary, semester, catatanTambahan } = data
  const tahunAjaran = '2024/2025' // Should come from params

  return `
Kamu adalah sistem penyusun Laporan Kinerja Guru profesional berbasis data aktivitas nyata.

DATA GURU:
- Nama: ${guru?.nama_lengkap || 'Guru'}
- Email: ${guru?.email || '-'}
- Mata Pelajaran: ${evidenceSummary.mapel?.join(', ') || '-'}
- Kelas yang Diajar: ${evidenceSummary.kelas?.join(', ') || '-'}
- Sekolah: ${sekolah?.nama_sekolah || '-'}
- NPSN: ${sekolah?.npsn || '-'}
- Alamat: ${sekolah?.alamat || '-'}
- Periode: Semester ${semester === 'ganjil' ? 'Ganjil' : 'Genap'} TP ${tahunAjaran}

BUKTI AKTIVITAS MENGAJAR (data nyata dari sistem):
- Total aktivitas mengajar tercatat: ${evidenceSummary.total_pembelajaran || 0}
- Jurnal mengajar: ${evidenceSummary.total_jurnal || 0} dari ${evidenceSummary.total_pembelajaran || 0} pertemuan
- Jurnal dengan refleksi: ${evidenceSummary.jurnal_dengan_refleksi || 0}
- Modul Ajar/RPP dibuat: ${evidenceSummary.total_modul_ajar || 0} dokumen
- Asesmen/Nilai diinput: ${evidenceSummary.total_penilaian || 0} kali
- Remedial/Pengayaan: ${evidenceSummary.total_remedial || 0} kegiatan
- Refleksi mengajar: ${evidenceSummary.total_refleksi || 0}
- Komunikasi dengan orang tua: ${evidenceSummary.total_komunikasi || 0} kali

PENGEMBANGAN DIRI & PELATIHAN:
${pelatihan && pelatihan.length > 0
  ? pelatihan.map((p, i) =>
      `- ${i + 1}. ${p.nama_pelatihan}
   Penyelenggara: ${p.penyelenggara}
   Jenis: ${p.jenis} | Lingkup: ${p.lingkup}
   Durasi: ${p.durasi_jam} jam | Tanggal: ${p.tanggal_mulai} s.d. ${p.tanggal_selesai}
   ${p.nomor_sertifikat ? `No. Sertifikat: ${p.nomor_sertifikat}` : 'Sertifikat: belum upload'}
   ${p.deskripsi ? `Dampak: ${p.deskripsi}` : ''}`
    ).join('\n\n')
  : '- Belum ada data pelatihan yang diinput'
}
${pelatihan && pelatihan.length > 0
  ? `Total jam pengembangan diri: ${pelatihan.reduce((s: number, p: any) => s + p.durasi_jam, 0)} jam`
  : ''}

${catatanTambahan ? `CATATAN TAMBAHAN DARI GURU:
${catatanTambahan}` : ''}

TUGAS:
Susun Laporan Kinerja Guru yang profesional, naratif, dan berbasis data di atas.

ATURAN PENULISAN:
1. Bahasa Indonesia baku dan profesional
2. Naratif — bukan hanya daftar poin
3. Setiap klaim HARUS didukung data nyata di atas
4. Hindari klise dan frasa generik yang tidak informatif
5. Jujur — jika data pelatihan belum ada, sebutkan bahwa ini perlu dilengkapi
6. Panjang total narasi: 600–900 kata
7. Jika data某个 kategori 0 atau kosong, tetap tulis narasi yang menjelaskan perlunya aktivitas tersebut

FORMAT OUTPUT (JSON ketat, tidak ada teks di luar JSON):
\`\`\`json
{
  "identitas": {
    "nama": "...",
    "mata_pelajaran": "...",
    "kelas": "...",
    "sekolah": "...",
    "periode": "..."
  },
  "sections": [
    {
      "heading": "I. Pendahuluan",
      "content": "narasi paragraf..."
    },
    {
      "heading": "II. Pelaksanaan Pembelajaran",
      "content": "narasi 2-3 paragraf tentang konsistensi mengajar, kualitas perencanaan, pendekatan pembelajaran..."
    },
    {
      "heading": "III. Penilaian dan Evaluasi Hasil Belajar",
      "content": "narasi tentang ragak asesmen, tindak lanjut remedial/pengayaan..."
    },
    {
      "heading": "IV. Pengembangan Diri dan Kompetensi Profesional",
      "content": "narasi tentang pelatihan yang diikuti (sebutkan nama spesifik), dampaknya, jam pengembangan..."
    },
    {
      "heading": "V. Kolaborasi dan Komunikasi",
      "content": "narasi tentang komunikasi dengan orang tua siswa..."
    },
    {
      "heading": "VI. Kesimpulan dan Rencana Tindak Lanjut",
      "content": "narasi capaian utama + 2-3 rencana perbaikan semester berikutnya..."
    }
  ],
  "ringkasan_singkat": "1-2 kalimat ringkasan untuk dashboard"
}
\`\`\`
`
}
