import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { query } from '@/lib/db'

// =====================================================
// Bendahara Dashboard API
// - Saldo Poin institusi (aggregasi saldo guru aktif)
// - Riwayat transaksi berbasis poin_transactions
// - Breakdown per fitur + proyeksi habis + export CSV
// =====================================================

const FITUR_LABEL: Record<string, string> = {
  'raport-ai': 'Raport AI',
  'raport-deskripsi': 'Deskripsi Capaian',
  'voice-briefing': 'Voice Briefing',
  'silabus-generate': 'Generate Silabus',
  'atp-generate': 'Generate ATP',
  'soal-generate': 'Generate Soal',
  'lkpd-generate': 'Generate LKPD',
  'bahan-ajar-generate': 'Generate Bahan Ajar',
  'journal-ai': 'Jurnal AI',
  'attendance-insight': 'Insight Kehadiran',
}

export async function GET(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession()
    const { institutionId } = await context.params
    const instId = parseInt(institutionId, 10)
    if (isNaN(instId)) {
      return NextResponse.json({ error: 'Invalid institutionId' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const export_ = searchParams.get('export') === 'csv'

    // RBAC
    const memberRes = await query(
      `SELECT imr.value AS role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
         AND imr.value IN ('bendahara','kepala_sekolah','operator','admin_sekolah')`,
      [session.id, instId]
    )
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Saldo: aggregasi saldo Poin semua guru aktif ──
    const balanceRes = await query(
      `SELECT
         COALESCE(SUM(COALESCE(u.quota_poin_total,0) - COALESCE(u.quota_poin_used,0)), 0) AS main_remaining,
         COALESCE(SUM(COALESCE(u.addon_poin,0) - COALESCE(u.addon_poin_used,0)), 0) AS addon_remaining
       FROM public.institution_members im
       JOIN users u ON u.id::text = im.app_user_id
       WHERE im.institution_id = $1 AND im.status = 'active'
         AND EXISTS (SELECT 1 FROM public.institution_members_role imr
                     WHERE imr.parent_id = im.id AND imr.value = 'guru')`,
      [instId]
    )
    const mainRemaining = Number(balanceRes.rows[0]?.main_remaining || 0)
    const addonRemaining = Number(balanceRes.rows[0]?.addon_remaining || 0)
    const saldo = mainRemaining + addonRemaining

    // ── Transaksi 90 hari terakhir (scoped per institusi via member) ──
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const sinceIso = since.toISOString()

    const txRes = await query(
      `SELECT pt.id, pt.feature, pt.poin_deducted, pt.created_at, pt.success,
              u.nama_lengkap AS guru_nama
       FROM poin_transactions pt
       JOIN public.institution_members im ON im.app_user_id = pt.user_id::text
       JOIN users u ON u.id::text = pt.user_id::text
       WHERE im.institution_id = $1 AND im.status = 'active'
         AND pt.created_at >= $2
         AND coalesce(pt.success, true) = true
       ORDER BY pt.created_at DESC
       LIMIT 1000`,
      [instId, sinceIso]
    )

    const fiturMap: Record<string, { total: number; count: number; details: { guru: string; jumlah: number; tanggal: string }[] }> = {}
    const allTx: { id: string; feature: string; label: string; guru: string; jumlah: number; tanggal: string }[] = []

    for (const row of txRes.rows as any[]) {
      const fitur = row.feature || 'lainnya'
      const jumlah = Math.abs(Number(row.poin_deducted || 0))
      if (jumlah <= 0) continue
      const tanggal = (row.created_at instanceof Date ? row.created_at : new Date(row.created_at))
        .toISOString().split('T')[0]
      const guru = row.guru_nama || 'Sistem'
      const label = FITUR_LABEL[fitur] || fitur

      allTx.push({ id: String(row.id), feature: fitur, label, guru, jumlah, tanggal })

      if (!fiturMap[fitur]) fiturMap[fitur] = { total: 0, count: 0, details: [] }
      fiturMap[fitur].total += jumlah
      fiturMap[fitur].count++
      if (fiturMap[fitur].details.length < 5) {
        fiturMap[fitur].details.push({ guru, jumlah, tanggal })
      }
    }

    const breakdown = Object.entries(fiturMap)
      .map(([fitur, data]) => ({
        fitur,
        label: FITUR_LABEL[fitur] || fitur,
        totalPoin: data.total,
        totalTransaksi: data.count,
        details: data.details,
      }))
      .sort((a, b) => b.totalPoin - a.totalPoin)

    const totalPoin = breakdown.reduce((s, b) => s + b.totalPoin, 0)
    const totalTx = breakdown.reduce((s, b) => s + b.totalTransaksi, 0)

    // ── Proyeksi habis Poin (rata-rata per hari dari 90 hari) ──
    const daysUsed = 90
    const avgPerHari = totalPoin / daysUsed
    const hariHabis = saldo > 0 && avgPerHari > 0 ? Math.floor(saldo / avgPerHari) : null

    // ── Export CSV ──
    if (export_) {
      const csvHeader = 'Tanggal,Fitur,Guru,Jumlah Poin\n'
      const csvRows = allTx.map((t) =>
        `${t.tanggal},"${t.label}","${t.guru}",${t.jumlah}`
      ).join('\n')
      const csv = csvHeader + csvRows
      return new NextResponse('\ufeff' + csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="poin-laporan-${instId}.csv"`,
        },
      })
    }

    return NextResponse.json({
      available: true,
      institutionId: instId,
      saldo,
      mainRemaining,
      addonRemaining,
      totalPoin,
      totalTransaksi: totalTx,
      breakdown,
      recentTransactions: allTx.slice(0, 50),
      proyeksiHariHabis: hariHabis,
      rataPerHari: Math.round(avgPerHari * 100) / 100,
    })
  } catch (err) {
    console.error('GET /api/institution/bendahara error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}