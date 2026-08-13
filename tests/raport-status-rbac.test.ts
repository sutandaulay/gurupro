/**
 * Test Suite: RBAC Wali Kelas pada POST /api/raport/status
 *
 * Acceptance criteria: status raport HANYA bisa diubah oleh wali kelas kelas tsb.
 * Otoritas diturunkan dari session (server), bukan klaim role di body — jadi
 * mengirim changed_by_role='admin'/'guru_mapel' pun tetap 403 untuk kelas bukan
 * tanggung jawabnya.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSignedSessionCookie } from '@/lib/session-sign';

vi.mock('@/lib/db', () => ({ query: vi.fn(), logAudit: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/raport/repository', () => ({ ubahStatus: vi.fn() }));
vi.mock('@/lib/wali-kelas/dashboard', () => ({ getOwnedWaliKelasClassIds: vi.fn() }));
vi.mock('@/lib/school-access', () => ({ requireSchoolAccess: vi.fn() }));

import { cookies } from 'next/headers';
import { query, logAudit } from '@/lib/db';
import { ubahStatus } from '@/lib/raport/repository';
import { getOwnedWaliKelasClassIds } from '@/lib/wali-kelas/dashboard';
import { GET, POST } from '@/app/api/raport/status/route';
const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;
const mockQuery = query as unknown as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as unknown as ReturnType<typeof vi.fn>;
const mockUbahStatus = ubahStatus as unknown as ReturnType<typeof vi.fn>;
const mockOwnedClasses = getOwnedWaliKelasClassIds as unknown as ReturnType<typeof vi.fn>;

const KELAS_WALI = '11111111-1111-4111-8111-111111111111';
const KELAS_LAIN = '22222222-2222-4222-8222-222222222222';
const RAPORT_WALI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RAPORT_LAIN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makePost(raportId: string, newStatus = 'dikonfirmasi') {
  return new Request('http://localhost:3000/api/raport/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data_raport_id: raportId,
      new_status: newStatus,
      changed_by_role: 'wali_kelas',
    }),
  });
}

function mockSession(userId: string) {
  mockCookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: buildSignedSessionCookie({ id: userId, role: 'guru' }) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession('wali-a');
});

describe('POST /api/raport/status — RBAC wali kelas', () => {
  it('return 401 jika tidak ada session', async () => {
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });

    const res = await POST(makePost(RAPORT_WALI));

    expect(res.status).toBe(401);
  });

  it('return 400 untuk status tidak valid', async () => {
    const res = await POST(makePost(RAPORT_WALI, 'status_ngawur'));

    expect(res.status).toBe(400);
    expect(mockUbahStatus).not.toHaveBeenCalled();
  });

  it('return 404 jika data raport tidak ditemukan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await POST(makePost(RAPORT_WALI));

    expect(res.status).toBe(404);
    expect(mockUbahStatus).not.toHaveBeenCalled();
  });

  it('403 jika wali kelas A mengubah status raport kelas B (institusi sama)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ kelas_id: KELAS_LAIN }] });
    mockOwnedClasses.mockResolvedValue([KELAS_WALI]);

    const res = await POST(makePost(RAPORT_LAIN));

    expect(res.status).toBe(403);
    // Status TIDAK boleh diubah untuk kelas yang bukan tanggung jawabnya
    expect(mockUbahStatus).not.toHaveBeenCalled();
  });

  it('403 meskipun klaim role body adalah "admin" (role dari client tidak dihormati)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ kelas_id: KELAS_LAIN }] });
    mockOwnedClasses.mockResolvedValue([KELAS_WALI]);

    const req = new Request('http://localhost:3000/api/raport/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data_raport_id: RAPORT_LAIN,
        new_status: 'difinalisasi',
        changed_by_role: 'admin',
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockUbahStatus).not.toHaveBeenCalled();
  });

  it('403 meskipun klaim role body adalah "guru_mapel" (role dari client tidak dihormati)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ kelas_id: KELAS_LAIN }] });
    mockOwnedClasses.mockResolvedValue([KELAS_WALI]);

    const req = new Request('http://localhost:3000/api/raport/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data_raport_id: RAPORT_LAIN,
        new_status: 'dikirim_ke_wali_kelas',
        changed_by_role: 'guru_mapel',
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockUbahStatus).not.toHaveBeenCalled();
  });

  it('200 dan role tercatat "wali_kelas" walau body tidak menyertakan changed_by_role', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ kelas_id: KELAS_WALI }] });
    mockOwnedClasses.mockResolvedValue([KELAS_WALI]);
    mockUbahStatus.mockResolvedValue({ success: true });

    const req = new Request('http://localhost:3000/api/raport/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data_raport_id: RAPORT_WALI,
        new_status: 'dikonfirmasi',
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockUbahStatus).toHaveBeenCalledWith(RAPORT_WALI, 'dikonfirmasi', 'wali-a', 'wali_kelas');
  });

  it('200 jika wali kelas mengubah status raport kelas miliknya sendiri', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ kelas_id: KELAS_WALI }] });
    mockOwnedClasses.mockResolvedValue([KELAS_WALI]);
    mockUbahStatus.mockResolvedValue({ success: true });

    const res = await POST(makePost(RAPORT_WALI));

    expect(res.status).toBe(200);
    expect(mockUbahStatus).toHaveBeenCalledWith(RAPORT_WALI, 'dikonfirmasi', 'wali-a', 'wali_kelas');
    expect(mockLogAudit).toHaveBeenCalled();
  });

  it('400 dengan pesan validasi jika ubahStatus menolak (nilai mapel belum dikonfirmasi guru)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ kelas_id: KELAS_WALI }] });
    mockOwnedClasses.mockResolvedValue([KELAS_WALI]);
    mockUbahStatus.mockResolvedValue({
      success: false,
      error: 'Masih ada 2 nilai mapel yang belum dikonfirmasi guru',
    });

    const res = await POST(makePost(RAPORT_WALI));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('belum dikonfirmasi');
  });
});

describe('GET /api/raport/status — scoping wali kelas', () => {
  function makeGet(params = '') {
    return new Request(`http://localhost:3000/api/raport/status${params ? `?${params}` : ''}`);
  }

  it('return 401 jika tidak ada session', async () => {
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });

    const res = await GET(makeGet());

    expect(res.status).toBe(401);
  });

  it('return daftar kosong jika user bukan wali kelas (tidak punya kelas)', async () => {
    mockOwnedClasses.mockResolvedValue([]);

    const res = await GET(makeGet('kelas_id=' + KELAS_WALI));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data ?? []).toHaveLength(0);
  });

  it('hanya memfilter query ke kelas yang dimiliki user sebagai wali kelas', async () => {
    mockOwnedClasses.mockResolvedValue([KELAS_WALI]);
    mockQuery.mockResolvedValueOnce({
      rows: [{
        raport_exists: true,
        template_exists: true,
        students_exists: true,
        classes_exists: true,
      }],
    }); // tableCheck
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] }); // count
    mockQuery.mockResolvedValueOnce({ rows: [{ id: RAPORT_WALI }] }); // list

    const res = await GET(makeGet('kelas_id=' + KELAS_WALI));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);

    // Query harus mencakup filter kepemilikan (ANY(ownedClassIds)) + filter kelas.
    const listCall = mockQuery.mock.calls.find(
      (c: any) => String(c[0]).includes('FROM data_raport dr') && String(c[0]).includes('ORDER BY')
    );
    expect(listCall).toBeDefined();
    expect(String(listCall![0])).toContain('ANY($1::uuid[])');
    expect(listCall![1][0]).toEqual([KELAS_WALI]);
  });
});
