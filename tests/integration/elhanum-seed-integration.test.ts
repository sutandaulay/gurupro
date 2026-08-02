/**
 * Integration Test Suite: ElHanum Seed Data (Real Database)
 *
 * Memvalidasi data seed user "ElHanum, M.Pd" (elhanum) yang dibuat oleh
 * scripts/seed-test-data.ts di seluruh fitur:
 *   - User & Auth
 *   - Sekolah & Kelas
 *   - Wali Kelas (assignment aktif ke X.1)
 *   - Mapel & Jadwal
 *   - Asesmen & Nilai
 *   - Absensi
 *   - Jurnal Mengajar & Supervisi
 *   - SKP, Observasi & Kinerja
 *   - Pelatihan & Dokumen Bukti
 *   - Teaching Sessions
 *   - Transaksi & Payout
 *   - AI Chat & Lesson Memory
 *   - Raport Cache
 *   - RBAC Institusi
 *
 * Semua test read-only terhadap database nyata gurupro_db.
 */

import { describe, it, expect } from 'vitest'
import { query } from '@/lib/db'

const ELHANUM_USER_ID = '50e096cc-9dc2-4403-b731-5506088ddc32'
const ELHANUM_EMAIL = 'ptgenerasidigitalindonesiaemas@gmail.com'
const ELHANUM_SCHOOL_ID = '8606e992-1379-41ef-8834-e834e9312dee'
const ELHANUM_CLASS_ID = 'a70db632-5e6a-4654-8eeb-90646814500d'

// ============================================
// 1. USER & AUTH
// ============================================
describe('ElHanum - User & Auth', () => {
  it('user elhanum exists with correct identity', async () => {
    const res = await query(
      'SELECT id, email, nama_lengkap, role, is_active FROM users WHERE id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows).toHaveLength(1)
    const u = res.rows[0]
    expect(u.email).toBe(ELHANUM_EMAIL)
    expect(u.nama_lengkap).toBe('ElHanum, M.Pd')
    expect(u.role).toBe('guru')
    expect(u.is_active).toBe(true)
  })

  it('user email is registered as CMS user for institution access', async () => {
    const res = await query(
      'SELECT id, email FROM payload.cms_users WHERE email = $1',
      [ELHANUM_EMAIL]
    )
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].email).toBe(ELHANUM_EMAIL)
  })
})

// ============================================
// 2. SEKOLAH & KELAS
// ============================================
describe('ElHanum - Sekolah & Kelas', () => {
  it('sekolah SMA IDEA 1 exists owned by elhanum', async () => {
    const res = await query(
      'SELECT id, nama_sekolah, npsn, user_id FROM schools WHERE id = $1',
      [ELHANUM_SCHOOL_ID]
    )
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].nama_sekolah).toBe('SMA IDEA 1')
    expect(res.rows[0].user_id).toBe(ELHANUM_USER_ID)
  })

  it('kelas X.1 exists in elhanum school', async () => {
    const res = await query(
      'SELECT id, school_id, nama_kelas, wali_kelas FROM classes WHERE id = $1',
      [ELHANUM_CLASS_ID]
    )
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].school_id).toBe(ELHANUM_SCHOOL_ID)
    expect(res.rows[0].nama_kelas).toBe('X.1')
    expect(res.rows[0].wali_kelas).toBe('ElHanum, M.Pd')
  })

  it('sekolah elhanum memiliki minimal 8 kelas SMA', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM classes WHERE school_id = $1',
      [ELHANUM_SCHOOL_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThanOrEqual(8)
  })
})

// ============================================
// 3. WALI KELAS
// ============================================
describe('ElHanum - Wali Kelas', () => {
  it('elhanum memiliki assignment aktif sebagai wali kelas X.1', async () => {
    const res = await query(
      `SELECT kelas_id, wali_kelas_member_id, tahun_ajaran, semester, status
       FROM wali_kelas_assignments
       WHERE wali_kelas_member_id = $1 AND kelas_id = $2`,
      [ELHANUM_USER_ID, ELHANUM_CLASS_ID]
    )
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].status).toBe('aktif')
    expect(res.rows[0].tahun_ajaran).toBe('2025/2026')
    expect(res.rows[0].semester).toBe('ganjil')
  })

  it('kelas X.1 memiliki siswa (termasuk Siswono & Lestari)', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM students WHERE class_id = $1',
      [ELHANUM_CLASS_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThanOrEqual(10)

    const named = await query(
      "SELECT nama_siswa FROM students WHERE class_id = $1 AND nama_siswa IN ('Siswono','Lestari')",
      [ELHANUM_CLASS_ID]
    )
    expect(named.rows).toHaveLength(2)
  })

  it('elhanum memiliki user_school_assignments sebagai wali kelas', async () => {
    const res = await query(
      'SELECT id, "userId", "schoolId", iswalikelas FROM user_school_assignments WHERE "userId" = $1 AND "schoolId" = $2',
      [ELHANUM_USER_ID, ELHANUM_SCHOOL_ID]
    )
    expect(res.rows.length).toBeGreaterThanOrEqual(1)
    expect(res.rows[0].iswalikelas).toBe(true)
  })
})

// ============================================
// 4. MAPEL & JADWAL
// ============================================
describe('ElHanum - Mapel & Jadwal', () => {
  it('sekolah elhanum memiliki 18 mapel SMA', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM subjects WHERE school_id = $1',
      [ELHANUM_SCHOOL_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThanOrEqual(18)
  })

  it('kelas X.1 memiliki jadwal (minimal 5 slot)', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM schedules WHERE class_id = $1',
      [ELHANUM_CLASS_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThanOrEqual(5)
  })

  it('jadwal X.1 terhubung ke mapel & sekolah yang valid', async () => {
    const res = await query(
      `SELECT s.id, s.school_id, s.subject_id
       FROM schedules s WHERE s.class_id = $1 LIMIT 1`,
      [ELHANUM_CLASS_ID]
    )
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].school_id).toBe(ELHANUM_SCHOOL_ID)
    expect(res.rows[0].subject_id).toBeTruthy()
  })
})

// ============================================
// 5. ASESMEN & NILAI
// ============================================
describe('ElHanum - Asesmen & Nilai', () => {
  it('terdapat asesmen untuk siswa kelas X.1', async () => {
    const res = await query(
      `SELECT COUNT(*)::int as cnt FROM assessments a
       JOIN classes c ON a.class_id = c.id
       WHERE c.school_id = $1 AND a.class_id = $2`,
      [ELHANUM_SCHOOL_ID, ELHANUM_CLASS_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThanOrEqual(1)
  })

  it('terdapat nilai (student_grades) untuk siswa X.1', async () => {
    const res = await query(
      `SELECT COUNT(*)::int as cnt FROM student_grades sg
       JOIN assessments a ON sg.assessment_id = a.id
       JOIN students st ON sg.student_id = st.id
       WHERE st.class_id = $1`,
      [ELHANUM_CLASS_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })
})

// ============================================
// 6. ABSENSI
// ============================================
describe('ElHanum - Absensi', () => {
  it('terdapat absensi untuk siswa kelas X.1', async () => {
    const res = await query(
      `SELECT COUNT(*)::int as cnt FROM student_attendance sa
       JOIN students st ON sa.student_id = st.id
       WHERE st.class_id = $1`,
      [ELHANUM_CLASS_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('status absensi valid (Hadir/Izin/Sakit/Alpa)', async () => {
    const res = await query(
      `SELECT DISTINCT status FROM student_attendance sa
       JOIN students st ON sa.student_id = st.id
       WHERE st.class_id = $1`,
      [ELHANUM_CLASS_ID]
    )
    const statuses = res.rows.map((r: any) => r.status)
    const valid = ['Hadir', 'Izin', 'Sakit', 'Alpa']
    expect(statuses.every((s: string) => valid.includes(s))).toBe(true)
  })
})

// ============================================
// 7. JURNAL MENGAJAR & SUPERVISI
// ============================================
describe('ElHanum - Jurnal Mengajar', () => {
  it('elhanum memiliki jurnal mengajar', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM teacher_journals WHERE user_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('jurnal elhanum memiliki status valid', async () => {
    const res = await query(
      "SELECT DISTINCT status FROM teacher_journals WHERE user_id = $1",
      [ELHANUM_USER_ID]
    )
    const statuses = res.rows.map((r: any) => r.status)
    const valid = ['Draft', 'Submitted', 'Reviewed', 'Approved']
    expect(statuses.every((s: string) => valid.includes(s))).toBe(true)
  })

  it('sekolah elhanum memiliki journal schema standar', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM journal_schemas WHERE school_id = $1',
      [ELHANUM_SCHOOL_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThanOrEqual(1)
  })

  it('terdapat academic calendar untuk sekolah elhanum', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM academic_calendars WHERE school_id = $1',
      [ELHANUM_SCHOOL_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })
})

// ============================================
// 8. SKP, OBSERVASI & KINERJA
// ============================================
describe('ElHanum - SKP & Kinerja', () => {
  it('elhanum memiliki SKP tahunan', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM skp_tahunan WHERE guru_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('SKP elhanum memiliki indikator', async () => {
    const res = await query(
      `SELECT COUNT(*)::int as cnt FROM skp_indikator si
       JOIN skp_tahunan st ON si.skp_id = st.id
       WHERE st.guru_id = $1`,
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('elhanum memiliki laporan kinerja', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM laporan_kinerja WHERE guru_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('elhanum memiliki observasi kinerja', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM observasi_kinerja WHERE guru_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('terdapat indikator kinerja config aktif', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM indikator_kinerja_config WHERE is_active = true'
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })
})

// ============================================
// 9. PELATIHAN & DOKUMEN BUKTI
// ============================================
describe('ElHanum - Pelatihan & Dokumen', () => {
  it('elhanum memiliki data pelatihan guru', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM pelatihan_guru WHERE guru_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('elhanum memiliki dokumen bukti', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM dokumen_bukti WHERE guru_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('terdapat evidence log', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM evidence_log WHERE guru_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })
})

// ============================================
// 10. TEACHING SESSIONS
// ============================================
describe('ElHanum - Teaching Sessions', () => {
  it('elhanum memiliki teaching sessions', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM teaching_sessions WHERE user_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('elhanum memiliki school teaching sessions', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM school_teaching_sessions WHERE user_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })
})

// ============================================
// 11. TRANSAKSI & PAYOUT
// ============================================
describe('ElHanum - Transaksi & Payout', () => {
  it('elhanum memiliki transaksi', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM transactions WHERE user_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('status transaksi valid (PENDING/PAID/FAILED/ACTIVATED)', async () => {
    const res = await query(
      'SELECT DISTINCT status FROM transactions WHERE user_id = $1',
      [ELHANUM_USER_ID]
    )
    const statuses = res.rows.map((r: any) => r.status)
    const valid = ['PENDING', 'PAID', 'FAILED', 'ACTIVATED']
    expect(statuses.every((s: string) => valid.includes(s))).toBe(true)
  })
})

// ============================================
// 12. AI CHAT & LESSON MEMORY
// ============================================
describe('ElHanum - AI & Memori', () => {
  it('terdapat ai chat logs untuk elhanum', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM ai_chat_logs WHERE user_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('elhanum memiliki lesson memories', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM lesson_memories WHERE user_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })
})

// ============================================
// 13. RAPORT CACHE
// ============================================
describe('ElHanum - Raport Cache', () => {
  it('terdapat raport cache untuk siswa X.1', async () => {
    const res = await query(
      `SELECT COUNT(*)::int as cnt FROM raport_cache rc
       JOIN students st ON rc.student_id = st.id
       WHERE st.class_id = $1`,
      [ELHANUM_CLASS_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })
})

// ============================================
// 14. RBAC INSTITUSI
// ============================================
describe('ElHanum - RBAC Institusi', () => {
  it('elhanum adalah anggota aktif institution sebagai guru', async () => {
    const res = await query(
      `SELECT im.id, im.institution_id, im.status, r.value as role
       FROM payload.institution_members im
       JOIN payload.institution_members_role r ON r.parent_id = im.id
       JOIN users u ON u.id::text = im.app_user_id
       WHERE u.id = $1`,
      [ELHANUM_USER_ID]
    )
    expect(res.rows.length).toBeGreaterThan(0)
    const active = res.rows.filter((r: any) => r.status === 'active')
    expect(active.length).toBeGreaterThan(0)
    const roles = active.map((r: any) => r.role)
    expect(roles).toContain('guru')
  })

  it('terdapat tahun ajaran aktif', async () => {
    const res = await query(
      'SELECT id, nama, is_active FROM tahun_ajaran WHERE is_active = true LIMIT 1'
    )
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].is_active).toBe(true)
  })

  it('terdapat admin tasks untuk elhanum', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM admin_tasks WHERE user_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('terdapat duty assignments untuk elhanum', async () => {
    const res = await query(
      'SELECT COUNT(*)::int as cnt FROM duty_assignments WHERE teacher_id = $1',
      [ELHANUM_USER_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })

  it('terdapat catatan wali kelas untuk siswa X.1', async () => {
    const res = await query(
      `SELECT COUNT(*)::int as cnt FROM catatan_wali_kelas cwk
       JOIN students st ON cwk.siswa_id = st.id
       WHERE st.class_id = $1`,
      [ELHANUM_CLASS_ID]
    )
    expect(res.rows[0].cnt).toBeGreaterThan(0)
  })
})
