# FEATURE-INVENTORY.md

> **DISCLAIMER**: Dokumen ini adalah hasil discovery dari codebase pada 2026-07-15.
> Daftar fitur di bawah adalah sumber kebenaran utama untuk test suite, BUKAN spesifikasi produk.

## Metodologi Discovery

1. **Navigasi**: Sidebar.tsx (desktop drawer), MenuBar.tsx (desktop horizontal menu)
2. **Routing**: app/(app)/dashboard/* folder structure
3. **API Endpoints**: app/api/* folder structure
4. **Payload CMS Collections**: collections/*.ts
5. **Existing Tests**: tests/*.test.ts

---

## 1. AUTHENTICATION & REGISTRATION

### 1.1 Register Akun Individual
- **UI**: `/app/(auth)/register/page.tsx`
- **API**: `POST /api/auth/register`
- **Collections**: `Users`, `OtpVerifications`
- **Role**: Public
- **Fitur**:
  - Form registrasi (email, password, whatsapp, nama lengkap, username)
  - Validasi input (Zod)
  - OTP verification (Level 1: email verification)
  - PDP consent

### 1.2 Login
- **UI**: `/app/(auth)/login/page.tsx`
- **API**: `POST /api/auth/login`
- **Auth**: NextAuth.js dengan Google OAuth
- **Role**: Public

### 1.3 OTP Verification
- **API**: `POST /api/auth/verify-otp`
- **OTP Types**:
  - Level 1: Email verification (new registration)
  - Level 2: Share-to-principal verification
- **Collections**: `OtpVerifications`
- **Config**: `OTP_VALIDITY_MINUTES = 10`, `OTP_MAX_ATTEMPTS = 5`

### 1.4 Active Context Switching
- **API**: `GET/PUT /api/auth/active-context`
- **Contexts**: `individual` | `{ institutionId: number }`
- **Storage**: Cookie `gurupro_session`

---

## 2. PRESENSI / ATTENDANCE

### 2.1 Presensi Saya
- **UI**: `/app/(app)/attendance/page.tsx` → `/attendance`
- **API**: `POST /api/attendance`, `GET /api/attendance`
- **Collections**: `AttendanceLogs`, `AttendanceSummary`
- **Fitur**:
  - Face capture widget
  - QR scan widget
  - Geo-location validation
  - Browser fingerprint
  - Trust score calculation
- **Edge Cases**:
  - Multi-sekolah (honorer)
  - Late minutes tracking
  - Flag reasons

### 2.2 Presensi Mengajar
- **UI**: `/app/(app)/attendance/teaching/page.tsx` → `/attendance/teaching`
- **API**: `POST /api/teaching-session`
- **Fitur**:
  - Class session tracking
  - Teaching minutes calculation
  - Subject-based breakdown

### 2.3 Pengajuan Izin (Leave Requests)
- **UI**: `/app/(app)/attendance/leave/page.tsx` → `/attendance/leave`
- **API**: `POST /api/leave-requests`, `GET /api/leave-requests`
- **Collections**: `LeaveRequests`
- **Types**: Sakit, Izin, Cuti
- **Approval Flow**: Pending → Approved/Rejected

### 2.4 Laporan Presensi
- **UI**: `/app/(app)/reports/attendance/page.tsx` → `/reports/attendance`
- **API**: `GET /api/attendance/summary`
- **Fitur**:
  - Attendance status (Hadir, Telat, Alpa, Izin, Cuti)
  - Aggregated statistics

### 2.5 Rekap TPG
- **UI**: `/app/(app)/reports/tpg/page.tsx` → `/reports/tpg`
- **API**: `GET /api/attendance/tpg`
- **Fitur**: Rekapitulasi untuk TPG (Tunjangan Profesi Guru)

---

## 3. ADMINISTRASI (DEEP LEARNING SUITE)

### 3.1 AI Silabus
- **UI**: `/dashboard/administrasi?tipe=silabus`
- **API**: `POST /api/silabus/generate`
- **Collections**: `Silabus`
- **Output Schema**: Struktur sesuai ATP/Silabus Permendikdasmen

### 3.2 Program Tahunan (Prota)
- **UI**: `/app/(app)/dashboard/prota/page.tsx`
- **API**: `POST /api/generate-prota`
- **Fitur**: Generate program tahunan dari silabus

### 3.3 Program Semester (Prosem)
- **UI**: `/app/(app)/dashboard/prosem/page.tsx`
- **API**: `POST /api/generate-prosem`
- **Fitur**: Generate program semester

### 3.4 ATP Editor
- **UI**: `/app/(app)/dashboard/atp-editor/page.tsx`
- **API**: `PUT /api/atp`
- **Fitur**: Editor drag-and-drop untuk ATP

### 3.5 AI Modul Ajar
- **UI**: `/dashboard/administrasi?tipe=modul_ajar`
- **API**: `POST /api/modul-ajar/generate`
- **Collections**: `ModulAjar`
- **Output Schema**: Sesuai Permendikdasmen No. 1/2026

### 3.6 AI RPP
- **UI**: `/dashboard/administrasi?tipe=rpp`
- **API**: `POST /api/administrasi/generate`
- **Fitur**: Generate RPP dari AI

### 3.7 AI LKPD
- **UI**: `/dashboard/administrasi?tipe=lkpd`
- **API**: `POST /api/generate-lkpd`
- **Collections**: `LKPD`
- **Fitur**: Lembar Kerja Peserta Didik

### 3.8 AI Bahan Ajar
- **UI**: `/app/(app)/dashboard/bahan-ajar/page.tsx`
- **API**: `POST /api/generate-bahan-ajar`
- **Collections**: `BahanAjar`

### 3.9 Laporan Evaluasi LKPD
- **API**: `POST /api/generate-laporan-evaluasi-lkpd`
- **Collections**: `LaporanEvaluasiLKPD`

### 3.10 Buat Soal AI
- **UI**: `/dashboard?module=soal`
- **API**: `POST /api/generate-soal`, `POST /api/regenerate-soal`
- **Collections**: `Assessments`, `Categories`
- **Fitur**:
  - Multiple choice
  - Essay
  - Validasi output Zod
  - Item analysis

---

## 4. MONITORING

### 4.1 Jurnal Mengajar
- **UI**: `/dashboard?module=jurnal`
- **API**: `POST /api/journals`, `GET /api/journals`
- **Fitur**: Teacher journals
- **Integration**: AI-generated journal entries

### 4.2 Kalender Akademik
- **UI**: `/dashboard?module=kalender`
- **API**: `GET /api/academic-calendar`

### 4.3 Supervisi & Analitik
- **UI**: `/dashboard?module=supervisi_analitik`
- **API**: `GET /api/analytics`

### 4.4 Tugas Harian
- **UI**: `/dashboard?module=tugas_harian`
- **API**: `GET /api/teaching-session`

### 4.5 Pengingat / Scheduler
- **UI**: `/dashboard?module=scheduler`
- **API**: `GET /api/schedules`

---

## 5. AI FEATURES

### 5.1 Chat AI
- **UI**: `/app/(app)/dashboard/chat/page.tsx`
- **API**: `POST /api/chat`
- **Components**: `ChatAdministrasi.tsx`

### 5.2 AI Performance Report
- **UI**: `/app/(app)/dashboard/ai-performance-report/page.tsx`
- **API**: `GET /api/ai-monitoring`

### 5.3 Selesai Mengajar
- **Components**: `components/ai/SelesaiMengajarModal.tsx`
- **API**: `POST /api/selesai-mengajar`
- **Fitur**:
  - Auto-generate jurnal
  - Update ATP
  - Generate next materi
  - Update memory

---

## 6. BUKU NILAI

- **UI**: `/dashboard?module=nilai`
- **API**: `POST /api/penilaian-sikap`, `GET /api/assessments`
- **Collections**: Students, Assessments
- **Fitur**:
  - Input nilai
  - Sikap (Spiritual & Sosial)
  - Ekstrakurikuler
  - Validasi Zod schema

---

## 7. E-RAPORT

### 7.1 Raport Status
- **UI**: `/app/(app)/dashboard/raport-status/page.tsx`
- **API**: `GET /api/raport`

### 7.2 Review Nilai Raport
- **UI**: `/app/(app)/dashboard/rapor-review/page.tsx`
- **API**: `GET /api/raport/review`

### 7.3 Layout Raport
- **UI**: `/app/(app)/dashboard/layout-raport/page.tsx`
- **Components**: `components/raport/LayoutBuilder.tsx`
- **API**: `GET/PUT /api/template-raport`
- **Fitur**:
  - Drag-and-drop layout builder
  - Template management
  - 3-layer architecture (template → data → output)

### 7.4 Narasi AI
- **API**: AI-generated narration

### 7.5 Export
- **API**: `POST /api/raport/export`
- **Formats**: Excel, PDF

---

## 8. LAPORAN

### 8.1 Laporan Harian
- **UI**: `/app/(app)/dashboard/laporan-harian/page.tsx`
- **API**: `GET /api/laporan-harian`

### 8.2 Laporan Kinerja
- **UI**: `/app/(app)/dashboard/laporan-kinerja/page.tsx`
- **API**: `GET /api/laporan-kinerja`
- **Sub-pages**:
  - Buat Baru: `/dashboard/laporan-kinerja/buat`
  - Observasi: `/dashboard/laporan-kinerja/observasi`
  - SKP: `/dashboard/laporan-kinerja/skp`

### 8.3 Evidence
- **UI**: `/app/(app)/dashboard/evidence/page.tsx`
- **API**: `GET /api/evidence`
- **Fitur**:
  - Evidence scoring, missing evidence alerts

---

## 9. PENGEMBANGAN DIRI

- **UI**: `/app/(app)/dashboard/pengembangan-diri/page.tsx`
- **API**: `GET /api/pelatihan`
- **Fitur**:
  - Daftar kegiatan
  - Sertifikat
  - Upload dokumen

---

## 10. WALI KELAS

- **UI**: `/app/(app)/dashboard/wali-kelas/page.tsx`
- **API**: `GET /api/wali-kelas`
- **Sub-tabs**:
  - Dashboard
  - Siswa
  - Catatan Wali Kelas
  - Laporan Wali Kelas
- **Collections**: `Students`, wali-kelas assignments

---

## 11. PEMBINA ESKUL

- **UI**: `/app/(app)/dashboard/pembina-ekskul/page.tsx`
- **API**: `GET /api/ekstrakurikuler`
- **Sub-tabs**:
  - Dashboard
  - Daftar Kegiatan
  - Penilaian
  - Laporan

---

## 12. MASTER DATA (SEKOLAH)

- **UI**: `/dashboard?module=sekolah`
- **API**: `GET /api/schools`, `POST /api/schools`
- **Fitur**:
  - CRUD kelas
  - CRUD mata pelajaran
  - CRUD siswa
  - CRUD jadwal

---

## 13. INSTITUSI / INSTITUTION LAYER

### 13.1 Manajemen Institusi
- **UI**: `/app/(app)/dashboard/institution/page.tsx`
- **API**: `GET /api/institutions`

### 13.2 Operator Panel
- **UI**: `/app/(app)/dashboard/institution/[institutionId]/operator/page.tsx`
- **Collections**: `Institutions`, `InstitutionMembers`

### 13.3 RBAC Roles
- `kepala_sekolah` - Akses penuh
- `wakasek` - Akses terbatas
- `operator` - Kelola anggota
- `admin_sekolah` - Kelola data
- `bendahara` - Keuangan saja
- `guru` - Akses dasar

### 13.4 Invite Flow
- **API**: `POST /api/institutions/members/invite`
- **Accept/Reject**: `/api/institutions/members/[memberId]/accept|reject`

### 13.5 Leader View
- **UI**: `/app/leader-view/*`
- **Fitur**:
  - Performance share links
  - Document access grants
  - WhatsApp/email notifications

---

## 14. BILLING & TOKEN SYSTEM

### 14.1 Billing
- **UI**: `/app/(app)/dashboard/billing/page.tsx`
- **API**: `GET /api/addon-packages`, `POST /api/checkout`

### 14.2 Token System
- **API**: `GET /api/user/token-status`
- **Collections**: `AddonTokenPackages`
- **Fitur**:
  - Main token (bulanan, reset)
  - Addon token (eceran, persist)
  - Grace period 14 hari
  - Subscription tiers (free, 3 bulan, 1 tahun)

### 14.3 Storage
- **API**: `POST /api/storage`
- **Fitur**: Upload/download, quota limits

---

## 15. KOMUNIKASI

### 15.1 Chatbot
- **Components**: `components/landing/ChatbotWidget.tsx`
- **Collections**: `ChatbotConfig`

### 15.2 Share to Principal
- **API**: `POST /api/performance-share`
- **Collections**: `PerformanceShareLinks`
- **Fitur**:
  - WhatsApp/Email
  - Level 1 (summary only)
  - Level 2 (document access)
  - Leader contact matching

### 15.3 Leader Contacts
- **Collections**: `LeaderContacts`
- **API**: `GET /api/leader-contacts`

---

## 16. STORAGE / BRANKAS

- **UI**: `/app/(app)/dashboard/brankas/page.tsx`
- **Components**: `app/components/storage/*`
- **API**: `POST /api/storage/upload`
- **Features**:
  - File management
  - Storage quotas

---

## 17. PENGATURAN

- **UI**: `/app/(app)/settings/page.tsx`
- **API**: `GET /api/user`
- **Fitur**:
  - Profile management
  - Tahun ajaran settings
  - API settings

---

## 18. SHARE NILAI KE WALI KELAS

### 18.1 Share ke Wali Kelas via Kontak Eksternal
- **UI**: Extended `/app/components/performance-share/PerformanceSharePanel.tsx`
- **API**: `POST /api/raport/kontak-eksternal`, `POST /api/raport/eksternal/generate-excel`, `POST /api/raport/eksternal/generate-pdf`
- **Fitur**:
  - Dukungan role `wali_kelas` dalam sistem kontak eksternal
  - Generate Excel dan PDF untuk berbagai jenis konten (raport, ekskul, project)
  - OTP verification untuk akses eksternal
  - Kirim link via WhatsApp/email ke wali kelas

### 18.2 Kirim ke Wali Kelas Internal
- **UI**: `/app/components/internal-notifications/KirimKeWaliKelasButton.tsx`
- **API**: `POST /api/internal-notifications/nilai-to-wali-kelas`
- **Fitur**:
  - Kirim notifikasi internal ke wali kelas dalam institusi yang sama
  - Validasi RBAC ketat antara guru pengirim dan wali kelas penerima
  - Notifikasi in-app tanpa OTP karena pihak-pihak terverifikasi internal
  - Support untuk berbagai jenis nilai (raport, ekskul, project)

---

## EXISTING TEST COVERAGE

| File | Coverage |
|------|----------|
| `tests/institution-permissions.test.ts` | RBAC institution permissions |
| `tests/token-system.test.ts` | Token consumption, grace period |
| `tests/session.test.ts` | Session management, context switching |
| `tests/wali-kelas.test.ts` | Wali kelas assignment logic |
| `tests/regression-flows.test.ts` | End-to-end regression flows |
| `tests/load-test.test.ts` | Load testing |
| `tests/payments.test.ts` | Payment flow |
| `tests/sikap-ekskul.test.ts` | Sikap & ekskul assessment |
| `lib/raport/__tests__/agregatorNilai.test.ts` | Nilai aggregation |

---

## MISSING / NEEDS TESTING

1. **OTP Flow** - Full verification flow (Level 1 & 2)
2. **Face Recognition Attendance** - With mock camera
3. **Geo-location Validation** - With mock GPS
4. **AI Generation Output Validation** - Zod schema validation
5. **Multi-school Attendance** - Honorer with multiple institutions
6. **Anti-fraud Heuristics** - Trust score, flagging
7. **Share-to-Principal** - WhatsApp/Email matching
8. **Upsell Trigger** - 2+ teachers sharing to same contact
9. **Layout Raport Builder** - Drag-and-drop
10. **Export Excel/PDF** - Raport export
11. **Deep Learning Suite** - All AI document generation
12. **Share Nilai ke Wali Kelas** - End-to-end testing for both external and internal flows

---

## API ENDPOINTS INVENTORY

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/verify-otp`
- `GET/PUT /api/auth/active-context`

### User
- `GET /api/me`
- `GET /api/user/token-status`
- `POST /api/user/reset-password`

### Institutions
- `GET /api/institutions`
- `POST /api/institutions/members/invite`
- `POST /api/institutions/members/[memberId]/accept|reject|leave`
- `GET /api/institution/[institutionId]/members`

### Attendance
- `POST /api/attendance`
- `GET /api/attendance`
- `POST /api/teaching-session`
- `POST /api/leave-requests`
- `GET /api/leave-requests`
- `GET /api/attendance/summary`
- `GET /api/attendance/tpg`

### AI Generation
- `POST /api/generate-soal`
- `POST /api/generate-prota`
- `POST /api/generate-prosem`
- `POST /api/generate-lkpd`
- `POST /api/generate-bahan-ajar`
- `POST /api/generate-laporan-evaluasi-lkpd`
- `POST /api/administrasi/generate`
- `POST /api/chat`
- `POST /api/selesai-mengajar`

### Documents
- `GET /api/administrasi`
- `POST /api/administrasi`
- `GET /api/modul-ajar`
- `GET /api/silabus`
- `GET /api/lkpd`
- `GET /api/bahan-ajar`
- `PUT /api/atp`

### Raport
- `GET /api/raport`
- `GET /api/raport/review`
- `GET/PUT /api/template-raport`
- `POST /api/raport/export`

### Reports
- `GET /api/laporan-harian`
- `GET /api/laporan-kinerja`
- `GET /api/evidence`

### Other
- `GET /api/academic-calendar`
- `GET /api/analytics`
- `GET /api/skp`
- `GET /api/chatbot`
- `GET /api/leader-contacts`
- `POST /api/performance-share`
- `GET /api/storage`
- `POST /api/storage/upload`
- `POST /api/raport/kontak-eksternal`
- `POST /api/raport/eksternal/generate-excel`
- `POST /api/raport/eksternal/generate-pdf`
- `POST /api/internal-notifications/nilai-to-wali-kelas`

---

*Generated: 2026-07-15*
