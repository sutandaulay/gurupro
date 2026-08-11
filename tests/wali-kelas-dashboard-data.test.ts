/**
 * Test Suite: getWaliKelasDashboardData — batch query nilai mapel & relasi
 *
 * Verifikasi acceptance criteria:
 * - Nilai per mapel per raport diambil SATU query (ANY($1::uuid[])), bukan N+1.
 * - data_raport.periode ("TS-2025/2026-Ganjil") dicocokkan dengan periode
 *   dashboard ("2025/2026-ganjil") via LIKE + normalisasi, bukan = persis.
 * - guru_mapel_member_id di-join langsung ke users (nama guru).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ query: vi.fn() }));
vi.mock('@/lib/sikap-ekskul', () => ({
  getPresensiSnapshot: vi.fn(),
  getPenilaianSikap: vi.fn(),
  getCatatanWaliKelas: vi.fn(),
}));

import { query } from '@/lib/db';
import {
  getPresensiSnapshot,
  getPenilaianSikap,
  getCatatanWaliKelas,
} from '@/lib/sikap-ekskul';
import { getWaliKelasDashboardData } from '@/lib/wali-kelas/dashboard';

const mockQuery = query as unknown as ReturnType<typeof vi.fn>;
const mockPresensi = getPresensiSnapshot as unknown as ReturnType<typeof vi.fn>;
const mockSikap = getPenilaianSikap as unknown as ReturnType<typeof vi.fn>;
const mockCatatan = getCatatanWaliKelas as unknown as ReturnType<typeof vi.fn>;

const KELAS = '11111111-1111-1111-1111-111111111111';
const PERIODE = '2025/2026-ganjil';
const SISWA_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const RAPORT_A = 'c1111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getWaliKelasDashboardData — batch & relasi', () => {
  it('mengambil nilai mapel dalam SATU query batch dan mencocokkan periode raport (TS-/AS- prefix)', async () => {
    mockQuery
      // kelas
      .mockResolvedValueOnce({
        rows: [{ id: KELAS, nama_kelas: 'X.1', school_id: 's1', wali_kelas: 'Bu Wali' }],
      })
      // siswa
      .mockResolvedValueOnce({
        rows: [{ id: SISWA_A, nama_siswa: 'Andi', nisn: null, nis_lokal: null, nomor_absen: 1 }],
      })
      // raport status (periode LIKE)
      .mockResolvedValueOnce({
        rows: [
          {
            siswa_id: SISWA_A,
            raport_id: RAPORT_A,
            status: 'dikirim_ke_wali_kelas',
            jenis_laporan: 'akhir_semester',
            updated_at: '2026-06-01T00:00:00.000Z',
            nama_template: 'Template AS',
            mode_nilai_akademik: 'angka_kkm',
          },
        ],
      })
      // nilai mapel batch
      .mockResolvedValueOnce({
        rows: [
          {
            data_raport_id: RAPORT_A,
            mapel_id: 'm1',
            guru_mapel_member_id: 'guru-1',
            nilai_akhir: '85.0',
            kkm: '75.0',
            deskripsi_capaian: 'Sangat baik',
            dikonfirmasi_guru: true,
            deskripsi_dibuka_untuk_review: true,
            nama_mapel: 'Matematika',
            guru_nama: 'Bu Siti',
          },
        ],
      });

    mockSikap.mockResolvedValue({ data: [], total: 0 });
    mockCatatan.mockResolvedValue({ data: [], total: 0 });
    mockPresensi.mockResolvedValue({ [SISWA_A]: { sakit: 1, izin: 0, alpa: 0 } });

    const result = await getWaliKelasDashboardData(KELAS, PERIODE);

    // data_raport.periode dicocokkan via LIKE (bukan = persis) agar
    // "TS-2025/2026-Ganjil" cocok dengan periode dashboard "2025/2026-ganjil".
    const raportQuery = mockQuery.mock.calls.find((c: any) =>
      String(c[0]).includes('FROM data_raport')
    );
    expect(raportQuery).toBeDefined();
    expect(String(raportQuery![0])).toContain('LOWER(dr.periode) LIKE');
    expect(raportQuery![1]).toEqual([KELAS, '2025/2026-ganjil']);

    // Nilai mapel: SATU query batch dengan ANY($1::uuid[]) untuk seluruh raport kelas.
    const nilaiQuery = mockQuery.mock.calls.find((c: any) =>
      String(c[0]).includes('FROM data_raport_nilai_mapel')
    );
    expect(nilaiQuery).toBeDefined();
    expect(String(nilaiQuery![0])).toContain('ANY($1::uuid[])');
    expect(nilaiQuery![1]).toEqual([[RAPORT_A]]);

    expect(result.raportStatus).toHaveLength(1);
    expect(result.raportStatus[0].modeNilaiAkademik).toBe('angka_kkm');
    expect(result.raportStatus[0].nilaiMapel).toEqual([
      {
        mapelId: 'm1',
        namaMapel: 'Matematika',
        guruNama: 'Bu Siti',
        nilaiAkhir: 85,
        kkm: 75,
        deskripsiCapaian: 'Sangat baik',
        dikonfirmasiGuru: true,
        deskripsiDibukaUntukReview: true,
      },
    ]);
  });

  it('nilaiMapel kosong jika raport belum punya nilai dari guru mapel', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: KELAS, nama_kelas: 'X.1', school_id: 's1', wali_kelas: null }] })
      .mockResolvedValueOnce({ rows: [] }) // tidak ada siswa
      .mockResolvedValueOnce({ rows: [] }) // tidak ada raport
      .mockResolvedValueOnce({ rows: [] }); // tidak ada nilai

    mockSikap.mockResolvedValue({ data: [], total: 0 });
    mockCatatan.mockResolvedValue({ data: [], total: 0 });
    mockPresensi.mockResolvedValue({});

    const result = await getWaliKelasDashboardData(KELAS, PERIODE);

    expect(result.raportStatus).toEqual([]);
    expect(result.statistik.totalSiswa).toBe(0);
  });
});
