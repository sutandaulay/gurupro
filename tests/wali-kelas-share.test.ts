import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));
vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn(),
}));
vi.mock('@/lib/wali-kelas', () => ({
  getWaliKelasForKelas: vi.fn(),
}));
vi.mock('@/lib/institution-members', () => ({
  sendInAppNotification: vi.fn(),
}));
vi.mock('@/lib/notifications', () => ({
  sendEmailNotification: vi.fn(),
  sendWhatsAppNotification: vi.fn(),
}));
vi.mock('@/lib/raport/kontak-eksternal-repository', () => ({
  getKontakByLinkToken: vi.fn(),
  getDataRaportForKelas: vi.fn(),
  getPemetaanKolomProfile: vi.fn(),
  isPemetaanProfileExpired: vi.fn(),
  isOtpVerified: vi.fn(),
  createKontakEksternal: vi.fn(),
}));
vi.mock('@/lib/raport/eksternal-email-templates', () => ({
  generateKontakEksternalLinkEmail: vi.fn(),
}));
vi.mock('@/lib/sikap-ekskul', () => ({
  getPenilaianEkstrakurikuler: vi.fn(),
}));

import { query } from '@/lib/db';
import { getPayload } from '@/lib/payload';
import { getWaliKelasForKelas } from '@/lib/wali-kelas';
import { sendInAppNotification } from '@/lib/institution-members';
import { sendEmailNotification, sendWhatsAppNotification } from '@/lib/notifications';
import {
  getKontakByLinkToken,
  getDataRaportForKelas,
  getPemetaanKolomProfile,
  isOtpVerified,
  createKontakEksternal,
} from '@/lib/raport/kontak-eksternal-repository';
import { generateKontakEksternalLinkEmail } from '@/lib/raport/eksternal-email-templates';
import { cookies } from 'next/headers';

import { POST as generateExcel } from '@/app/api/raport/eksternal/generate-excel/route';
import { POST as generatePdf } from '@/app/api/raport/eksternal/generate-pdf/route';
import { POST as kontakEksternal } from '@/app/api/raport/kontak-eksternal/route';
import { POST as internalNotif } from '@/app/api/internal-notifications/nilai-to-wali-kelas/route';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockGetWaliKelasForKelas = getWaliKelasForKelas as ReturnType<typeof vi.fn>;
const mockSendInAppNotification = sendInAppNotification as ReturnType<typeof vi.fn>;
const mockSendWhatsApp = sendWhatsAppNotification as ReturnType<typeof vi.fn>;
const mockSendEmail = sendEmailNotification as ReturnType<typeof vi.fn>;

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const VALID_UUID2 = '22222222-2222-2222-2222-222222222222';

const mockSiswaId = VALID_UUID;
const mockKelasId = VALID_UUID2;
const mockGuruMapelMemberId = '33333333-3333-3333-3333-333333333333';
const mockWaliKelasMemberId = '44444444-4444-4444-4444-444444444444';
const mockToken = 'test_valid_token';
const mockDataId = '55555555-5555-5555-5555-555555555555';

const futureISO = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

let sessionUserId: string | undefined = undefined;

function makeReq(body: Record<string, unknown>, url = 'http://localhost:3000/api/raport/eksternal/generate-excel') {
  return {
    json: async () => body,
    nextUrl: new URL(url),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionUserId = undefined;
  vi.mocked(cookies).mockImplementation(async () => ({
    get: (name: string) =>
      name === 'gurupro_session' && sessionUserId
        ? { value: JSON.stringify({ id: sessionUserId, role: 'guru', activeContext: 'institution' }) }
        : undefined,
    set: () => {},
  }));
});

describe('Fitur Share Nilai ke Wali Kelas', () => {
  describe('Bagian A - Share ke Wali Kelas via Kontak Eksternal', () => {
    it('Harus bisa generate excel dengan contentType ekskul', async () => {
      vi.mocked(getKontakByLinkToken).mockResolvedValueOnce({
        id: VALID_UUID,
        kelas_id: mockKelasId,
        otp_expired_at: futureISO,
      } as any);
      vi.mocked(isOtpVerified).mockResolvedValueOnce(true);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'pe-1', nama_siswa: 'Siswa A', nama_ekskul: 'Pramuka', predikat: 'baik', deskripsi: 'Aktif' },
        ],
      });

      const response = await generateExcel(makeReq({ token: mockToken, contentType: 'ekskul' }) as any);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('rows');
      expect(data).toHaveProperty('totalSiswa');
      expect(data.contentType).toBe('ekskul');
    });

    it('Harus bisa generate pdf dengan contentType raport', async () => {
      vi.mocked(getKontakByLinkToken).mockResolvedValueOnce({
        id: VALID_UUID,
        kelas_id: mockKelasId,
        otp_expired_at: futureISO,
      } as any);
      vi.mocked(isOtpVerified).mockResolvedValueOnce(true);
      vi.mocked(getDataRaportForKelas).mockResolvedValueOnce([
        {
          id: VALID_UUID,
          nama_siswa: 'Siswa A',
          nisn: '1234567890',
          nomor_absen: 1,
          nama_kelas: 'X.1',
          nama_template: 'Template Kurmer',
          periode: '2025/2026-ganjil',
        },
      ] as any);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await generatePdf(makeReq({ token: mockToken, contentType: 'raport' }) as any);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('pdfData');
      expect(data).toHaveProperty('totalSiswa');
      expect(data.contentType).toBe('raport');
    });

    it('Harus bisa membuat kontak eksternal dengan role wali_kelas', async () => {
      vi.mocked(createKontakEksternal).mockResolvedValueOnce({
        success: true,
        id: VALID_UUID,
        linkToken: mockToken,
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ nama_kelas: 'X.1' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ nama_lengkap: 'Guru Matematika' }] });
      vi.mocked(generateKontakEksternalLinkEmail).mockReturnValueOnce({
        subject: 'Link Akses Data Nilai',
        html: '<p>link</p>',
      });
      mockSendEmail.mockResolvedValueOnce({ success: true });
      mockSendWhatsApp.mockResolvedValueOnce({ success: true });

      const response = await kontakEksternal(
        makeReq(
          {
            guruMapelMemberId: mockGuruMapelMemberId,
            namaKontak: 'Wali Kelas Test',
            kontakWA: '+6281234567890',
            kontakEmail: 'wali.kelas@test.com',
            kelasId: mockKelasId,
            role: 'wali_kelas',
          },
          'http://localhost:3000/api/raport/kontak-eksternal'
        ) as any
      );
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('linkToken');
    });
  });

  describe('Bagian B - Kirim ke Wali Kelas Internal', () => {
    it('Harus bisa kirim notifikasi internal ke wali kelas', async () => {
      sessionUserId = mockGuruMapelMemberId;
      vi.mocked(getPayload).mockResolvedValueOnce({
        find: async () => ({ docs: [{ id: mockGuruMapelMemberId }] }),
      } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ guru_mapel_member_id: mockGuruMapelMemberId }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ nama: '2025/2026-ganjil' }] });
      mockGetWaliKelasForKelas.mockResolvedValueOnce({
        waliKelasMemberId: mockWaliKelasMemberId,
        guru: { id: VALID_UUID },
      } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ nama_siswa: 'Siswa A' }] });
      mockSendInAppNotification.mockResolvedValueOnce(undefined as any);

      const response = await internalNotif(
        makeReq(
          {
            siswaId: mockSiswaId,
            kelasId: mockKelasId,
            contentType: 'raport',
            dataId: mockDataId,
            periode: '2025/2026-ganjil',
          },
          'http://localhost:3000/api/internal-notifications/nilai-to-wali-kelas'
        ) as any
      );
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('Wali Kelas');
    });

    it('Harus gagal jika user tidak memiliki izin', async () => {
      sessionUserId = mockGuruMapelMemberId;
      vi.mocked(getPayload).mockResolvedValueOnce({
        find: async () => ({ docs: [{ id: mockGuruMapelMemberId }] }),
      } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ guru_mapel_member_id: 'guru-lain' }] });

      const response = await internalNotif(
        makeReq(
          {
            siswaId: mockSiswaId,
            kelasId: mockKelasId,
            contentType: 'raport',
            dataId: 'invalid_data_id_for_user',
            periode: '2025/2026-ganjil',
          },
          'http://localhost:3000/api/internal-notifications/nilai-to-wali-kelas'
        ) as any
      );
      const data = await response.json();
      expect(response.status).toBe(403);
      expect(data).toHaveProperty('error');
    });

    it('Harus gagal jika wali kelas tidak ditemukan', async () => {
      sessionUserId = mockGuruMapelMemberId;
      vi.mocked(getPayload).mockResolvedValueOnce({
        find: async () => ({ docs: [{ id: mockGuruMapelMemberId }] }),
      } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ nama: '2025/2026-ganjil' }] });
      mockGetWaliKelasForKelas.mockResolvedValueOnce(null);

      const response = await internalNotif(
        makeReq(
          {
            siswaId: mockSiswaId,
            kelasId: 'kelas_tanpa_wali_kelas',
            contentType: 'project',
            dataId: mockDataId,
            periode: '2025/2026-ganjil',
          },
          'http://localhost:3000/api/internal-notifications/nilai-to-wali-kelas'
        ) as any
      );
      const data = await response.json();
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error');
    });
  });

  describe('Validasi RBAC dan Security', () => {
    it('Harus menerapkan financial data exclusion', async () => {
      vi.mocked(getKontakByLinkToken).mockResolvedValueOnce({
        id: VALID_UUID,
        kelas_id: mockKelasId,
        otp_expired_at: futureISO,
      } as any);
      vi.mocked(isOtpVerified).mockResolvedValueOnce(true);
      mockQuery.mockResolvedValueOnce({ rows: [{ school_id: 'sch-1' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ jalur_regulasi: 'kurmer' }] });
      vi.mocked(getPemetaanKolomProfile).mockResolvedValueOnce(null);
      vi.mocked(getDataRaportForKelas).mockResolvedValueOnce([
        { id: VALID_UUID, nama_siswa: 'Siswa A', nisn: '1234567890', nomor_absen: 1 },
      ] as any);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await generateExcel(makeReq({ token: mockToken, contentType: 'raport' }) as any);
      const data = await response.json();
      expect(response.status).toBe(200);

      if (data.rows && data.rows.length > 0) {
        const firstRow = data.rows[0];
        const financialFields = ['gaji', 'honor', 'pembayaran', 'uang', 'biaya', 'tarif', 'fee', 'komisi'];

        for (const field of financialFields) {
          expect(firstRow).not.toHaveProperty(field);
          expect(firstRow).not.toHaveProperty(field.toUpperCase());
          expect(firstRow).not.toHaveProperty(field.toLowerCase());
        }
      }
    });

    it('Harus memvalidasi OTP sebelum memberikan akses data', async () => {
      vi.mocked(getKontakByLinkToken).mockResolvedValueOnce({
        id: VALID_UUID,
        kelas_id: mockKelasId,
        otp_expired_at: futureISO,
      } as any);
      vi.mocked(isOtpVerified).mockResolvedValueOnce(false);

      const response = await generateExcel(
        makeReq({ token: 'expired_or_invalid_token', contentType: 'ekskul' }) as any
      );
      const data = await response.json();
      expect(response.status).toBe(403);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('OTP');
    });
  });
});
