# Modul Autentikasi: Register & Login (GuruPRO AI — Individual + Institution Dual-Mode)

## 1. Konteks Arsitektur
- **Stack**: Next.js 16 (webpack), Payload CMS 3.x, PostgreSQL (Drizzle ORM).
- Arsitektur dual-mode: subscription individual (guru mandiri) tetap utuh, layer institusi strictly additive.
- Sistem OTP untuk verifikasi akun terintegrasi ke `payload.otp_verifications` dengan field `purpose`.

## 2. Skema & Database
- `public.users` ditambahkan field:
  - `pdp_consent_given` (boolean)
  - `pdp_consent_version` (varchar)
  - `pdp_consent_date` (timestamp)
  - `phone_verified` & `email_verified` (boolean)
  - `account_type` (varchar)
  - `login_attempts` (integer)
  - `lock_until` (timestamp)
  - `pending_invitation_token` (varchar)
- Koleksi `payload.invitations` ditambahkan untuk mendukung alur undangan dari admin sekolah ke guru.

## 3. Alur Fungsional
1. **Flow A (Registrasi Mandiri)**: Input nama, email, whatsapp, password (min 8 karakter kombinasi huruf+angka), persetujuan UU PDP, kirim kode OTP, verifikasi sukses langsung login otomatis.
2. **Flow B (Registrasi via Undangan)**: Autentikasi dengan token undangan, data email/whatsapp diisi otomatis. Jika pengguna sudah memiliki akun individual, sistem menawarkan penggabungan tanpa duplikasi user (verifikasi dengan password + OTP).
3. **Flow C (Login & Lockout)**: Batasan 5 kali gagal login akan mengunci akun selama 10 menit.
4. **Flow D (Multi-Sekolah Switcher)**: Guru dengan >= 2 sekolah aktif akan diarahkan ke context switcher page (`/select-context`) sebelum masuk dashboard.
