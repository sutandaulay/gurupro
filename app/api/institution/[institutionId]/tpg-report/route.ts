/**
 * GET /api/institution/[institutionId]/tpg-report
 * Rekap TPG seluruh guru di satu institusi untuk Kepala Sekolah.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { canViewAllTeachers } from '@/lib/rbac/institution-permissions'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ institutionId: string }> }
) {
  const { institutionId } = await context.params
  const instId = parseInt(institutionId, 10)
  if (isNaN(instId)) {
    return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 })
  }

  try {
    const session = await requireSession()
    const allowed = await canViewAllTeachers(session.id, instId)
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const periodType = searchParams.get('periodType') || 'month'

    // Determine date range
    const now = new Date()
    let startDate: Date
    let endDate: Date
    let periodLabel: string

    if (periodType === 'weekly') {
      startDate = startOfWeek(now, { weekStartsOn: 1 })
      endDate = endOfWeek(now, { weekStartsOn: 1 })
      periodLabel = `Minggu ${format(startDate, 'dd MMM')} - ${format(endDate, 'dd MMM yyyy')}`
    } else if (periodType === 'semester') {
      // Semester: Aug - Dec (ganjil) or Jan - Jul (genap)
      const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
      const semesterStart = new Date(year, now.getMonth() >= 6 ? 7 : 0, 1)
      startDate = semesterStart
      endDate = now
      periodLabel = `Semester ${now.getMonth() >= 6 ? 'Ganjil' : 'Genap'} ${year}/${year + 1}`
    } else {
      // Default: month
      startDate = startOfMonth(now)
      endDate = endOfMonth(now)
      periodLabel = format(now, 'MMMM yyyy')
    }

    const startStr = format(startDate, 'yyyy-MM-dd')
    const endStr = format(endDate, 'yyyy-MM-dd')

    // Get institution name
    const instRes = await query(
      'SELECT name FROM institutions WHERE id = $1',
      [instId]
    )
    const institutionName = instRes.rows[0]?.name || `Institusi ${instId}`

    const guruRes = await query(
      `SELECT im.app_user_id AS guru_uuid,
              u.nama_lengkap AS guru_nama,
              u.email AS guru_email,
              imr.value AS role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       LEFT JOIN users u ON u.id::text = im.app_user_id
       WHERE im.institution_id = $1 AND im.status = 'active'
       ORDER BY u.nama_lengkap`,
      [instId]
    )
    const gurus = guruRes.rows

    if (gurus.length === 0) {
      return NextResponse.json({
        institutionName,
        period: periodLabel,
        startDate: startStr,
        endDate: endStr,
        teachers: [],
        summary: {
          totalTeachers: 0,
          totalMinutes: 0,
          requirementMet: 0,
          requirementNotMet: 0,
          avgMinutes: 0,
          requiredMinutesPerPeriod: periodType === 'weekly' ? 1440 : periodType === 'semester' ? 1440 * 24 : 1440 * 4,
        },
      })
    }

    const guruUuids = gurus.map((g: any) => g.guru_uuid).filter(Boolean)
    const attRes = await query(
      `SELECT asum.teacher_id::text AS guru_uuid,
              COUNT(*) AS total_hari,
              COUNT(*) FILTER (WHERE asum.attendance_status IN ('hadir', 'telat')) AS hari_efektif,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'hadir') AS hadir,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'telat') AS telat,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'sakit') AS sakit,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'izin') AS izin,
              COUNT(*) FILTER (WHERE asum.attendance_status = 'alpa') AS alpa,
              COALESCE(SUM(asum.teaching_minutes_total), 0)::int AS total_menit,
              COALESCE(SUM(asum.teaching_sessions_completed), 0)::int AS total_sesi
       FROM attendance_summary asum
       WHERE asum.institution_id = $1
         AND asum.date >= $2::date
         AND asum.date <= $3::date
         AND asum.teacher_id::text = ANY($4)
       GROUP BY asum.teacher_id::text`,
      [instId, startStr, endStr, guruUuids]
    )

    const attMap = new Map<string, any>()
    attRes.rows.forEach((r: any) => {
      attMap.set(r.guru_uuid, {
        total_hari: parseInt(r.total_hari) || 0,
        hari_efektif: parseInt(r.hari_efektif) || 0,
        hadir: parseInt(r.hadir) || 0,
        telat: parseInt(r.telat) || 0,
        sakit: parseInt(r.sakit) || 0,
        izin: parseInt(r.izin) || 0,
        alpa: parseInt(r.alpa) || 0,
        total_menit: parseInt(r.total_menit) || 0,
        total_sesi: parseInt(r.total_sesi) || 0,
      })
    })

    // Required minutes: for monthly = 24jp (1440 min), for weekly = 24jp (1440 min)
    // In practice, monthly requirement = 4 weeks × 24jp = 5760 min per bulan
    // Weekly requirement = 24jp per minggu
    const weeklyRequired = 1440
    const periodRequired = periodType === 'weekly'
      ? weeklyRequired
      : periodType === 'semester'
        ? weeklyRequired * 24  // approx 24 weeks
        : weeklyRequired * 4   // approx 4 weeks per bulan

    const teachers = gurus.map((g: any) => {
      const att = attMap.get(g.guru_uuid) || {
        total_hari: 0, hari_efektif: 0, hadir: 0, telat: 0,
        sakit: 0, izin: 0, alpa: 0, total_menit: 0, total_sesi: 0,
      }

      const meetsRequirement = att.total_menit >= periodRequired
      const deficit = Math.max(0, periodRequired - att.total_menit)
      const percentage = periodRequired > 0
        ? Math.min(100, Math.round((att.total_menit / periodRequired) * 100))
        : 0

      return {
        guru_id: g.guru_uuid,
        guru_nama: g.guru_nama || '-',
        guru_email: g.guru_email || null,
        role: g.role || 'guru',
        ...att,
        period_required: periodRequired,
        meets_requirement: meetsRequirement,
        deficit,
        percentage,
      }
    })

    const totalMinutes = teachers.reduce((s: number, t: any) => s + t.total_menit, 0)
    const totalRequired = teachers.length * periodRequired
    const requirementMet = teachers.filter((t: any) => t.meets_requirement).length
    const avgMinutes = teachers.length > 0 ? Math.round(totalMinutes / teachers.length) : 0

    return NextResponse.json({
      institutionName,
      period: periodLabel,
      startDate: startStr,
      endDate: endStr,
      teachers,
      summary: {
        totalTeachers: teachers.length,
        totalMinutes,
        totalRequired,
        requirementMet,
        requirementNotMet: teachers.length - requirementMet,
        avgMinutes,
        requiredMinutesPerPeriod: periodRequired,
      },
    })
  } catch (error) {
    console.error('[institution/tpg-report] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
