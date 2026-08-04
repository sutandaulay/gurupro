# Evidence GuruPRO AI — Baseline (Awal Kampanye)

Tanggal: 2026-08-02 (waktu lokal server)
Server: `http://localhost:3000` (Next 16.2.9, dev, turbopack), DB connected.

## 1. Jumlah Row per Tabel Relevan (public schema)

| Tabel | Rows | Tabel | Rows |
|---|---|---|---|
| student_attendance | 9.940 | assessments | 100 |
| students | 895 | teaching_sessions | 100 |
| schedules | 386 | evidence_log | 80 |
| student_grades | 300 | school_teaching_sessions | 80 |
| teacher_attendance | 240 | journal_supervisions | 66 |
| teacher_journals | 120 | catatan_wali_kelas | 55 |
| raport_cache | 53 | ai_chat_logs | 50 |
| data_raport_nilai_mapel | 50 | data_raport | 50 |
| data_raport_status_history | 50 | wali_kelas_assignments | 49 |
| classes | 49 | subjects | 43 |
| guru_administrasi | 40 | penilaian_sikap | 40 |
| skp_indikator | 40 | question_banks | 32 |
| observasi_indikator | 32 | absent_alerts | 30 |
| admin_tasks | 24 | dokumen_bukti | 20 |
| academic_calendars | 20 | duty_assignments | 20 |
| pelatihan_guru | 16 | attendance_logs | 16 |
| indikator_kinerja_config | 15 | TokenUsage | 12 |
| audit_trails | 11 | GeminiCache | 10 |
| ekstrakurikuler | 10 | otp_verifications | 9 |
| user_school_assignments | 8 | users | 8 |
| tahun_ajaran | 6 | transactions | 4 |
| institutions (payload) | 4 | institution_members (payload) | 7 |
| institution_members_role (payload) | 9 | teacher_institution_assignments (payload) | 8 |

Catatan: `payload.lkpd`, `payload.modul_ajar`, `payload.bahan_ajar`, `payload.silabus`,
`payload.performance_share_links`, `payload.invitations`, `payload.media` = 0 rows.
`public.poin_transactions`, `public.poin_ledger`, `public.poin_ratio_audit` = 0 rows (belum dicek sat-set).

## 2. User TEST (baseline)

| Email | Role | Status | is_active | Login attempts | Locked | Subscription | Grace end | Poin |
|---|---|---|---|---|---|---|---|---|
| TEST_guru-1tahun@test.gurupro.id | guru | active | t | 1 | f | 2025-06-28 → 2026-08-01 | 2026-08-16 | used 0 |
| TEST_guru-3bulan@test.gurupro.id | guru | active | t | 1 | f | 2026-08-02 → 2026-10-31 | — | used 0 |
| TEST_guru-free@test.gurupro.id | guru | free | t | 0 | f | 2026-08-02 → 2026-09-01 | — | used 0 |
| test_guru-free@test.gurupro.id | guru | free | t | 5 | **t (terkunci)** | 2026-08-02 → 2026-09-01 | — | total 5, used 0 |
| reg_1785675936872@test.gurupro.id | guru | free | t | 0 | f | 2026-08-02 → 2026-09-01 | — | total 5, used 0 |
| admin@gurupro.id | super_admin | premium | t | 0 | f | 2026-07-17 → 2027-07-17 | — | total 5 |
| guru.test@idea1.sch.id | guru | active | t | 0 | f | 2026-07-30 → 2027-07-30 | — | total 10.000 |
| ptgenerasidigitalindonesiaemas@gmail.com | guru | active | t | 0 | f | 2026-08-02 → 2027-08-02 | — | — |

Catatan: password login TEST_* = `test123` (diverifikasi via API untuk 3bulan & 1tahun).
`test_guru-free` TERKUNCI (lockout) — sisa dari pengujian sebelumnya.

## 3. Response Time Endpoint Kunci (1 request panas, dev mode)

Session: guru TEST_guru-3bulan (c08eb4c7...), activeContext=individual.

| Endpoint | Status | Waktu (ms) | Len (byte) |
|---|---|---|---|
| GET /api/health | 200 | 483 | 90 |
| GET /api/pricing | 200 | 1.004 | 1.542 |
| POST /api/auth/login (test123) | 200 | 512 | — |
| GET /api/me | 200 | 877 | 339 |
| GET /api/students?class_id=VII-A | 200 | 137 | 2.594 |
| GET /api/subjects?school_id=TEST_SMP | 200 | 73 | 2.769 |
| GET /api/classes?school_id=TEST_SMP | 200 | 78 | 5.348 |
| GET /api/schedules?school_id=TEST_SMP | 200 | 336 | 130.744 |
| GET /api/selesai-mengajar | 200 | 352 | 34 |
| GET /api/raport/status | 200 | 5.965 | 15.775 |
| GET /api/user/token-status | 200 | 68 | 581 |
| GET /api/aggregated-stats | 400 | 43 | — (butuh param) |

Catatan: `GET /api/raport/status` = ~6 detik → kandidat lambat, cek query count N+1.

## 4b. Tenant / Institution Membership (baseline)

| Institution | Members |
|---|---|
| 1 TEST_SMP Negeri 1 Test (TEST_0001) | ElHanum (admin_sekolah), TEST_guru-1tahun (operator), TEST_guru-free (kepala_sekolah+bendahara), TEST_guru-3bulan (wakasek+guru) |
| 2 TEST_SMA Negeri 1 Test (TEST_0002) | ElHanum (guru) |
| 3 SMP 3 DEPOK | ElHanum (guru) |
| 4 SMA IDEA 1 | ElHanum (guru) |

Catatan:
- ElHanum = user 1 di 4 institusi (konteks multi-sekolah aktif).
- `payload.invitations` = 0 → belum ada undangan yang pernah dibuat/diproses.
- `teacher_institution_assignments` (payload) = 8, `institution_members_role` = 9.
- `poin_transactions`, `poin_ledger`, `poin_ratio_audit` = 0 → belum ada transaksi Poin sama sekali.
- `TokenUsage` = 12, `ai_chat_logs` = 50 → sudah ada jejak penggunaan AI (kemungkinan dari pengujian/setup sebelumnya).

## 4. Sekolah/Institusi yang Ada (baseline)

| Tabel | Isi |
|---|---|
| public.schools | SMP 3 DEPOK (NPSN 45344345), TEST_SMP Negeri 1 Jakarta (NPSN TEST_0001), SMA IDEA 1 (NPSN 20202020) |
| payload.institutions | 4 (termasuk TEST_SMP? — perlu rinci) |
| Classes TEST_SMP | VII-A, VII-B, VIII-A, VIII-B, IX-A |
| Subjects TEST_SMP | Matematika, B.Indonesia, B.Inggris, IPA, IPS, PAI, Pancasila, Seni, Prakarya |

## 5. Temuan CRITICAL yang Dikonfirmasi (untuk laporan, ranah approval)

- **CRITICAL-0**: cookie `gurupro_session` = JSON URL-encoded TANPA signature (contoh langsung dari login API):
  `gurupro_session={"id":"...","role":"guru","activeContext":"individual"}` → forgeable.
- **CRITICAL-1**: `proxy.ts` `protectedApiPaths` tidak direferensikan; semua /api/* tanpa proteksi middleware.
- **CRITICAL-2**: `POST /api/checkout` menerima userId dari body tanpa verifikasi = sesi.
- Endpoint lambat awal: `/api/raport/status` (~6s).
