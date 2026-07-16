import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { query } from '@/lib/db';
import { getWaliKelasForKelas } from '@/lib/wali-kelas';
import { sendInAppNotification } from '@/lib/raport/notifications';

// Mock data untuk testing
const mockSiswaId = 'test_siswa_id';
const mockKelasId = 'test_kelas_id';
const mockGuruMapelMemberId = 'test_guru_member_id';
const mockWaliKelasMemberId = 'test_wali_kelas_member_id';
const mockToken = 'test_valid_token';
const mockDataId = 'test_data_id';

describe('Fitur Share Nilai ke Wali Kelas', () => {
  describe('Bagian A - Share ke Wali Kelas via Kontak Eksternal', () => {
    it('Harus bisa generate excel dengan contentType ekskul', async () => {
      // Mock request ke endpoint generate-excel
      const response = await fetch('/api/raport/eksternal/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: mockToken,
          contentType: 'ekskul'
        })
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('rows');
      expect(data).toHaveProperty('totalSiswa');
      expect(data.contentType).toBe('ekskul');
    });

    it('Harus bisa generate pdf dengan contentType raport', async () => {
      // Mock request ke endpoint generate-pdf
      const response = await fetch('/api/raport/eksternal/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: mockToken,
          contentType: 'raport'
        })
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('pdfData');
      expect(data).toHaveProperty('totalSiswa');
      expect(data.contentType).toBe('raport');
    });

    it('Harus bisa membuat kontak eksternal dengan role wali_kelas', async () => {
      // Mock request ke endpoint kontak-eksternal
      const response = await fetch('/api/raport/kontak-eksternal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guruMapelMemberId: mockGuruMapelMemberId,
          namaKontak: 'Wali Kelas Test',
          kontakWA: '+6281234567890',
          kontakEmail: 'wali.kelas@test.com',
          kelasId: mockKelasId,
          role: 'wali_kelas'
        })
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('linkToken');
    });
  });

  describe('Bagian B - Kirim ke Wali Kelas Internal', () => {
    it('Harus bisa kirim notifikasi internal ke wali kelas', async () => {
      // Mock request ke endpoint internal notifikasi
      const response = await fetch('/api/internal-notifications/nilai-to-wali-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswaId: mockSiswaId,
          kelasId: mockKelasId,
          contentType: 'ekskul',
          dataId: mockDataId,
          periode: '2025/2026-ganjil'
        })
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('Wali Kelas');
    });

    it('Harus gagal jika user tidak memiliki izin', async () => {
      // Mock request dengan dataId yang bukan milik user
      const response = await fetch('/api/internal-notifications/nilai-to-wali-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswaId: mockSiswaId,
          kelasId: mockKelasId,
          contentType: 'raport',
          dataId: 'invalid_data_id_for_user',
          periode: '2025/2026-ganjil'
        })
      });

      const data = await response.json();
      expect(response.status).toBe(403);
      expect(data).toHaveProperty('error');
    });

    it('Harus gagal jika wali kelas tidak ditemukan', async () => {
      // Mock request ke kelas tanpa wali kelas
      const response = await fetch('/api/internal-notifications/nilai-to-wali-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswaId: mockSiswaId,
          kelasId: 'kelas_tanpa_wali_kelas',
          contentType: 'project',
          dataId: mockDataId,
          periode: '2025/2026-ganjil'
        })
      });

      const data = await response.json();
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error');
    });
  });

  describe('Validasi RBAC dan Security', () => {
    it('Harus menerapkan financial data exclusion', async () => {
      // Endpoint generate excel/pdf tidak boleh mengembalikan data keuangan
      const response = await fetch('/api/raport/eksternal/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: mockToken,
          contentType: 'raport'
        })
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      
      // Pastikan tidak ada field yang terkait dengan keuangan
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
      // Request tanpa OTP terverifikasi harus ditolak
      const response = await fetch('/api/raport/eksternal/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'expired_or_invalid_token',
          contentType: 'ekskul'
        })
      });

      const data = await response.json();
      expect(response.status).toBe(403);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('OTP');
    });
  });
});