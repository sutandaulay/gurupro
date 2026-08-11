/**
 * GET /api/institution/[institutionId]/laporan-mengajar
 * List teaching reports for all teachers in an institution (kepala/wakasek view)
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { canViewAllTeachers } from '@/lib/rbac/institution-permissions'
import { parsePagination, offset } from '@/lib/pagination'

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
  request: NextRequest,
  context: { params: Promise<{ institutionId: string }> }
) {
  const { institutionId } = await context.params
  const instId = parseInt(institutionId, 10)
  if (isNaN(instId)) {
    return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 })
  }

  const permError = await checkPermission(instId)
  if (permError) return permError

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const guruId = searchParams.get('guru_id')
    const kelas = searchParams.get('kelas')
    const pag = parsePagination(searchParams)
    const skip = offset(pag)

    // Build date filter
    const now = new Date()
    now.setHours(23, 59, 59, 999)
    let dateFilter = ''
    const params: any[] = [instId]
    let paramIdx = 2

    if (period === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      dateFilter = `AND tj.tanggal >= $${paramIdx} AND tj.tanggal <= $${paramIdx + 1}`
      params.push(today, now)
      paramIdx += 2
    } else if (period === 'week') {
      const weekStart = new Date()
      weekStart.setDate(now.getDate() - now.getDay())
      weekStart.setHours(0, 0, 0, 0)
      dateFilter = `AND tj.tanggal >= $${paramIdx} AND tj.tanggal <= $${paramIdx + 1}`
      params.push(weekStart, now)
      paramIdx += 2
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      monthStart.setHours(0, 0, 0, 0)
      dateFilter = `AND tj.tanggal >= $${paramIdx} AND tj.tanggal <= $${paramIdx + 1}`
      params.push(monthStart, now)
      paramIdx += 2
    }

    if (guruId) {
      dateFilter += ` AND tj.user_id = $${paramIdx}`
      params.push(guruId)
      paramIdx++
    }

    if (kelas) {
      dateFilter += ` AND c.nama_kelas ILIKE $${paramIdx}`
      params.push(`%${kelas}%`)
      paramIdx++
    }

    const countParams = [instId, ...params.slice(1)]
    const countResult = await query(
      `SELECT COUNT(*) FROM teacher_journals tj
       JOIN public.institution_members im ON im.app_user_id = tj.user_id::text AND im.status = 'active'
       JOIN classes c ON c.id = tj.class_id
       WHERE im.institution_id = $1 ${dateFilter}`,
      params
    )
    const total = parseInt(countResult.rows[0].count) || 0

    const dataParams = [...params, skip, pag.limit]
    const dataResult = await query(
      `SELECT tj.id, tj.tanggal, tj.materi_pembelajaran, tj.status,
              u.nama_lengkap as guru_nama,
              c.nama_kelas as kelas,
              s.nama_mapel as mapel,
              sch.nama_sekolah as sekolah,
              tj.custom_values
       FROM teacher_journals tj
       JOIN public.institution_members im ON im.app_user_id = tj.user_id::text AND im.status = 'active'
       JOIN users u ON u.id::text = tj.user_id::text
       JOIN classes c ON c.id = tj.class_id
       JOIN subjects s ON s.id = tj.subject_id
       LEFT JOIN schools sch ON sch.id = tj.school_id
       WHERE im.institution_id = $1 ${dateFilter}
       ORDER BY tj.tanggal DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      dataParams
    )

    const reports = dataResult.rows.map(row => {
      const customValues = typeof row.custom_values === 'string'
        ? JSON.parse(row.custom_values)
        : (row.custom_values || {})
      return {
        id: row.id,
        tanggal: row.tanggal?.toISOString().split('T')[0] || '',
        guru_nama: row.guru_nama || '-',
        kelas: row.kelas || '-',
        mapel: row.mapel || '-',
        sekolah: row.sekolah || '-',
        materi: row.materi_pembelajaran?.substring(0, 100),
        status: row.status,
        pdf_url: customValues.pdf_url || null,
        docx_url: customValues.docx_url || null,
      }
    })

    return NextResponse.json({
      reports,
      pagination: {
        page: pag.page,
        limit: pag.limit,
        total,
        totalPages: Math.ceil(total / pag.limit),
      },
    })
  } catch (error) {
    console.error('[institution/laporan-mengajar] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
