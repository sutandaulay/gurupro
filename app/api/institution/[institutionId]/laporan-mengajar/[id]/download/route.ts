/**
 * GET /api/institution/[institutionId]/laporan-mengajar/[id]/download?format=pdf|docx
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { canViewAllTeachers } from '@/lib/rbac/institution-permissions'
import { generatePdfBuffer, generateDocBuffer } from '@/lib/doc-compiler'

async function checkPermission(institutionId: number): Promise<NextResponse | null> {
  try {
    const session = await requireSession()
    const allowed = await canViewAllTeachers(session.id, institutionId)
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return null
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

function buildReportMarkdown(report: any): string {
  const lines: string[] = []
  lines.push(`# LAPORAN MENGAJAR`)
  lines.push(``)
  lines.push(`| **Tanggal** | ${report.tanggal} |`)
  lines.push(`| **Guru** | ${report.guru_nama || '-'} |`)
  lines.push(`| **Kelas** | ${report.kelas} |`)
  lines.push(`| **Mata Pelajaran** | ${report.mapel} |`)
  lines.push(`| **Sekolah** | ${report.sekolah || '-'} |`)
  if (report.attendance_summary) {
    const a = report.attendance_summary
    lines.push(`| **Kehadiran** | Hadir: ${a.hadir || 0}, Izin: ${a.izin || 0}, Sakit: ${a.sakit || 0}, Alpha: ${a.alpha || 0} |`)
  }
  lines.push(``)
  if (report.materi_pembelajaran) { lines.push(`## Materi Pembelajaran`); lines.push(report.materi_pembelajaran); lines.push(``) }
  if (report.tujuan_pembelajaran) { lines.push(`## Tujuan Pembelajaran`); lines.push(report.tujuan_pembelajaran); lines.push(``) }
  if (report.aktivitas_pembelajaran) { lines.push(`## Aktivitas Pembelajaran`); lines.push(report.aktivitas_pembelajaran); lines.push(``) }
  if (report.media_pembelajaran) { lines.push(`## Media Pembelajaran`); lines.push(report.media_pembelajaran); lines.push(``) }
  if (report.asesmen_pembelajaran) { lines.push(`## Asesmen Pembelajaran`); lines.push(report.asesmen_pembelajaran); lines.push(``) }
  if (report.refleksi_guru) { lines.push(`## Refleksi Guru`); lines.push(report.refleksi_guru); lines.push(``) }
  if (report.tindak_lanjut) { lines.push(`## Tindak Lanjut`); lines.push(report.tindak_lanjut); lines.push(``) }
  return lines.join('\n')
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ institutionId: string; id: string }> }
) {
  const { institutionId, id } = await context.params
  const instId = parseInt(institutionId, 10)
  if (isNaN(instId)) {
    return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 })
  }

  const permError = await checkPermission(instId)
  if (permError) return permError

  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'pdf'

    const journalResult = await query(
      `SELECT tj.*, u.nama_lengkap as guru_nama,
              c.nama_kelas as kelas, s.nama_mapel as mapel,
              sch.nama_sekolah as sekolah
       FROM teacher_journals tj
       JOIN institution_members im ON im.user_id = tj.user_id AND im.status = 'active'
       JOIN users u ON u.id = tj.user_id
       JOIN classes c ON c.id = tj.class_id
       JOIN subjects s ON s.id = tj.subject_id
       LEFT JOIN schools sch ON sch.id = tj.school_id
       WHERE im.institution_id = $1 AND tj.id = $2`,
      [instId, id]
    )

    if (journalResult.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const row = journalResult.rows[0]

    const sessionResult = await query(
      `SELECT attendance_data FROM teaching_sessions
       WHERE user_id = $1 AND class_id = $2 AND subject_id = $3 AND session_date = $4 LIMIT 1`,
      [row.user_id, row.class_id, row.subject_id, row.tanggal]
    )

    let attendance_summary = null
    if (sessionResult.rows.length > 0 && sessionResult.rows[0].attendance_data) {
      try {
        attendance_summary = typeof sessionResult.rows[0].attendance_data === 'string'
          ? JSON.parse(sessionResult.rows[0].attendance_data)
          : sessionResult.rows[0].attendance_data
      } catch {}
    }

    const reportData = {
      tanggal: row.tanggal?.toISOString().split('T')[0] || '',
      guru_nama: row.guru_nama || '-',
      kelas: row.kelas || '-',
      mapel: row.mapel || '-',
      sekolah: row.sekolah || '-',
      attendance_summary,
      materi_pembelajaran: row.materi_pembelajaran,
      tujuan_pembelajaran: row.tujuan_pembelajaran,
      aktivitas_pembelajaran: row.aktivitas_pembelajaran,
      media_pembelajaran: row.media_pembelajaran,
      asesmen_pembelajaran: row.asesmen_pembelajaran,
      refleksi_guru: row.refleksi_guru,
      tindak_lanjut: row.tindak_lanjut,
    }

    const markdown = buildReportMarkdown(reportData)
    const title = `Laporan Mengajar - ${reportData.guru_nama} - ${reportData.kelas}`

    if (format === 'docx') {
      const buf = generateDocBuffer(markdown, title)
      return new Response(buf, {
        headers: {
          'Content-Type': 'application/msword',
          'Content-Disposition': `attachment; filename="Laporan-Mengajar-${reportData.tanggal}.doc"`,
        },
      })
    }

    const buf = await generatePdfBuffer(markdown, title)
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Laporan-Mengajar-${reportData.tanggal}.pdf"`,
      },
    })
  } catch (error) {
    console.error('[institution/laporan-mengajar/[id]/download] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
