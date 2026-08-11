/**
 * API Test Suite: Wali Kelas Dashboard (RBAC + Batch Data)
 *
 * Acceptance criteria from the 4-tab Wali Kelas spec:
 * - RBAC: wali kelas A TIDAK boleh mengakses data kelas B (403 / empty)
 * - Data di-fetch dalam batch (getWaliKelasDashboardData dipanggil SATU kali)
 * - 400 jika kelasId/periode tidak disertakan; 401 tanpa session
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ query: vi.fn() }));
vi.mock('@/lib/session', () => ({ requireSession: vi.fn() }));
vi.mock('@/lib/wali-kelas/dashboard', () => ({
  getOwnedWaliKelasClassIds: vi.fn(),
  getWaliKelasDashboardData: vi.fn(),
}));

import { requireSession } from '@/lib/session';
import {
  getOwnedWaliKelasClassIds,
  getWaliKelasDashboardData,
} from '@/lib/wali-kelas/dashboard';
import { GET as getDashboard } from '@/app/api/wali-kelas/dashboard/route';
import { GET as getExport } from '@/app/api/wali-kelas/dashboard/export/route';

const mockRequireSession = requireSession as unknown as ReturnType<typeof vi.fn>;
const mockOwnedClasses = getOwnedWaliKelasClassIds as unknown as ReturnType<typeof vi.fn>;
const mockDashboardData = getWaliKelasDashboardData as unknown as ReturnType<typeof vi.fn>;

const KELAS_WALI = '11111111-1111-1111-1111-111111111111';
const KELAS_LAIN = '22222222-2222-2222-2222-222222222222';
const PERIODE = '2025/2026-ganjil';

const makeDashboardUrl = (kelasId: string, periode: string) =>
  `http://localhost:3000/api/wali-kelas/dashboard?kelasId=${kelasId}&periode=${encodeURIComponent(periode)}`;
const makeExportUrl = (kelasId: string, periode: string) =>
  `http://localhost:3000/api/wali-kelas/dashboard/export?kelasId=${kelasId}&periode=${encodeURIComponent(periode)}`;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/wali-kelas/dashboard', () => {
  it('return 401 jika tidak ada session', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'));

    const res = await getDashboard(new Request(makeDashboardUrl(KELAS_WALI, PERIODE)));

    expect(res.status).toBe(401);
  });

  it('return 400 jika kelasId kosong', async () => {
    mockRequireSession.mockResolvedValue({ id: 'wali-a', role: 'guru' });

    const res = await getDashboard(
      new Request('http://localhost:3000/api/wali-kelas/dashboard?periode=2025/2026-ganjil')
    );

    expect(res.status).toBe(400);
  });

  it('return 400 jika periode kosong', async () => {
    mockRequireSession.mockResolvedValue({ id: 'wali-a', role: 'guru' });

    const res = await getDashboard(
      new Request('http://localhost:3000/api/wali-kelas/dashboard?kelasId=abc')
    );

    expect(res.status).toBe(400);
  });

  it('403 jika wali kelas A meminta data kelas B', async () => {
    mockRequireSession.mockResolvedValue({ id: 'wali-a', role: 'guru' });
    mockOwnedClasses.mockResolvedValue([KELAS_WALI]);

    const res = await getDashboard(new Request(makeDashboardUrl(KELAS_LAIN, PERIODE)));

    expect(res.status).toBe(403);
    // Data tidak boleh diambil untuk kelas yang tidak dimiliki
    expect(mockDashboardData).not.toHaveBeenCalled();
  });

  it('200 dan mengembalikan data jika user adalah wali kelas dari kelas tersebut', async () => {
    mockRequireSession.mockResolvedValue({ id: 'wali-a', role: 'guru' });
    mockOwnedClasses.mockResolvedValue([KELAS_WALI]);
    mockDashboardData.mockResolvedValue({
      kelas: { id: KELAS_WALI, nama_kelas: 'X.1' },
      periode: PERIODE,
      siswa: [],
      sikap: [],
      catatan: [],
      raportStatus: [],
      statistik: { totalSiswa: 0, sikapTerisi: 0, catatanTerisi: 0 },
    });

    const res = await getDashboard(new Request(makeDashboardUrl(KELAS_WALI, PERIODE)));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.kelas.id).toBe(KELAS_WALI);
    // Batch: cukup SATU panggilan agregasi untuk seluruh kelas
    expect(mockDashboardData).toHaveBeenCalledTimes(1);
    expect(mockDashboardData).toHaveBeenCalledWith(KELAS_WALI, PERIODE);
  });
});

describe('GET /api/wali-kelas/dashboard/export', () => {
  it('return 401 jika tidak ada session', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'));

    const res = await getExport(new Request(makeExportUrl(KELAS_WALI, PERIODE)));

    expect(res.status).toBe(401);
  });

  it('403 jika wali kelas A mengekspor data kelas B', async () => {
    mockRequireSession.mockResolvedValue({ id: 'wali-a', role: 'guru' });
    mockOwnedClasses.mockResolvedValue([KELAS_WALI]);

    const res = await getExport(new Request(makeExportUrl(KELAS_LAIN, PERIODE)));

    expect(res.status).toBe(403);
    expect(mockDashboardData).not.toHaveBeenCalled();
  });

  it('return 400 jika periode kosong', async () => {
    mockRequireSession.mockResolvedValue({ id: 'wali-a', role: 'guru' });

    const res = await getExport(
      new Request('http://localhost:3000/api/wali-kelas/dashboard/export?kelasId=abc')
    );

    expect(res.status).toBe(400);
  });
});
