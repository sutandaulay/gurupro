/**
 * GET /api/institution/[institutionId]/aktivitas-guru
 * Rekap aktivitas guru dalam satu institusi (view Kepala Sekolah / Wakasek / Operator).
 * Menggabungkan jurnal mengajar + ringkasan kehadiran untuk bahan pengambilan keputusan.
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

function buildDateFilter(period: string, params: any[]): { sql: string; nextIdx: number } {
  const now = new Date()
  now.setHours(23, 59, 59, 999)
  let sql = ''
  let paramIdx = params.length + 1

  if (period === 'today') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    sql = `AND $${paramIdx}::date <= tj.tanggal AND tj.tanggal <= $${paramIdx + 1}::date`
    params.push(today.toISOString().split('T')[0], now.toISOString().split('T')[0])
  } else if (period === 'week') {
    const weekStart = new Date()
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    sql = `AND $${paramIdx}::date <= tj.tanggal AND tj.tanggal <= $${paramIdx + 1}::date`
    params.push(weekStart.toISOString().split('T')[0], now.toISOString().split('T')[0])
  } else if (period === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    sql = `AND $${paramIdx}::date <= tj.tanggal AND tj.tanggal <= $${paramIdx + 1}::date`
    params.push(monthStart.toISOString().split('T')[0], now.toISOString().split('T')[0])
  } else if (period === 'semester') {
    // Tahun ajaran aktif: Agustus - Desember (ganjil) atau Januari - Juli (genap)
    const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
    const semesterStart = new Date(year, 7, 1)
    sql = `AND $${paramIdx}::date <= tj.tanggal AND tj.tanggal <= $${paramIdx + 1}::date`
    params.push(semesterStart.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }

  return { sql, nextIdx: paramIdx + 2 }
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
    const pag = parsePagination(searchParams)
    const skip = offset(pag)

    // ── 1. Daftar guru aktif dalam institusi ──
    const guruParams: any[] = [instId]
    if (guruId) {
      guruParams.push(guruId)
    }
    const guruFilter = guruId ? `AND im.app_user_id = $${guruParams.length}` : ''
    const guruResult = await query(
      `SELECT im.app_user_id AS guru_id,
              u.nama_lengkap AS guru_nama,
              u.email AS guru_email,
              imr.value AS role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       LEFT JOIN users u ON u.id::text = im.app_user_id
       WHERE im.institution_id = $1 AND im.status = 'active' ${guruFilter}
       ORDER BY u.nama_lengkap`,
      guruParams
    )
    const gurus = guruResult.rows

    if (gurus.length === 0) {
      return NextResponse.json({
        gurus: [],
        pagination: { page: pag.page, limit: pag.limit, total: 0, totalPages: 0 },
      })
    }

    // ── 2. Statistik jurnal mengajar per guru ──
    const journalParams: any[] = [instId]
    const { sql: dateFilterJournal } = buildDateFilter(period, journalParams)
    if (guruId) journalParams.push(guruId)
    // teacher_journals.user_id is UUID, join via app_user_id (UUID text) through institution_members
    const guruFilterJournal = guruId ? ` AND tj.user_id = $${journalParams.length}` : ''
    const journalResult = await query(
      `SELECT tj.user_id AS guru_id,
              COUNT(*) AS total_jurnal,
              COUNT(*) FILTER (WHERE tj.status = 'Final') AS jurnal_final,
              COUNT(*) FILTER (WHERE tj.status IS NULL OR tj.status != 'Final') AS jurnal_draft,
              MAX(tj.tanggal) AS jurnal_terakhir
       FROM teacher_journals tj
       JOIN public.institution_members im ON im.app_user_id = tj.user_id::text
       WHERE im.institution_id = $1 AND im.status = 'active' ${dateFilterJournal} ${guruFilterJournal}
       GROUP BY tj.user_id`,
      journalParams
    )
    const journalMap = new Map<string, any>()
    journalResult.rows.forEach((r: any) => {
      journalMap.set(String(r.guru_id), {
        total_jurnal: parseInt(r.total_jurnal) || 0,
        jurnal_final: parseInt(r.jurnal_final) || 0,
        jurnal_draft: parseInt(r.jurnal_draft) || 0,
        jurnal_terakhir: r.jurnal_terakhir ? r.jurnal_terakhir.toISOString().split('T')[0] : null,
      })
    })

    // ── 3. Statistik kehadiran per guru (dari attendance_summary) ──
    const attParams: any[] = [instId]
    let attDateFilter = ''
    if (period === 'today' || period === 'week' || period === 'month' || period === 'semester') {
      const now = new Date()
      let startDate: Date
      if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (period === 'week') {
        startDate = new Date(now)
        startDate.setDate(now.getDate() - now.getDay())
      } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else {
        const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
        startDate = new Date(year, 7, 1)
      }
      attDateFilter = `AND asum.date >= $2::date AND asum.date <= $3::date`
      attParams.push(startDate, now)
    }
    if (guruId) attParams.push(guruId)
    const guruFilterAtt = guruId ? ` AND asum.teacher_id = $${attParams.length}` : ''
    const attResult = await query(
      `SELECT asum.teacher_id AS guru_id,
              COUNT(*) AS total_hari,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'hadir') AS hadir,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'telat') AS telat,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'sakit') AS sakit,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'izin') AS izin,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'alpa') AS alpa,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'cuti') AS cuti,
              COALESCE(SUM(asum.teaching_minutes_total), 0) AS total_menit,
              COALESCE(SUM(asum.teaching_sessions_completed), 0) AS total_sesi
       FROM attendance_summary asum
       WHERE asum.institution_id = $1 ${attDateFilter} ${guruFilterAtt}
       GROUP BY asum.teacher_id`,
      attParams
    )
    const attMap = new Map<string, any>()
    attResult.rows.forEach((r: any) => {
      attMap.set(String(r.guru_id), {
        total_hari: parseInt(r.total_hari) || 0,
        hadir: parseInt(r.hadir) || 0,
        telat: parseInt(r.telat) || 0,
        sakit: parseInt(r.sakit) || 0,
        izin: parseInt(r.izin) || 0,
        alpa: parseInt(r.alpa) || 0,
        cuti: parseInt(r.cuti) || 0,
        total_menit: parseInt(r.total_menit) || 0,
        total_sesi: parseInt(r.total_sesi) || 0,
      })
    })

    // ── 4. Gabungkan & urutkan berdasarkan aktivitas (skor) ──
    const rows = gurus.map((g: any) => {
      const j = journalMap.get(String(g.guru_id)) || {
        total_jurnal: 0, jurnal_final: 0, jurnal_draft: 0, jurnal_terakhir: null,
      }
      const a = attMap.get(String(g.guru_id)) || {
        total_hari: 0, hadir: 0, telat: 0, sakit: 0, izin: 0, alpa: 0, cuti: 0,
        total_menit: 0, total_sesi: 0,
      }
      const score = (j.total_jurnal * 2) + (j.jurnal_final * 1) + (a.total_sesi * 1) + (a.hadir * 2) + (a.telat * 1)
      return {
        guru_id: g.guru_id,
        guru_nama: g.guru_nama || '-',
        guru_email: g.guru_email || null,
        role: g.role || 'guru',
        ...j,
        ...a,
        skor: score,
      }
    })
    rows.sort((a: any, b: any) => b.skor - a.skor)

    // ── 5. Pagination ──
    const total = rows.length
    const totalPages = Math.ceil(total / pag.limit)
    const pagedRows = rows.slice(skip, skip + pag.limit)

    return NextResponse.json({
      gurus: pagedRows,
      pagination: {
        page: pag.page,
        limit: pag.limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('[institution/aktivitas-guru] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
