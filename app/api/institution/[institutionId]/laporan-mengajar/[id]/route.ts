/**
 * GET /api/institution/[institutionId]/laporan-mengajar/[id]
 * Detail of one teaching report (kepala/wakasek view)
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { canViewAllTeachers } from '@/lib/rbac/institution-permissions'

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

export async function GET(
  _request: NextRequest,
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
    const journalResult = await query(
      `SELECT tj.*, u.nama_lengkap as guru_nama,
              c.id as class_id, c.nama_kelas as kelas_nama,
              s.id as subject_id, s.nama_mapel as mapel_nama,
              sch.id as school_id, sch.nama_sekolah as sekolah_nama,
              im.user_id as guru_user_id
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
       WHERE user_id = $1 AND class_id = $2 AND subject_id = $3 AND session_date = $4
       LIMIT 1`,
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

    const customValues = typeof row.custom_values === 'string'
      ? JSON.parse(row.custom_values)
      : (row.custom_values || {})

    return NextResponse.json({
      id: row.id,
      tanggal: row.tanggal?.toISOString().split('T')[0] || '',
      guru_id: row.user_id,
      guru_nama: row.guru_nama || '-',
      kelas: { id: row.class_id, nama: row.kelas_nama || '-' },
      mapel: { id: row.subject_id, nama: row.mapel_nama || '-' },
      sekolah: { id: row.school_id, nama: row.sekolah_nama || '-' },
      materi_pembelajaran: row.materi_pembelajaran,
      tujuan_pembelajaran: row.tujuan_pembelajaran,
      aktivitas_pembelajaran: row.aktivitas_pembelajaran,
      media_pembelajaran: row.media_pembelajaran,
      asesmen_pembelajaran: row.asesmen_pembelajaran,
      refleksi_guru: row.refleksi_guru,
      tindak_lanjut: row.tindak_lanjut,
      status: row.status,
      attendance_summary,
      pdf_url: customValues.pdf_url || null,
      docx_url: customValues.docx_url || null,
    })
  } catch (error) {
    console.error('[institution/laporan-mengajar/[id]] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
