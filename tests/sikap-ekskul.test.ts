import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
vi.mock('@/lib/payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/wali-kelas', () => ({
  getWaliKelasForKelas: vi.fn(),
  getActiveTahunAjaran: vi.fn(),
  getCurrentSemester: vi.fn(),
}))

import { query } from '@/lib/db'
import { getWaliKelasForKelas } from '@/lib/wali-kelas'
const mockQuery = query as ReturnType<typeof vi.fn>

import {
  getPresensiSnapshot,
  insertPenilaianSikap,
  updatePenilaianSikap,
  getPenilaianSikap,
  getSikapForRaport,
  createEkstrakurikuler,
  updateEkstrakurikuler,
  getEkstrakurikuler,
  getEkskulByPembina,
  insertPenilaianEkstrakurikuler,
  updatePenilaianEkstrakurikuler,
  getPenilaianEkstrakurikuler,
  getEkskulForRaport,
  upsertCatatanWaliKelas,
  getCatatanWaliKelas,
  getCatatanForRaport,
  getRaportSikapEkskulData,
} from '../lib/sikap-ekskul'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getPresensiSnapshot', () => {
  it('mengembalikan snapshot presensi dari database', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ sakit: 2, izin: 1, alpa: 0 }],
    })

    const result = await getPresensiSnapshot('siswa-1', 'kelas-1', '2025/2026-ganjil')
    expect(result).toEqual({ sakit: 2, izin: 1, alpa: 0 })
  })

  it('mengembalikan 0 semua jika periode format invalid', async () => {
    const result = await getPresensiSnapshot('siswa-1', 'kelas-1', 'invalid-format')
    expect(result).toEqual({ sakit: 0, izin: 0, alpa: 0 })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('mengembalikan 0 semua jika query mengembalikan null', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ sakit: null, izin: null, alpa: null }] })
    const result = await getPresensiSnapshot('siswa-1', 'kelas-1', '2025/2026-ganjil')
    expect(result).toEqual({ sakit: 0, izin: 0, alpa: 0 })
  })

  it('me-parse periode dengan format YYYY/YYYY-smt dengan benar', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ sakit: 1, izin: 0, alpa: 0 }] })
    await getPresensiSnapshot('siswa-1', 'kelas-1', '2025/2026-ganjil')
    const params = mockQuery.mock.calls[0][1]
    expect(params[0]).toBe('%2025%')
    expect(params[3]).toBe('ganjil')
  })
})

describe('insertPenilaianSikap', () => {
  const validInput = {
    siswaId: '11111111-1111-1111-1111-111111111111',
    kelasId: '22222222-2222-2222-2222-222222222222',
    periode: '2025/2026-ganjil',
    varian: 'profil_pelajar_pancasila' as const,
    penilaianPerDimensi: [
      { dimensi: 'beriman_bertakwa', predikat: 'baik' as const },
    ],
    deskripsiUmum: 'Siswa menunjukkan perkembangan positif',
  }

  it('berhasil insert dengan RBAC valid', async () => {
    vi.mocked(getWaliKelasForKelas).mockResolvedValueOnce({
      waliKelasMemberId: 'wali-1',
    } as any)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: validInput.siswaId }] })
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'sikap-1',
        siswa_id: validInput.siswaId,
        kelas_id: validInput.kelasId,
        periode: validInput.periode,
        varian: validInput.varian,
        penilaian_per_dimensi: JSON.stringify(validInput.penilaianPerDimensi),
        deskripsi_umum: validInput.deskripsiUmum,
        dinilai_oleh: 'wali-1',
        created_at: new Date().toISOString(),
      }],
    })

    const result = await insertPenilaianSikap(validInput, 'wali-1')
    expect(result.siswaId).toBe(validInput.siswaId)
    expect(result.varian).toBe(validInput.varian)
  })

  it('melempar error jika aktor bukan wali kelas kelas ini', async () => {
    vi.mocked(getWaliKelasForKelas).mockResolvedValueOnce({
      waliKelasMemberId: 'wali-lain',
    } as any)
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await expect(insertPenilaianSikap(validInput, 'bukan-wali')).rejects.toThrow(
      'Hanya wali kelas aktif'
    )
  })

  it('melempar error jika tidak ada wali kelas untuk kelas ini', async () => {
    vi.mocked(getWaliKelasForKelas).mockResolvedValueOnce(null)
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await expect(insertPenilaianSikap(validInput, 'wali-1')).rejects.toThrow(
      'Hanya wali kelas aktif'
    )
  })

  it('melempar error jika format periode invalid', async () => {
    const invalidInput = { ...validInput, periode: 'invalid-period' }

    await expect(insertPenilaianSikap(invalidInput, 'wali-1')).rejects.toThrow(
      'Format periode tidak valid'
    )
  })

  it('melempar error jika siswa tidak ditemukan di kelas ini', async () => {
    vi.mocked(getWaliKelasForKelas).mockResolvedValueOnce({
      waliKelasMemberId: 'wali-1',
    } as any)
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await expect(insertPenilaianSikap(validInput, 'wali-1')).rejects.toThrow(
      'Siswa tidak ditemukan di kelas ini'
    )
  })
})

describe('updatePenilaianSikap', () => {
  it('berhasil update jika aktor adalah penilai asli', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'sikap-1', siswa_id: 's-1', kelas_id: 'k-1',
        periode: '2025/2026-ganjil', varian: 'profil_pelajar_pancasila',
        penilaian_per_dimensi: '[]', deskripsi_umum: 'lama',
        dinilai_oleh: 'wali-1', created_at: new Date().toISOString(),
      }],
    })
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'sikap-1', siswa_id: 's-1', kelas_id: 'k-1',
        periode: '2025/2026-ganjil', varian: 'profil_pelajar_pancasila',
        penilaian_per_dimensi: JSON.stringify([{ dimensi: 'mandiri', predikat: 'baik' }]),
        deskripsi_umum: 'Update deskripsi',
        dinilai_oleh: 'wali-1', created_at: new Date().toISOString(),
      }],
    })

    const result = await updatePenilaianSikap(
      { id: 'sikap-1', deskripsiUmum: 'Update deskripsi' },
      'wali-1'
    )
    expect(result.deskripsiUmum).toBe('Update deskripsi')
  })

  it('melempar error jika bukan penilai asli', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'sikap-1', dinilai_oleh: 'wali-asli' }],
    })

    await expect(
      updatePenilaianSikap({ id: 'sikap-1', deskripsiUmum: 'baru' }, 'bukan-wali')
    ).rejects.toThrow('Hanya penilai asli')
  })

  it('melempar error jika penilaian tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await expect(
      updatePenilaianSikap({ id: 'nonexistent', deskripsiUmum: 'baru' }, 'wali-1')
    ).rejects.toThrow('tidak ditemukan')
  })
})

describe('getPenilaianSikap', () => {
  it('mengembalikan data dengan filter siswaId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await getPenilaianSikap({ siswaId: 's-1' })
    expect(mockQuery.mock.calls[0][0]).toContain('ps.siswa_id = $1')
  })

  it('mengembalikan data dengan filter varian', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await getPenilaianSikap({ varian: 'profil_pelajar_pancasila' })
    expect(mockQuery.mock.calls[0][0]).toContain('ps.varian = $1')
  })
})

describe('getSikapForRaport', () => {
  it('mengembalikan sikap untuk raport', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 's-1', siswa_id: 'siswa-1', kelas_id: 'kelas-1',
        periode: '2025/2026-ganjil', varian: 'profil_pelajar_pancasila',
        penilaian_per_dimensi: '[]', deskripsi_umum: 'Baik',
        dinilai_oleh: 'wali-1', created_at: new Date().toISOString(),
      }],
    })

    const result = await getSikapForRaport('siswa-1', 'kelas-1', '2025/2026-ganjil')
    expect(result).not.toBeNull()
    expect(result!.siswaId).toBe('siswa-1')
  })

  it('mengembalikan null jika tidak ada data', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await getSikapForRaport('siswa-1', 'kelas-1', '2025/2026-ganjil')
    expect(result).toBeNull()
  })
})

describe('createEkstrakurikuler', () => {
  it('berhasil membuat ekskul baru', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'kelas-1' }] })
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'ekskul-1', nama_ekskul: 'Pramuka', kelas_id: 'kelas-1',
        pembina_member_id: 'pembina-1',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }],
    })

    const result = await createEkstrakurikuler({
      namaEkskul: 'Pramuka',
      kelasId: 'kelas-1',
      pembinaMemberId: 'pembina-1',
    })
    expect(result.namaEkskul).toBe('Pramuka')
  })

  it('melempar error jika kelas tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(
      createEkstrakurikuler({ namaEkskul: 'Pramuka', kelasId: 'nonexistent', pembinaMemberId: 'p-1' })
    ).rejects.toThrow('Kelas tidak ditemukan')
  })
})

describe('updateEkstrakurikuler', () => {
  it('berhasil update nama ekskul', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ekskul-1', nama_ekskul: 'Lama', kelas_id: 'k-1', pembina_member_id: 'p-1' }] })
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ekskul-1', nama_ekskul: 'Baru', kelas_id: 'k-1', pembina_member_id: 'p-1', created_at: '', updated_at: '' }],
    })
    const result = await updateEkstrakurikuler({ id: 'ekskul-1', namaEkskul: 'Baru' })
    expect(result.namaEkskul).toBe('Baru')
  })
})

describe('getEkstrakurikuler', () => {
  it('mengembalikan ekskul berdasarkan kelas', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await getEkstrakurikuler({ kelasId: 'k-1' })
    expect(mockQuery.mock.calls[0][0]).toContain('e.kelas_id = $1')
  })

  it('mengembalikan ekskul berdasarkan pembina', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await getEkstrakurikuler({ pembinaMemberId: 'p-1' })
    expect(mockQuery.mock.calls[0][0]).toContain('e.pembina_member_id = $1')
  })
})

describe('getEkskulByPembina', () => {
  it('memanggil getEkstrakurikuler dengan pembinaMemberId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await getEkskulByPembina('pembina-1')
    expect(result).toEqual([])
  })
})

describe('insertPenilaianEkstrakurikuler', () => {
  const validInput = {
    siswaId: 's-1',
    ekstrakurikulerId: 'e-1',
    periode: '2025/2026-ganjil',
    predikat: 'baik' as const,
    deskripsi: 'Aktif dalam kegiatan',
  }

  it('berhasil insert dengan RBAC valid', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ pembina_member_id: 'pembina-1' }] })
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'pe-1', siswa_id: 's-1', ekstrakurikuler_id: 'e-1',
        periode: '2025/2026-ganjil', predikat: 'baik',
        deskripsi: 'Aktif', dinilai_oleh: 'pembina-1',
        created_at: new Date().toISOString(),
      }],
    })

    const result = await insertPenilaianEkstrakurikuler(validInput, 'pembina-1')
    expect(result.predikat).toBe('baik')
  })

  it('melempar error jika bukan pembina', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ pembina_member_id: 'pembina-asli' }] })

    await expect(
      insertPenilaianEkstrakurikuler(validInput, 'bukan-pembina')
    ).rejects.toThrow('Hanya pembina')
  })

  it('melempar error jika ekskul tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await expect(
      insertPenilaianEkstrakurikuler(validInput, 'pembina-1')
    ).rejects.toThrow('Ekstrakurikuler tidak ditemukan')
  })
})

describe('updatePenilaianEkstrakurikuler', () => {
  it('berhasil update predikat', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'pe-1', dinilai_oleh: 'p-1' }] })
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'pe-1', siswa_id: 's-1', ekstrakurikuler_id: 'e-1', periode: '2025/2026-ganjil', predikat: 'sangat_baik', deskripsi: 'Luar biasa', dinilai_oleh: 'p-1', created_at: '' }],
    })

    const result = await updatePenilaianEkstrakurikuler(
      { id: 'pe-1', predikat: 'sangat_baik' },
      'p-1'
    )
    expect(result.predikat).toBe('sangat_baik')
  })

  it('melempar error jika bukan penilai asli', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'pe-1', dinilai_oleh: 'penilai-asli' }] })
    await expect(
      updatePenilaianEkstrakurikuler({ id: 'pe-1', predikat: 'baik' }, 'orang-lain')
    ).rejects.toThrow('Hanya penilai asli')
  })
})

describe('upsertCatatanWaliKelas', () => {
  const validInput = {
    siswaId: 's-1',
    kelasId: 'k-1',
    periode: '2025/2026-ganjil',
    catatan: 'Perlu ditingkatkan partisipasinya',
  }

  it('berhasil insert catatan baru dengan RBAC valid', async () => {
    vi.mocked(getWaliKelasForKelas).mockResolvedValueOnce({
      waliKelasMemberId: 'wali-1',
    } as any)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's-1' }] })
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'catatan-1', siswa_id: 's-1', kelas_id: 'k-1',
        periode: '2025/2026-ganjil', catatan: validInput.catatan,
        ditulis_oleh: 'wali-1',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }],
    })

    const result = await upsertCatatanWaliKelas(validInput, 'wali-1')
    expect(result.catatan).toBe(validInput.catatan)
  })

  it('melempar error jika format periode invalid', async () => {
    await expect(
      upsertCatatanWaliKelas({ ...validInput, periode: 'salah' }, 'wali-1')
    ).rejects.toThrow('Format periode tidak valid')
  })

  it('melempar error jika aktor bukan wali kelas', async () => {
    vi.mocked(getWaliKelasForKelas).mockResolvedValueOnce({
      waliKelasMemberId: 'wali-asli',
    } as any)
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await expect(
      upsertCatatanWaliKelas(validInput, 'bukan-wali')
    ).rejects.toThrow('Hanya wali kelas aktif')
  })

  it('melempar error jika siswa tidak ditemukan', async () => {
    vi.mocked(getWaliKelasForKelas).mockResolvedValueOnce({
      waliKelasMemberId: 'wali-1',
    } as any)
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await expect(
      upsertCatatanWaliKelas(validInput, 'wali-1')
    ).rejects.toThrow('Siswa tidak ditemukan di kelas ini')
  })

  it('melakukan update jika sudah ada catatan untuk siswa+kelas+periode yang sama (ON CONFLICT)', async () => {
    vi.mocked(getWaliKelasForKelas).mockResolvedValueOnce({
      waliKelasMemberId: 'wali-1',
    } as any)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's-1' }] })
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'catatan-1', siswa_id: 's-1', kelas_id: 'k-1',
        periode: '2025/2026-ganjil', catatan: 'Catatan update',
        ditulis_oleh: 'wali-1',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }],
    })

    const result = await upsertCatatanWaliKelas({ ...validInput, catatan: 'Catatan update' }, 'wali-1')
    expect(result.catatan).toBe('Catatan update')
  })
})

describe('getCatatanWaliKelas', () => {
  it('mengembalikan catatan dengan filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await getCatatanWaliKelas({ siswaId: 's-1', kelasId: 'k-1' })
    expect(mockQuery.mock.calls[0][0]).toContain('cwk.siswa_id = $1')
    expect(mockQuery.mock.calls[0][0]).toContain('cwk.kelas_id = $2')
  })
})

describe('getCatatanForRaport', () => {
  it('mengembalikan catatan untuk raport', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'c-1', siswa_id: 's-1', kelas_id: 'k-1',
        periode: '2025/2026-ganjil', catatan: 'Catatan raport',
        ditulis_oleh: 'wali-1',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }],
    })
    const result = await getCatatanForRaport('s-1', 'k-1', '2025/2026-ganjil')
    expect(result).not.toBeNull()
    expect(result!.catatan).toBe('Catatan raport')
  })

  it('mengembalikan null jika tidak ada', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await getCatatanForRaport('s-1', 'k-1', '2025/2026-ganjil')
    expect(result).toBeNull()
  })
})

describe('getRaportSikapEkskulData', () => {
  it('mengembalikan data lengkap untuk raport', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await getRaportSikapEkskulData('s-1', 'k-1', '2025/2026-ganjil')
    expect(result).toHaveProperty('sikap')
    expect(result).toHaveProperty('ekskul')
    expect(result).toHaveProperty('catatan')
    expect(result.sikap).toBeNull()
    expect(result.ekskul).toEqual([])
    expect(result.catatan).toBeNull()
  })
})
