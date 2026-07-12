import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ query: vi.fn(), pool: { connect: vi.fn() } }))
vi.mock('@/lib/payload', () => ({ getPayload: vi.fn() }))

import { query } from '@/lib/db'
import { getPayload } from '@/lib/payload'
const mockQuery = query as ReturnType<typeof vi.fn>
const mockGetPayload = getPayload as ReturnType<typeof vi.fn>

import {
  assignWaliKelas,
  reassignWaliKelas,
  updateWaliKelasStatus,
  getWaliKelasAssignments,
  getCurrentSemester,
  getActiveTahunAjaran,
} from '../lib/wali-kelas'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const VALID_UUID2 = '22222222-2222-4222-8222-222222222222'
const VALID_UUID3 = '33333333-3333-4333-8333-333333333333'

function createMockPayload(findByID: any = {}) {
  return {
    findByID: vi.fn().mockResolvedValue(findByID),
    find: vi.fn().mockResolvedValue({ docs: [] }),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getCurrentSemester', () => {
  it('mengembalikan ganjil untuk bulan Juli-Desember', () => {
    const july = new Date(2025, 6, 15)
    vi.useFakeTimers()
    vi.setSystemTime(july)
    expect(getCurrentSemester()).toBe('ganjil')
    vi.useRealTimers()
  })

  it('mengembalikan genap untuk bulan Januari-Juni', () => {
    const jan = new Date(2025, 0, 15)
    vi.useFakeTimers()
    vi.setSystemTime(jan)
    expect(getCurrentSemester()).toBe('genap')
    vi.useRealTimers()
  })

  it('mengembalikan ganjil untuk bulan Desember', () => {
    const dec = new Date(2025, 11, 1)
    vi.useFakeTimers()
    vi.setSystemTime(dec)
    expect(getCurrentSemester()).toBe('ganjil')
    vi.useRealTimers()
  })

  it('mengembalikan genap untuk bulan Juni', () => {
    const jun = new Date(2025, 5, 30)
    vi.useFakeTimers()
    vi.setSystemTime(jun)
    expect(getCurrentSemester()).toBe('genap')
    vi.useRealTimers()
  })
})

describe('getActiveTahunAjaran', () => {
  it('mengembalikan tahun ajaran aktif', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ta-1', nama: '2025/2026' }],
    })
    const result = await getActiveTahunAjaran()
    expect(result).toEqual({ id: 'ta-1', nama: '2025/2026' })
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('is_active = true')
    )
  })

  it('mengembalikan null jika tidak ada tahun ajaran aktif', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await getActiveTahunAjaran()
    expect(result).toBeNull()
  })
})

describe('assignWaliKelas', () => {
  const validInput = {
    kelasId: VALID_UUID,
    waliKelasMemberId: VALID_UUID2,
    tahunAjaran: '2025/2026',
    semester: 'ganjil' as const,
    ditugaskanOleh: VALID_UUID3,
  }

  it('berhasil membuat assignment baru', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: validInput.kelasId, school_id: 'school-1' }] })
    mockGetPayload.mockResolvedValueOnce(
      createMockPayload({
        id: validInput.waliKelasMemberId,
        role: ['guru'],
        institution: { id: 1 },
      })
    )
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'new-assignment-id',
        kelas_id: validInput.kelasId,
        wali_kelas_member_id: validInput.waliKelasMemberId,
        tahun_ajaran: validInput.tahunAjaran,
        semester: validInput.semester,
        status: 'aktif',
        ditugaskan_pada: new Date(),
        ditugaskan_oleh: validInput.ditugaskanOleh,
        created_at: new Date(),
        updated_at: new Date(),
      }],
    })

    const result = await assignWaliKelas(validInput)
    expect(result.status).toBe('aktif')
    expect(result.kelas_id).toBe(validInput.kelasId)
    expect(mockQuery).toHaveBeenCalledTimes(4)
  })

  it('melempar error jika kelas tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(assignWaliKelas(validInput)).rejects.toThrow('Kelas tidak ditemukan')
  })

  it('melempar error jika member tidak ditemukan di institution-members', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: validInput.kelasId, school_id: 'school-1' }] })
    const payload = createMockPayload()
    payload.findByID.mockRejectedValue(new Error('Not found'))
    mockGetPayload.mockResolvedValueOnce(payload)

    await expect(assignWaliKelas(validInput)).rejects.toThrow('tidak ditemukan di institution-members')
  })

  it('melempar error jika member bukan guru', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: validInput.kelasId, school_id: 'school-1' }] })
    mockGetPayload.mockResolvedValueOnce(
      createMockPayload({
        id: validInput.waliKelasMemberId,
        role: ['operator'],
        institution: { id: 1 },
      })
    )
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })

    await expect(assignWaliKelas(validInput)).rejects.toThrow('bukan guru')
  })

  it('melempar error jika sudah ada assignment aktif untuk kelas+periode yang sama', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: validInput.kelasId, school_id: 'school-1' }] })
    mockGetPayload.mockResolvedValueOnce(
      createMockPayload({
        id: validInput.waliKelasMemberId,
        role: ['guru'],
        institution: { id: 1 },
      })
    )
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-assignment' }] })

    await expect(assignWaliKelas(validInput)).rejects.toThrow(
      'sudah punya wali kelas aktif'
    )
  })

  it('validasi input dengan Zod: format UUID invalid', async () => {
    const invalidInput = { ...validInput, kelasId: 'not-a-uuid' }
    await expect(assignWaliKelas(invalidInput as any)).rejects.toThrow()
  })

  it('validasi input dengan Zod: tahun ajaran format salah', async () => {
    const invalidInput = { ...validInput, tahunAjaran: '2025-2026' }
    await expect(assignWaliKelas(invalidInput as any)).rejects.toThrow()
  })

  it('validasi input dengan Zod: semester tidak valid', async () => {
    const invalidInput = { ...validInput, semester: 'ganjil_genap' }
    await expect(assignWaliKelas(invalidInput as any)).rejects.toThrow()
  })

  it('melanjutkan meskipun institution check tidak ada (institutionId null)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: validInput.kelasId, school_id: 'school-1' }] })
    mockGetPayload.mockResolvedValueOnce(
      createMockPayload({
        id: validInput.waliKelasMemberId,
        role: ['guru'],
        institution: null,
      })
    )
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'new-id', kelas_id: validInput.kelasId,
        wali_kelas_member_id: validInput.waliKelasMemberId,
        tahun_ajaran: validInput.tahunAjaran, semester: validInput.semester,
        status: 'aktif', ditugaskan_pada: new Date(),
        ditugaskan_oleh: null, created_at: new Date(), updated_at: new Date(),
      }],
    })

    const result = await assignWaliKelas({ ...validInput, ditugaskanOleh: undefined })
    expect(result.status).toBe('aktif')
  })
})

describe('reassignWaliKelas', () => {
  it('menonaktifkan assignment lama dan membuat yang baru', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID, school_id: 'school-1' }] })
    const payload = createMockPayload({
      id: VALID_UUID2,
      role: ['guru'],
      institution: { id: 1 },
    })
    mockGetPayload.mockResolvedValueOnce(payload)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'new-id', kelas_id: VALID_UUID,
        wali_kelas_member_id: VALID_UUID2,
        tahun_ajaran: '2025/2026', semester: 'ganjil',
        status: 'aktif', ditugaskan_pada: new Date(),
        ditugaskan_oleh: null, created_at: new Date(), updated_at: new Date(),
      }],
    })

    const result = await reassignWaliKelas(VALID_UUID, VALID_UUID2, '2025/2026', 'ganjil')
    expect(result.status).toBe('aktif')

    const deactivateCall = mockQuery.mock.calls[0]
    expect(deactivateCall[0]).toContain("status = 'nonaktif'")
  })
})

describe('updateWaliKelasStatus', () => {
  it('mengupdate status assignment', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: VALID_UUID, kelas_id: VALID_UUID2,
        wali_kelas_member_id: VALID_UUID3,
        tahun_ajaran: '2025/2026', semester: 'ganjil',
        status: 'nonaktif', ditugaskan_pada: new Date(),
        ditugaskan_oleh: null, created_at: new Date(), updated_at: new Date(),
      }],
    })

    const result = await updateWaliKelasStatus(VALID_UUID, 'nonaktif')
    expect(result.status).toBe('nonaktif')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE wali_kelas_assignments'),
      ['nonaktif', VALID_UUID]
    )
  })

  it('validasi input dengan Zod', async () => {
    await expect(updateWaliKelasStatus('invalid-uuid', 'aktif' as any)).rejects.toThrow()
    await expect(updateWaliKelasStatus(VALID_UUID, undefined as any)).rejects.toThrow()
  })

  it('melempar error jika assignment tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await expect(
      updateWaliKelasStatus(VALID_UUID, 'nonaktif')
    ).rejects.toThrow('Assignment tidak ditemukan')
  })
})

describe('getWaliKelasAssignments', () => {
  it('mengembalikan semua assignment tanpa filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await getWaliKelasAssignments()
    expect(result).toEqual([])
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM wali_kelas_assignments'),
      []
    )
  })

  it('menerapkan filter dengan benar', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await getWaliKelasAssignments({ kelasId: VALID_UUID, status: 'aktif' })

    const call = mockQuery.mock.calls[0]
    expect(call[0]).toContain('WHERE')
    expect(call[0]).toContain('kelas_id = $1')
    expect(call[0]).toContain('status = $2')
    expect(call[1]).toEqual([VALID_UUID, 'aktif'])
  })

  it('mengembalikan data assignment dengan benar', async () => {
    const mockData = [{
      id: VALID_UUID, kelas_id: VALID_UUID2, wali_kelas_member_id: VALID_UUID3,
      tahun_ajaran: '2025/2026', semester: 'ganjil',
      status: 'aktif', ditugaskan_pada: new Date(),
      ditugaskan_oleh: null, created_at: new Date(), updated_at: new Date(),
    }]
    mockQuery.mockResolvedValueOnce({ rows: mockData })
    const result = await getWaliKelasAssignments({ status: 'aktif' })
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('aktif')
  })
})
