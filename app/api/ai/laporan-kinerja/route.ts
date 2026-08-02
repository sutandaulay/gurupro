/**
 * API Route: /api/ai/laporan-kinerja
 * Generate Laporan Kinerja with AI (SSE streaming)
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSchoolAccess } from '@/lib/school-access'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { getUserPoinAccess, consumeUserPoin, logFailedPoinUsage } from '@/src/services/poin-service'
import { deductPoinFromAIResult } from '@/src/lib/ai-usage'

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

  // Poin check
  const poinAccess = await getUserPoinAccess(guruId)
  if (!poinAccess.access.allowed) {
    return NextResponse.json({
      error: 'Poin habis atau langganan expired',
      reason: poinAccess.access.reason,
      remainingPoin: 0,
    }, { status: 403 })
  }

  const body = await req.json()
  const { tahunAjaranId, semester, catatanTambahan, kurikulum = 'merdeka', sekolahId } = body

  if (sekolahId) {
    await requireSchoolAccess(sekolahId)
  }

  const kurikulumLabel: Record<string, string> = {
    merdeka: 'Kurikulum Merdeka',
    k13: 'Kurikulum 2013 (K13)',
    kbc: 'Kurikulum Berbasis Cinta (KBC)',
    hybrid: 'Kurikulum Hybrid (Gabungan)',
  }

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
        send({ step: 'collecting', message: 'Mengumpulkan data aktivitas & SKP...' })

        const [guruData, sekolahData, pelatihanData, evidenceSummary, skpData, observasiData] = await Promise.all([
          getGuruData(guruId),
          getSekolahData(guruId, sekolahId),
          getPelatihanData(guruId, tahunAjaranId, semester),
          getEvidenceSummaryData(guruId, tahunAjaranId, semester, sekolahId),
          getSkpData(guruId, tahunAjaranId),
          getObservasiData(guruId, tahunAjaranId),
        ])

        if (!guruData) {
          throw new Error('Data guru tidak ditemukan')
        }

        send({ step: 'analyzing', message: 'Menganalisis capaian & observasi kinerja...' })

        // STEP 2: Build prompt
        const prompt = buildLaporanPrompt({
          guru: guruData,
          sekolah: sekolahData,
          pelatihan: pelatihanData,
          evidenceSummary,
          skp: skpData,
          observasi: observasiData,
          semester,
          catatanTambahan,
          kurikulum: kurikulumLabel[kurikulum] || 'Kurikulum Merdeka',
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
            content, evidence_summary, status, ai_generated_at, sekolah_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
          RETURNING id`,
          [
            guruId,
            tahunAjaranId,
            semester,
            `Laporan Kinerja Semester ${semester === 'ganjil' ? 'Ganjil' : 'Genap'} ${tahunAjaranNama}`,
            JSON.stringify(laporanContent),
            JSON.stringify(evidenceSummary),
            'draft',
            sekolahId || null,
          ]
        )

        // Deduct Poin only if generation succeeded and content was saved
        if (insertResult?.rows?.[0]?.id) {
          try {
            const estimatedUsage = { inputTokens: 2000, outputTokens: 3000, cachedTokens: 0, provider: 'gemini', model: 'gemini-2.5-flash-lite' };
            await deductPoinFromAIResult({ success: true, usage: estimatedUsage }, guruId, 'ai-laporan-kinerja', {})
            console.log(`[AI Laporan Kinerja] Poin deducted`)
          } catch (poinError: any) {
            console.error('[AI Laporan Kinerja] Poin deduction failed:', poinError)
          }
        }

        send({ step: 'complete', laporan_id: insertResult.rows[0].id })
        controller.close()

      } catch (err: any) {
        console.error('Laporan Kinerja generation error:', err)

        // Log failed usage
        await logFailedPoinUsage(guruId, 0, 'ai-laporan-kinerja', err.message)

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

async function getSekolahData(guruId: string, sekolahId?: string) {
  if (sekolahId) {
    const result = await query(
      `SELECT s.nama_sekolah, s.npsn, s.alamat, s.nama_kepala_sekolah
       FROM schools s
       WHERE s.id = $1
       LIMIT 1`,
      [sekolahId]
    )
    if (result.rows[0]) return result.rows[0]
  }
  return { nama_sekolah: 'Sekolah', npsn: '', alamat: '' }
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

async function getEvidenceSummaryData(guruId: string, tahunAjaranId: string, semester: string, sekolahId?: string) {
  const params: any[] = [guruId, tahunAjaranId, semester]
  let evidenceFilter = `guru_id = $1 AND tahun_ajaran_id = $2 AND semester = $3`
  if (sekolahId) {
    evidenceFilter += ` AND sekolah_id = $4`
    params.push(sekolahId)
  }

  const categoryResult = await query(
    `SELECT kategori, COUNT(*) as jumlah
     FROM evidence_log
     WHERE ${evidenceFilter}
     GROUP BY kategori`,
    params
  )

  const categoryMap: Record<string, number> = {}
  categoryResult.rows.forEach((r: any) => {
    categoryMap[r.kategori] = parseInt(r.jumlah)
  })

  const journalParams: any[] = [guruId]
  let journalFilter = `teacher_id = $1`
  if (sekolahId) {
    journalFilter += ` AND school_id = $2`
    journalParams.push(sekolahId)
  }

  const journalResult = await query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE refleksi_guru IS NOT NULL AND LENGTH(refleksi_guru) > 20) as dengan_refleksi
     FROM teacher_journals
     WHERE ${journalFilter}`,
    journalParams
  )

  const assessParams: any[] = [guruId]
  let assessFilter = `user_id = $1`
  if (sekolahId) {
    assessFilter = `id = $2 AND user_id = $1`
    assessParams.push(sekolahId)
  }

  const assessmentResult = await query(
    `SELECT COUNT(DISTINCT a.id) as total_asesmen,
            COUNT(DISTINCT sg.student_id) FILTER (WHERE sg.nilai_akhir < a.kkm) as belum_tuntas
     FROM assessments a
     LEFT JOIN student_grades sg ON sg.assessment_id = a.id
     WHERE a.school_id IN (SELECT id FROM schools WHERE ${assessFilter})`,
    assessParams
  )

  const mapelParams: any[] = [guruId]
  let mapelFilter = `user_id = $1`
  if (sekolahId) {
    mapelFilter = `id = $2 AND user_id = $1`
    mapelParams.push(sekolahId)
  }

  const mapelResult = await query(
    `SELECT DISTINCT sub.nama_mapel, c.nama_kelas
     FROM schedules s
     JOIN subjects sub ON sub.id = s.subject_id
     JOIN classes c ON c.id = s.class_id
     WHERE s.school_id IN (SELECT id FROM schools WHERE ${mapelFilter})`,
    mapelParams
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

// ─── SKP & OBSERVASI HELPERS ──────────────────────────────────────────────────

async function getSkpData(guruId: string, tahunAjaranId: string) {
  const skpResult = await query(
    `SELECT id, status, catatan_guru, catatan_kepsek
     FROM skp_tahunan
     WHERE guru_id = $1 AND tahun_ajaran_id = $2`,
    [guruId, tahunAjaranId]
  )

  if (skpResult.rows.length === 0) return null

  const skp = skpResult.rows[0]

  const indikatorResult = await query(
    `SELECT si.target_self, ik.kode, ik.nama, ik.komponen, ik.bobot_persen, ik.min_evidence
     FROM skp_indikator si
     JOIN indikator_kinerja_config ik ON ik.id = si.indikator_id
     WHERE si.skp_id = $1
     ORDER BY ik.kode`,
    [skp.id]
  )

  return {
    ...skp,
    indikator_list: indikatorResult.rows,
  }
}

async function getObservasiData(guruId: string, tahunAjaranId: string) {
  const obsResult = await query(
    `SELECT id, tanggal_observasi, jenis, suasana_pembelajaran, catatan_observer, rekomendasi, status
     FROM observasi_kinerja
     WHERE guru_id = $1 AND tahun_ajaran_id = $2 AND status = 'completed'
     ORDER BY tanggal_observasi DESC`,
    [guruId, tahunAjaranId]
  )

  if (obsResult.rows.length === 0) return []

  const obsIds = obsResult.rows.map(obs => obs.id);

  const ratingResult = await query(
    `SELECT oi.observasi_id, oi.rating, oi.catatan, oi.bukti_observasi, ik.kode, ik.nama as indikator_nama
     FROM observasi_indikator oi
     JOIN indikator_kinerja_config ik ON ik.id = oi.indikator_id
     WHERE oi.observasi_id = ANY($1)
     ORDER BY ik.kode`,
    [obsIds]
  );

  const ratingsByObsId: Record<string, any[]> = {};
  for (const row of ratingResult.rows) {
    const obsId = row.observasi_id;
    if (!ratingsByObsId[obsId]) {
      ratingsByObsId[obsId] = [];
    }
    ratingsByObsId[obsId].push({
      rating: row.rating,
      catatan: row.catatan,
      bukti_observasi: row.bukti_observasi,
      kode: row.kode,
      indikator_nama: row.indikator_nama
    });
  }

  return obsResult.rows.map(obs => ({
    ...obs,
    indikator_ratings: ratingsByObsId[obs.id] || [],
  }));
}

// ─── PROMPT BUILDER ──────────────────────────────────────────────────────────

interface LaporanPromptData {
  guru: any
  sekolah: any
  pelatihan: any[]
  evidenceSummary: any
  skp: any
  observasi: any[]
  semester: string
  catatanTambahan?: string
  kurikulum?: string
}

function buildLaporanPrompt(data: LaporanPromptData): string {
  const { guru, sekolah, pelatihan, evidenceSummary, skp, observasi, semester, catatanTambahan, kurikulum } = data
  const tahunAjaran = '2024/2025'

  let skpSection = ''
  if (skp) {
    skpSection = `
RENCANA SKP TAHUNAN:
- Status: ${skp.status}
- Indikator yang dipilih:
${skp.indikator_list?.map((ind: any) =>
  `  - ${ind.kode}: ${ind.nama} (target: ${ind.target_self} evidence, komponen: ${ind.komponen})`
).join('\n') || '  - Tidak ada indikator dipilih'}
${skp.catatan_guru ? `- Catatan Guru: ${skp.catatan_guru}` : ''}
`
  }

  let observasiSection = ''
  if (observasi && observasi.length > 0) {
    observasiSection = `
HASIL OBSERVASI KINERJA (${observasi.length} observasi):
${observasi.map((obs: any, i: number) => {
  const avg = obs.indikator_ratings?.length > 0
    ? (obs.indikator_ratings.reduce((s: number, r: any) => s + r.rating, 0) / obs.indikator_ratings.length).toFixed(1)
    : '-'
  return `Observasi ${i + 1} (${new Date(obs.tanggal_observasi).toLocaleDateString('id-ID')}):
  Jenis: ${obs.jenis}
  Rata-rata rating: ${avg}/4
  ${obs.indikator_ratings?.map((r: any) => `  ${r.kode}: ${r.rating}/4 — ${r.catatan || ''}`).join('\n') || '  - Belum ada rating'}
  ${obs.suasana_pembelajaran ? `Suasana: ${obs.suasana_pembelajaran}` : ''}
  ${obs.catatan_observer ? `Catatan Observer: ${obs.catatan_observer}` : ''}
  ${obs.rekomendasi ? `Rekomendasi: ${obs.rekomendasi}` : ''}`
}).join('\n\n')}
`
  }

  return `
Kamu adalah sistem penyusun Laporan Kinerja Guru profesional sesuai pedoman PKG 2026 (Kepmendikdasmen No. 271/O/2025).

DATA GURU:
- Nama: ${guru?.nama_lengkap || 'Guru'}
- Email: ${guru?.email || '-'}
- Mata Pelajaran: ${evidenceSummary.mapel?.join(', ') || '-'}
- Kelas yang Diajar: ${evidenceSummary.kelas?.join(', ') || '-'}
- Sekolah: ${sekolah?.nama_sekolah || '-'}
- NPSN: ${sekolah?.npsn || '-'}
- Alamat: ${sekolah?.alamat || '-'}
- Periode: Semester ${semester === 'ganjil' ? 'Ganjil' : 'Genap'} TP ${tahunAjaran}
- Kurikulum: ${kurikulum || 'Kurikulum Merdeka'}${skpSection}

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

${skpSection}
${observasiSection}
${catatanTambahan ? `CATATAN TAMBAHAN DARI GURU:
${catatanTambahan}` : ''}

TUGAS:
Susun Laporan Kinerja Guru yang profesional, naratif, dan berbasis data sesuai struktur PKG 2026.

ATURAN PENULISAN:
1. Bahasa Indonesia baku dan profesional
2. Naratif — bukan hanya daftar poin
3. Setiap klaim HARUS didukung data nyata di atas
4. Hindari klise dan frasa generik yang tidak informatif
5. Jujur — jika data pelatihan belum ada, sebutkan bahwa ini perlu dilengkapi
6. Panjang total narasi: 600–900 kata
7. Jika suatu kategori 0 atau kosong, tetap tulis narasi yang menjelaskan perlunya aktivitas tersebut
8. Cantumkan hasil observasi dan SKP jika tersedia

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
      "content": "narasi tentang latar belakang, tujuan laporan, dan gambaran umum kinerja..."
    },
    {
      "heading": "II. Perencanaan Kinerja (SKP)",
      "content": "narasi tentang rencana SKP tahunan, indikator yang menjadi fokus, dan target yang ditetapkan. Korelasikan dengan data evidence yang terkumpul..."
    },
    {
      "heading": "III. Pelaksanaan Pembelajaran",
      "content": "narasi 2-3 paragraf tentang konsistensi mengajar, kualitas perencanaan, pendekatan pembelajaran..."
    },
    {
      "heading": "IV. Penilaian dan Evaluasi Hasil Belajar",
      "content": "narasi tentang ragam asesmen, tindak lanjut remedial/pengayaan..."
    },
    {
      "heading": "V. Hasil Observasi Kinerja",
      "content": "narasi tentang hasil observasi oleh atasan/kepala sekolah, rating per indikator, catatan observer, dan suasana pembelajaran..."
    },
    {
      "heading": "VI. Pengembangan Diri dan Kompetensi Profesional",
      "content": "narasi tentang pelatihan yang diikuti, dampaknya, jam pengembangan..."
    },
    {
      "heading": "VII. Kolaborasi dan Komunikasi",
      "content": "narasi tentang komunikasi dengan orang tua siswa..."
    },
    {
      "heading": "VIII. Kesimpulan dan Rencana Tindak Lanjut",
      "content": "narasi capaian utama + 2-3 rencana perbaikan semester berikutnya berdasarkan hasil observasi..."
    }
  ],
  "ringkasan_singkat": "1-2 kalimat ringkasan untuk dashboard"
}
\`\`\`
`
}
