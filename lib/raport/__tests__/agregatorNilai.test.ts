import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hitungNilaiAkhirMapel,
  getNilaiMapelSiswa,
  refreshDataRaportFromBukuNilai,
  validateAllNilaiMapelConfirmed,
  canChangeStatusToDifinalisasi,
  type HasilHitungNilaiAkhir,
} from '../agregatorNilai';

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
    vi.resetAllMocks();
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

  it('E01: Semua sumatif materi null, akhir semester ada nilai → belum_lengkap', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 75, nilai: null },
        { id: 'a2', nama_asesmen: 'Sumatif 2', is_akhir_semester: false, kkm: 75, nilai: null },
        { id: 'a3', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 75, nilai: 88 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('belum_lengkap');
    expect(result.nilaiAkhir).toBeNull();
    expect(result.detail?.rataRataSumatifMateri).toBeNull();
    expect(result.detail?.nilaiAkhirSemester).toBe(88);
    expect(result.detail?.countMateri).toBe(2);
  });

  it('E02: Sebagian sumatif materi null, akhir semester ada nilai → skip null, hitung sisanya', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 75, nilai: 80 },
        { id: 'a2', nama_asesmen: 'Sumatif 2', is_akhir_semester: false, kkm: 75, nilai: null },
        { id: 'a3', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 75, nilai: 90 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('lengkap');
    expect(result.detail?.countMateri).toBe(1);
    expect(result.detail?.rataRataSumatifMateri).toBe(80);
    expect(result.nilaiAkhir).toBe(85);
  });

  it('E03: Menggunakan parameter periode', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 70, nilai: 85 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId, '2025/2026-ganjil');

    expect(result.status).toBe('lengkap');
    expect(mockQuery.mock.calls[0][1]).toContain('2025/2026-ganjil');
    expect(mockQuery.mock.calls[0][1].length).toBe(4);
  });

  it('E04: KKM berbeda antara assessments → pakai KKM dari akhir semester', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 70, nilai: 80 },
        { id: 'a2', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 75, nilai: 90 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('lengkap');
    expect(result.kkm).toBe(75);
  });

  it('E05: Nilai 0 adalah valid', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif 1', is_akhir_semester: false, kkm: 70, nilai: 0 },
        { id: 'a2', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 70, nilai: 50 },
      ],
    });

    const result = await hitungNilaiAkhirMapel(kelasId, mapelId, siswaId);

    expect(result.status).toBe('lengkap');
    expect(result.nilaiAkhir).toBe(25);
  });
});

describe('getNilaiMapelSiswa', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('mengembalikan Map subjectId → hasil', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { subject_id: 'mapel-1', nama_mapel: 'Matematika' },
        { subject_id: 'mapel-2', nama_mapel: 'IPA' },
      ],
    });

    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 75, nilai: 85 },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'b1', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 70, nilai: 90 },
      ],
    });

    const result = await getNilaiMapelSiswa('kelas-1', 'siswa-1');

    expect(result.size).toBe(2);
    expect(result.get('mapel-1')?.namaMapel).toBe('Matematika');
    expect(result.get('mapel-1')?.hasil.status).toBe('lengkap');
    expect(result.get('mapel-2')?.namaMapel).toBe('IPA');
    expect(result.get('mapel-2')?.hasil.status).toBe('lengkap');
  });

  it('meneruskan parameter periode', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getNilaiMapelSiswa('kelas-1', 'siswa-1', '2025/2026-ganjil');

    expect(mockQuery.mock.calls[0][1].length).toBe(3);
    expect(mockQuery.mock.calls[0][1][2]).toBe('2025/2026-ganjil');
  });

  it('mengembalikan Map kosong jika tidak ada assessments', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getNilaiMapelSiswa('kelas-1', 'siswa-1');

    expect(result.size).toBe(0);
  });
});

describe('refreshDataRaportFromBukuNilai', () => {
  it('mengupdate nilai dari setiap mapel yang lengkap', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'raport-1', kelas_id: 'kelas-1', siswa_id: 'siswa-1', periode: '2025/2026-ganjil',
          nilai_mapel_id: 'nm-1', mapel_id: 'mapel-1', guru_mapel_member_id: 'guru-1' },
        { id: 'raport-1', kelas_id: 'kelas-1', siswa_id: 'siswa-1', periode: '2025/2026-ganjil',
          nilai_mapel_id: 'nm-2', mapel_id: 'mapel-2', guru_mapel_member_id: 'guru-1' },
      ],
    });

    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 75, nilai: 85 },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'b1', nama_asesmen: 'Sumatif Akhir', is_akhir_semester: true, kkm: 70, nilai: null },
      ],
    });

    if (mockQuery.mockResolvedValueOnce) {
    }
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await refreshDataRaportFromBukuNilai('raport-1');

    expect(result.success).toBe(false);
    expect(result.updatedCount).toBe(1);
    expect(result.errors.length).toBe(1);
  });

  it('mengembalikan error jika raport tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await refreshDataRaportFromBukuNilai('nonexistent');

    expect(result.success).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(result.errors).toEqual(['Raport tidak ditemukan']);
  });
});

describe('validateAllNilaiMapelConfirmed', () => {
  it('valid jika semua mapel dikonfirmasi', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'nm-1', mapel_id: 'mapel-1', dikonfirmasi_guru: true, nama_mapel: 'Matematika' },
        { id: 'nm-2', mapel_id: 'mapel-2', dikonfirmasi_guru: true, nama_mapel: 'IPA' },
      ],
    });

    const result = await validateAllNilaiMapelConfirmed('raport-1');

    expect(result.valid).toBe(true);
    expect(result.unconfirmedMapels).toEqual([]);
  });

  it('tidak valid jika ada mapel belum dikonfirmasi', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'nm-1', mapel_id: 'mapel-1', dikonfirmasi_guru: true, nama_mapel: 'Matematika' },
        { id: 'nm-2', mapel_id: 'mapel-2', dikonfirmasi_guru: false, nama_mapel: 'IPA' },
      ],
    });

    const result = await validateAllNilaiMapelConfirmed('raport-1');

    expect(result.valid).toBe(false);
    expect(result.unconfirmedMapels).toEqual(['IPA']);
  });

  it('fallback ke mapel_id jika nama_mapel null', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'nm-1', mapel_id: 'mapel-1', dikonfirmasi_guru: false, nama_mapel: null },
      ],
    });

    const result = await validateAllNilaiMapelConfirmed('raport-1');

    expect(result.valid).toBe(false);
    expect(result.unconfirmedMapels).toEqual(['mapel-1']);
  });
});

describe('canChangeStatusToDifinalisasi', () => {
  it('dapat difinalisasi jika status dikonfirmasi dan semua mapel dikonfirmasi', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'dikonfirmasi' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'nm-1', mapel_id: 'm-1', dikonfirmasi_guru: true, nama_mapel: 'Mat' }] });

    const result = await canChangeStatusToDifinalisasi('raport-1');

    expect(result.canChange).toBe(true);
  });

  it('tidak dapat difinalisasi jika raport tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await canChangeStatusToDifinalisasi('nonexistent');

    expect(result.canChange).toBe(false);
    expect(result.reason).toBe('Raport tidak ditemukan');
  });

  it('tidak dapat difinalisasi jika status bukan dikonfirmasi', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'draft' }] });

    const result = await canChangeStatusToDifinalisasi('raport-1');

    expect(result.canChange).toBe(false);
    expect(result.reason).toContain("'dikonfirmasi'");
    expect(result.reason).toContain("'draft'");
  });

  it('tidak dapat difinalisasi jika ada mapel belum dikonfirmasi guru', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'dikonfirmasi' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'nm-1', mapel_id: 'm-1', dikonfirmasi_guru: false, nama_mapel: 'Mat' }] });

    const result = await canChangeStatusToDifinalisasi('raport-1');

    expect(result.canChange).toBe(false);
    expect(result.reason).toContain('dikonfirmasi guru');
    expect(result.unconfirmedMapels).toEqual(['Mat']);
  });
});
