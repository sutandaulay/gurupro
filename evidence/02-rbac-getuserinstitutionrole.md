# Evidence — Temuan RBAC `getUserInstitutionRole` [APPROVAL]

## 2026-08-02 — Bug: query membandingkan tipe yang salah
- Lokasi: `lib/rbac/institution-permissions.ts` `getUserInstitutionRole` (baris ~28-33):
  ```sql
  SELECT imr.value
  FROM institution_members im
  JOIN institution_members_role imr ON imr.parent_id = im.id
  WHERE im.user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
  ```
  `$1` = `session.id` = UUID `users.id`. Namun kolom `im.user_id` = **integer** `payload.cms_users.id`.
  Kolom yang benar untuk mencocokkan UUID user adalah `im.app_user_id`.
- Dampak: `getUserInstitutionRole` selalu mengembalikan kosong untuk SEMUA user →
  semua helper turunannya (`canViewAllTeachers`, `canApproveDocuments`, `canManageMembers`,
  `canManageBilling`, `canExportAccreditation`, `canAccessLaporanEvaluasiLkpd`) return false →
  endpoint yang memakainya 403 tanpa pandang role.
- Bukti runtime:
  - `GET /api/institution/2/laporan-mengajar` dengan session kepala_sekolah TEST_SMA → **403**
  - `GET /api/institution/2/laporan-mengajar` dengan session operator TEST_SMA → **403**
  - (Kontras) `GET /api/institution/2` yang pakai query langsung `im.app_user_id` → operator **200**, kepala_sekolah **403** (sesuai desain karena hanya operator/admin_sekolah).
- Struktur data yang benar (institution 2):
  | member.id | im.user_id (cms.id) | im.app_user_id (users UUID) |
  |---|---|---|
  | 65 | 62 | 4086adf5-... (kepsek-sma) |
  | 66 | 64 | 6b1da475-... (operator-sma) |
  | dst | 62-68 | UUID masing-masing |
- Kategori: RBAC inti → `[APPROVAL]` — TIDAK difix inline. Masuk laporan sebagai blocker RBAC.
- Catatan tambahan: ada inkonsistensi — sebagian query memakai `im.app_user_id` (benar),
  sebagian memakai `im.user_id` (salah). Audit lengkap di Skenario D.

## 2026-08-02 — Keterbatasan OTP/email
- `wa_sender.active=false`, `email_sender.active=false` di `system_settings` →
  semua OTP & email di-simulasikan ke console server (tidak bisa dibaca dari test).
- Akibat: alur verifikasi OTP penuh (register → OTP → verify) TIDAK bisa diuji end-to-end
  via API/UI dari luar. Dilaporkan sebagai "tidak dapat diuji" untuk channel tersebut;
  flow OTP hanya bisa diverifikasi sampai tahap `requiresOtp` (generasi kode berhasil).
