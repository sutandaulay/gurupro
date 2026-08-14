import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import {
  getGuruList,
  toNamaMap,
  getStrukturStaf,
  getGuruTelat3x,
  getGuruBelumTerassign,
  getRaportStats,
  getRaportMendekatiDeadline,
  getKehadiranGuruHariIni,
  awalMingguIni,
} from '@/lib/dashboard-stats';

// =====================================================
// LIVE dashboard untuk Kepala Sekolah — data hari ini
// Dipanggil langsung saat KS login (tidak dari cache).
// Agregasi memakai helper bersama (lib/dashboard-stats)
// agar konsisten dengan Command Center & Dasbor Eksekutif.
// =====================================================

export async function GET(
  _req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) {
      return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 });
    }

    // RBAC: hanya kepala_sekolah / wakasek / operator / admin_sekolah / bendahara
    const { query } = await import('@/lib/db');
    const memberRes = await query(
      `SELECT imr.value AS role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
         AND imr.value IN ('kepala_sekolah','wakasek','operator','admin_sekolah','bendahara')`,
      [session.id, instId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const guruList = await getGuruList(instId);
    const namaMap = toNamaMap(guruList);
    const { start, end } = awalMingguIni(now);

    const [
      kehadiran,
      raportRes,
      unassignedRes,
      strukturStaf,
      raportDeadline,
      guruTelat,
    ] = await Promise.all([
      getKehadiranGuruHariIni(instId, guruList, now),
      getRaportStats(instId),
      getGuruBelumTerassign(instId, namaMap),
      getStrukturStaf(instId),
      getRaportMendekatiDeadline(instId, now),
      getGuruTelat3x(instId, start, end, namaMap),
    ]);

    const raportByStatus = raportRes.byStatus;

    return NextResponse.json({
      today: now.toISOString(),
      institutionId: instId,
      // Kehadiran
      kehadiran: {
        totalGuru: kehadiran.totalGuru,
        hadirHariIni: kehadiran.hadir,
        belumAbsen: kehadiran.belumAbsen,
        guruTelat3xMingguIni: guruTelat.map((r) => ({ id: r.id, nama: r.nama })),
      },
      // Raport
      raport: {
        total: raportRes.total,
        byStatus: raportByStatus,
        draft: raportByStatus['draft'] || 0,
        dikirim_ke_wali_kelas: raportByStatus['dikirim_ke_wali_kelas'] || 0,
        dikonfirmasi: raportByStatus['dikonfirmasi'] || 0,
        difinalisasi: raportByStatus['difinalisasi'] || 0,
        siap_print: raportByStatus['siap_print'] || 0,
        mendekatiDeadline: raportDeadline,
      },
      // Alerts
      alerts: {
        guruBelumTerassign: unassignedRes,
        guruTelatBerulang: guruTelat,
      },
      // Struktur Staf
      strukturStaf,
    });
  } catch (error: any) {
    console.error('[KS Live Dashboard] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}