/**
 * API Route: /api/evidence/summary
 * Get evidence summary for dashboard
 * Auto-detects active tahun ajaran if not provided
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
    const guruId = sessionData.id

    const { searchParams } = new URL(req.url)
    let tahunAjaranId = searchParams.get('tahun_ajaran_id')
    let semester = searchParams.get('semester') as 'ganjil' | 'genap' | null
    const sekolahId = searchParams.get('sekolah_id')

    // Auto-detect if not provided
    if (!tahunAjaranId || !semester) {
      const aktifResult = await query(
        `SELECT id FROM tahun_ajaran WHERE is_active = true LIMIT 1`
      )

      if (aktifResult.rows.length > 0) {
        tahunAjaranId = aktifResult.rows[0].id
        // Determine semester from current date
        const now = new Date()
        semester = now.getMonth() + 1 >= 7 ? 'ganjil' : 'genap'
      } else {
        // Fallback: use the most recent tahun ajaran
        const recentResult = await query(
          `SELECT id FROM tahun_ajaran ORDER BY tanggal_mulai DESC LIMIT 1`
        )
        if (recentResult.rows.length > 0) {
          tahunAjaranId = recentResult.rows[0].id
          const now = new Date()
          semester = now.getMonth() + 1 >= 7 ? 'ganjil' : 'genap'
        } else {
          return NextResponse.json({
            stat_cards: {
              total_pembelajaran: 0,
              total_modul_ajar: 0,
              total_penilaian: 0,
              total_remedial: 0,
              total_pelatihan: 0,
              total_jam_pelatihan: 0,
              total_komunikasi_ortu: 0,
              total_refleksi: 0,
              total_journal: 0,
              pelatihan_belum_sertifikat: 0,
            },
            indikator_score: [],
            pelatihan: [],
            missing_evidence: [],
            siap_laporan: true,
            info: 'Buat dan aktifkan tahun ajaran di Pengaturan → Tahun Ajaran',
          })
        }
      }
    }

    const evParams: any[] = [guruId, tahunAjaranId, semester]
    let evFilter = `guru_id = $1 AND tahun_ajaran_id = $2 AND semester = $3`
    if (sekolahId) {
      evFilter += ` AND sekolah_id = $4`
      evParams.push(sekolahId)
    }

    // 1. Get evidence count by category
    const perKategori = await query(
      `SELECT kategori, COUNT(*) as jumlah
       FROM evidence_log
       WHERE ${evFilter}
       GROUP BY kategori`,
      evParams
    )

    // 2. Get all evidence for indikator calculation
    const semuaEvidence = await query(
      `SELECT indikator_kinerja, bobot_evidence
       FROM evidence_log
       WHERE ${evFilter}`,
      evParams
    )

    // 3. Get indikator konfigurasi
    const indikatorList = await query(
      `SELECT kode, nama, komponen, bobot_persen, min_evidence
       FROM indikator_kinerja_config
       WHERE is_active = true
       ORDER BY kode`
    )

    // 4. Calculate score per indikator
    const indikatorScore = indikatorList.rows.map((ik: any) => {
      const evidenceUntukIK = semuaEvidence.rows.filter((e: any) =>
        e.indikator_kinerja && e.indikator_kinerja.includes(ik.kode)
      )
      const totalBobot = evidenceUntukIK.reduce((sum: number, e: any) => sum + e.bobot_evidence, 0)
      const targetBobot = ik.min_evidence * 3
      const persen = Math.min(100, Math.round((totalBobot / targetBobot) * 100))

      return {
        kode: ik.kode,
        nama: ik.nama,
        komponen: ik.komponen,
        persen,
        status: persen >= 85 ? 'ok' : persen >= 60 ? 'warning' : 'critical',
        jumlah_evidence: evidenceUntukIK.length,
        min_evidence: ik.min_evidence,
      }
    })

    const pelParams: any[] = [guruId, tahunAjaranId, semester]
    let pelFilter = `guru_id = $1 AND tahun_ajaran_id = $2 AND semester = $3`
    if (sekolahId) {
      pelFilter += ` AND sekolah_id = $4`
      pelParams.push(sekolahId)
    }

    // 5. Get pelatihan data
    const pelatihanList = await query(
      `SELECT id, nama_pelatihan, penyelenggara, jenis, lingkup,
              durasi_jam, tanggal_mulai, status_verifikasi, file_sertifikat_url
       FROM pelatihan_guru
       WHERE ${pelFilter}
       ORDER BY tanggal_mulai DESC`,
      pelParams
    )

    const totalJamPelatihan = pelatihanList.rows.reduce((s: number, p: any) => s + p.durasi_jam, 0)
    const pelatihanBelumSertifikat = pelatihanList.rows.filter(
      (p: any) => p.status_verifikasi === 'belum_upload'
    ).length

    const jrnParams: any[] = [guruId]
    let jrnFilter = `teacher_id = $1`
    if (sekolahId) {
      jrnFilter += ` AND school_id = $2`
      jrnParams.push(sekolahId)
    }

    // 6. Get journal count
    const journalStats = await query(
      `SELECT COUNT(*) as total_journal
       FROM teacher_journals
       WHERE ${jrnFilter}`,
      jrnParams
    )

    // 7. Stat cards
    const statCards = {
      total_pembelajaran: parseInt(
        perKategori.rows.find((k: any) => k.kategori === 'pelaksanaan')?.jumlah || '0'
      ),
      total_modul_ajar: parseInt(
        perKategori.rows.find((k: any) => k.kategori === 'perencanaan')?.jumlah || '0'
      ),
      total_penilaian: parseInt(
        perKategori.rows.find((k: any) => k.kategori === 'penilaian')?.jumlah || '0'
      ),
      total_remedial: parseInt(
        perKategori.rows.find((k: any) => k.kategori === 'tindak_lanjut')?.jumlah || '0'
      ),
      total_pelatihan: pelatihanList.rows.length,
      total_jam_pelatihan: totalJamPelatihan,
      total_komunikasi_ortu: parseInt(
        perKategori.rows.find((k: any) => k.kategori === 'kolaborasi_ortu')?.jumlah || '0'
      ),
      total_refleksi: parseInt(
        perKategori.rows.find((k: any) => k.kategori === 'refleksi')?.jumlah || '0'
      ),
      total_journal: parseInt(journalStats.rows[0]?.total_journal || '0'),
      pelatihan_belum_sertifikat: pelatihanBelumSertifikat,
    }

    // 8. Missing evidence detection
    const missingEvidence: any[] = []
    indikatorScore
      .filter((ik: any) => ik.status === 'critical')
      .forEach((ik: any) => {
        if (ik.jumlah_evidence < ik.min_evidence) {
          missingEvidence.push({
            jenis: ik.kode,
            deskripsi: `${ik.nama} - minimal ${ik.min_evidence} evidence, saat ini ${ik.jumlah_evidence}`,
            action_label: 'Lengkapi',
            action_url: getActionUrl(ik.kode),
            urgensi: ik.persen === 0 ? 'tinggi' : 'sedang',
          })
        }
      })

    if (pelatihanBelumSertifikat > 0) {
      missingEvidence.push({
        jenis: 'sertifikat',
        deskripsi: `${pelatihanBelumSertifikat} pelatihan belum upload sertifikat`,
        action_label: 'Upload Sertifikat',
        action_url: '/dashboard/pengembangan-diri',
        urgensi: 'sedang',
      })
    }

    return NextResponse.json({
      stat_cards: statCards,
      indikator_score: indikatorScore,
      pelatihan: pelatihanList.rows,
      missing_evidence: missingEvidence,
      siap_laporan: indikatorScore.every((i: any) => i.status !== 'critical'),
      tahun_ajaran_id: tahunAjaranId,
      semester,
    })
  } catch (err) {
    console.error('GET /api/evidence/summary error:', err)
    return NextResponse.json({ error: 'Failed to fetch evidence summary' }, { status: 500 })
  }
}

function getActionUrl(kode: string): string {
  const urlMap: Record<string, string> = {
    'IK-01': '/dashboard/administrasi',
    'IK-02': '/dashboard/administrasi',
    'IK-03': '/dashboard/jurnal',
    'IK-04': '/dashboard/jurnal',
    'IK-05': '/dashboard/nilai',
    'IK-06': '/dashboard/nilai',
    'IK-07': '/dashboard/nilai',
    'IK-08': '/dashboard/jurnal',
    'IK-09': '/dashboard/ai-chat',
    'IK-10': '/dashboard/pengembangan-diri',
    'IK-11': '/dashboard/pengembangan-diri',
    'IK-12': '/dashboard/pengembangan-diri',
  }
  return urlMap[kode] || '/dashboard'
}
