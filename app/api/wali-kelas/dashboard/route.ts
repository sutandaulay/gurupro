import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { captureError, errorResponse } from '@/lib/api-error';
import {
  getOwnedWaliKelasClassIds,
  getWaliKelasDashboardData,
} from '@/lib/wali-kelas/dashboard';

/**
 * GET /api/wali-kelas/dashboard?kelasId=<uuid>&periode=<periode>
 *
 * Returns the aggregated wali kelas dashboard payload (siswa status, sikap,
 * catatan, presensi, raport status) for ONE class + periode.
 *
 * RBAC: only the homeroom teacher of the requested class may fetch its data.
 * Non-owned classes -> 403. All per-student data is fetched in batch (no N+1).
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();

    const { searchParams } = new URL(req.url);
    const kelasId = searchParams.get('kelasId') || searchParams.get('kelas_id');
    const periode = searchParams.get('periode');

    if (!kelasId) {
      return NextResponse.json({ error: 'kelasId wajib diisi' }, { status: 400 });
    }
    if (!periode) {
      return NextResponse.json({ error: 'periode wajib diisi' }, { status: 400 });
    }

    const ownedClassIds = await getOwnedWaliKelasClassIds(session.id);
    if (!ownedClassIds.includes(kelasId)) {
      return NextResponse.json(
        { error: 'Forbidden: Anda bukan wali kelas untuk kelas ini' },
        { status: 403 }
      );
    }

    const data = await getWaliKelasDashboardData(kelasId, periode);
    return NextResponse.json({ data });
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    captureError(error, { route: '/api/wali-kelas/dashboard' });
    return NextResponse.json(errorResponse(error, 'Gagal mengambil dashboard wali kelas'));
  }
}
