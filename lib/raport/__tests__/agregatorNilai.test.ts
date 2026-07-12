import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hitungNilaiAkhirMapel, type HasilHitungNilaiAkhir } from '../agregatorNilai';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

import { query } from '@/lib/db';
const mockQuery = query as ReturnType<typeof vi.fn>;

describe('hitungNilaiAkhirMapel', () => {
  const kelasId = '11111111-1111-1111-1111-111111111111';
  const mapelId = '22222222-2222-2222-2222-222222222222';
  const siswaId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('S01: Mengembalikan belum_lengkap saat tidak ada assessments', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('belum_lengkap');
    expect(result.nilaiAkhir).toBeNull();
    expect(result.kkm).toBeNull();
  });

  it('S02: Mengembalikan belum_lengkap saat ada sumatif materi tapi tidak ada akhir semester', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 75, nilai: 80 },
        { id: 'a2', nama_asesmen: 'Sumatif 2', is_akhir_semester: false, kkm: 75, nilai: 85 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('belum_lengkap');
    expect(result.nilaiAkhir).toBeNull();
    expect(result.kkm).toBe(75);
    expect(result.detail?.countMateri).toBe(2);
  });

  it('S03: Menghitung nilai akhir dengan benar saat ada sumatif materi dan akhir semester', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 80, nilai: 75 },
        { id: 'a2', nama_asesmen: 'Sumatif 2', is_akhir_semester: false, kkm: 80, nilai: 85 },
        { id: 'a3', nama_asesmen: 'Sumatif Akhir Semester', is_akhir_semester: true, kkm: 80, nilai: 90 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('lengkap');
    expect(result.kkm).toBe(80);
    expect(result.nilaiAkhir).toBe(85);
    expect(result.detail?.rataRataSumatifMateri).toBe(80);
    expect(result.detail?.nilaiAkhirSemester).toBe(90);
    expect(result.detail?.countMateri).toBe(2);
  });

  it('S04: Menghitung nilai akhir saat hanya ada akhir semester (tanpa sumatif materi)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif Akhir Semester', is_akhir_semester: true, kkm: 70, nilai: 85 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('lengkap');
    expect(result.nilaiAkhir).toBe(85);
    expect(result.kkm).toBe(70);
    expect(result.detail?.countMateri).toBe(0);
  });

  it('S05: Mengembalikan belum_lengkap saat akhir semester ada tapi nilainya null', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 75, nilai: 80 },
        { id: 'a2', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 75, nilai: null },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('belum_lengkap');
    expect(result.nilaiAkhir).toBeNull();
  });

  it('S06: KKM null pada Kurikulum Merdeka (tidak ada KKM tetap)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: null, nilai: 80 },
        { id: 'a2', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: null, nilai: 90 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('lengkap');
    expect(result.nilaiAkhir).toBe(85);
    expect(result.kkm).toBeNull();
  });

  it('S07: Pembulatan hasil ke 1 desimal', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 75, nilai: 77 },
        { id: 'a2', nama_asesmen: 'Sumatif 2', is_akhir_semester: false, kkm: 75, nilai: 83 },
        { id: 'a3', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 75, nilai: 88 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    const rataMateri = (77 + 83) / 2;
    const expected = Math.round(((rataMateri + 88) / 2) * 10) / 10;

    expect(result.status).toBe('lengkap');
    expect(result.nilaiAkhir).toBe(expected);
  });

  it('S08: Beberapa sumatif materi dengan nilai desimal', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 70, nilai: 75.5 },
        { id: 'a2', nama_asesmen: 'Sumatif 2', is_akhir_semester: false, kkm: 70, nilai: 82.3 },
        { id: 'a3', nama_asesmen: 'Sumatif 3', is_akhir_semester: false, kkm: 70, nilai: 68.0 },
        { id: 'a4', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 70, nilai: 85.7 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('lengkap');
    expect(result.detail?.countMateri).toBe(3);
    expect(result.detail?.rataRataSumatifMateri).toBe(75.3);
  });

  it('S09: Nilai akhir semester null tetap hitung dari rata-rata materi saja', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 75, nilai: 80 },
        { id: 'a2', nama_asesmen: 'Sumatif 2', is_akhir_semester: false, kkm: 75, nilai: 90 },
        { id: 'a3', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 75, nilai: null },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('belum_lengkap');
    expect(result.nilaiAkhir).toBeNull();
    expect(result.detail?.nilaiAkhirSemester).toBeNull();
  });

  it('S10: Hanya sumatif materi (tanpa akhir semester) - belum lengkap', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 70, nilai: 75 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('belum_lengkap');
    expect(result.nilaiAkhir).toBeNull();
  });
});
