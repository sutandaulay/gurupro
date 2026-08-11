import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';

// =====================================================
// Endpoint Poin untuk Dashboard KS
// Menampilkan sisa Poin institusi + breakdown per fitur
// Kategori sensitif — ini hanya display, bukan hitung.
// =====================================================

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const institutionId = url.searchParams.get('institutionId');

    if (!institutionId) {
      return NextResponse.json({ error: 'institutionId wajib' }, { status: 400 });
    }

    const instId = parseInt(institutionId, 10);

    // RBAC: hanya kepala_sekolah / bendahara / operator / admin
    const memberRes = await query(
      `SELECT imr.value AS role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
         AND imr.value IN ('kepala_sekolah','bendahara','operator','admin_sekolah')`,
      [session.id, instId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cek apakah poin_transactions ada
    const tableCheck = await query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'poin_transactions') as exists`
    );

    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json({
        available: false,
        message: 'Tabel poin_transactions belum tersedia',
        breakdown: [],
      });
    }

    // Ambil semua transaksi Poin institution-wide (60 hari terakhir), scop per member
    const since = new Date();
    since.setDate(since.getDate() - 60);

    const txRes = await query(
      `SELECT pt.feature, pt.poin_deducted, pt.created_at, u.nama_lengkap AS guru_nama
       FROM poin_transactions pt
       JOIN public.institution_members im ON im.app_user_id = pt.user_id::text
       JOIN users u ON u.id::text = pt.user_id::text
       WHERE im.institution_id = $1 AND im.status = 'active'
         AND pt.created_at >= $2
         AND coalesce(pt.success, true) = true
       ORDER BY pt.created_at DESC
       LIMIT 200`,
      [instId, since.toISOString()]
    );

    // Aggregate per fitur
    const fiturMap: Record<string, { total: number; count: number; recent: { guru: string; jumlah: number; tanggal: string }[] }> = {};
    for (const row of txRes.rows) {
      const fitur = row.feature || 'lainnya';
      const jumlah = Math.abs(Number(row.poin_deducted || 0));
      if (jumlah <= 0) continue;
      if (!fiturMap[fitur]) fiturMap[fitur] = { total: 0, count: 0, recent: [] };
      fiturMap[fitur].total += jumlah;
      fiturMap[fitur].count++;
      if (fiturMap[fitur].recent.length < 3) {
        fiturMap[fitur].recent.push({
          guru: row.guru_nama || 'Sistem',
          jumlah,
          tanggal: (row.created_at instanceof Date ? row.created_at : new Date(row.created_at))
            .toISOString().split('T')[0] || '',
        });
      }
    }

    const fiturLabel: Record<string, string> = {
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
      'lainnya': 'Lainnya',
    };

    const breakdown = Object.entries(fiturMap)
      .map(([fitur, data]) => ({
        fitur,
        label: fiturLabel[fitur] || fitur,
        totalPoin: data.total,
        totalTransaksi: data.count,
        rataPerTransaksi: data.count > 0 ? Math.round(data.total / data.count * 100) / 100 : 0,
        recent: data.recent,
      }))
      .sort((a, b) => b.totalPoin - a.totalPoin);

    // Total 60 hari
    const totalPoin60Hari = breakdown.reduce((s, b) => s + b.totalPoin, 0);
    const totalTx60Hari = breakdown.reduce((s, b) => s + b.totalTransaksi, 0);

    // Proyeksi: hitung rata-rata per hari
    const daysUsed = 60;
    const avgPerHari = totalPoin60Hari / daysUsed;

    // Ambil saldo terakhir dari aggregasi saldo guru aktif
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
    );
    const saldo =
      Number(balanceRes.rows[0]?.main_remaining || 0) +
      Number(balanceRes.rows[0]?.addon_remaining || 0);

    return NextResponse.json({
      available: true,
      institutionId: instId,
      periodeHari: daysUsed,
      totalPoinDigunakan: totalPoin60Hari,
      totalTransaksi: totalTx60Hari,
      rataPerHari: Math.round(avgPerHari * 100) / 100,
      saldo,
      breakdown,
      // Proyeksi habis
      proyekiHariHabis: avgPerHari > 0 ? Math.round(saldo / avgPerHari) : null,
    });
  } catch (error: any) {
    console.error('[KS Poin] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
