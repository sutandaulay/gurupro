import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, comparePassword } from '@/lib/auth';
import { sendEventNotification } from '@/lib/notifications';
import { normalizeEmail, normalizePhoneNumber } from '@/lib/performance-share';
import crypto from 'crypto';

const REDIRECT_STATUS = 303;

export async function POST(request: NextRequest) {
  const isAjax = request.headers.get('X-Requested-With') === 'XMLHttpRequest' || 
                 request.headers.get('Content-Type')?.includes('application/json');

  let email = '';
  let password = '';
  let confirmPassword = '';
  let whatsapp = '';
  let namaLengkap = 'Guru Mandiri';
  let usernameRaw = '';
  let pdpConsent = false;
  let pdpPolicyVersion = '1.0';
  let referralCode = '';
  let invitationToken = '';
  let accountType: 'individual' | 'institutional' = 'individual';

  if (request.headers.get('Content-Type')?.includes('application/json')) {
    const body = await request.json();
    email = body.email || '';
    password = body.password || '';
    confirmPassword = body.confirmPassword || body.confirm_password || '';
    whatsapp = body.whatsapp || '';
    namaLengkap = body.nama_lengkap || body.namaLengkap || 'Guru Mandiri';
    usernameRaw = body.username || '';
    pdpConsent = !!body.pdpConsent || !!body.pdp_consent;
    pdpPolicyVersion = body.pdpPolicyVersion || body.pdp_policy_version || '1.0';
    referralCode = body.referralCode || body.referral_code || '';
    invitationToken = body.invitationToken || body.invitation_token || '';
    accountType = body.accountType || body.account_type || 'individual';
  } else {
    const formData = await request.formData();
    email = formData.get('email')?.toString() || '';
    password = formData.get('password')?.toString() || '';
    confirmPassword = formData.get('confirm_password')?.toString() || '';
    whatsapp = formData.get('whatsapp')?.toString() || '';
    namaLengkap = formData.get('nama_lengkap')?.toString() || 'Guru Mandiri';
    usernameRaw = formData.get('username')?.toString() || '';
    pdpConsent = formData.get('pdp_consent')?.toString() === 'on' || formData.get('pdp_consent')?.toString() === 'true';
    pdpPolicyVersion = formData.get('pdp_policy_version')?.toString() || '1.0';
    referralCode = formData.get('referral_code')?.toString() || '';
    invitationToken = formData.get('invitation_token')?.toString() || '';
    accountType = (formData.get('account_type')?.toString() as 'individual' | 'institutional') || 'individual';
  }

  // 1. Validate PDP Consent
  if (!pdpConsent) {
    if (isAjax) {
      return NextResponse.json({ success: false, error: 'Persetujuan UU PDP wajib dicentang!' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/register?error=Persetujuan%20UU%20PDP%20wajib%20dicentang%21', request.url), REDIRECT_STATUS);
  }

  // 2. Normalize and validate inputs
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhoneNumber(whatsapp);

  if (!cleanEmail) {
    if (isAjax) {
      return NextResponse.json({ success: false, error: 'Format email tidak valid!' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/register?error=Format%20email%20tidak%20valid%21', request.url), REDIRECT_STATUS);
  }

  if (!cleanPhone) {
    if (isAjax) {
      return NextResponse.json({ success: false, error: 'Format nomor WhatsApp tidak valid! Harus +62...' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/register?error=Format%20nomor%20WhatsApp%20tidak%20valid%21', request.url), REDIRECT_STATUS);
  }

  // Password validation: min 8 chars + letters & numbers combination
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    const errorMsg = 'Kata sandi minimal 8 karakter dan harus berisi kombinasi huruf dan angka!';
    if (isAjax) {
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/register?error=' + encodeURIComponent(errorMsg), request.url), REDIRECT_STATUS);
  }

  if (password !== confirmPassword) {
    if (isAjax) {
      return NextResponse.json({ success: false, error: 'Kata sandi dan konfirmasi kata sandi tidak cocok!' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/register?error=Kata%20sandi%20tidak%20cocok%21', request.url), REDIRECT_STATUS);
  }

  try {
    // 3. Process existing user constraints
    const existingUser = await query(
      'SELECT id, password_hash, is_active FROM users WHERE email = $1 OR whatsapp = $2',
      [cleanEmail, cleanPhone]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      
      // Flow B: Joining via invitation for an existing individual account
      if (invitationToken) {
        // Validate password
        const match = await comparePassword(password, user.password_hash || '');
        if (!match) {
          return NextResponse.json({ success: false, error: 'Kata sandi salah untuk akun terdaftar Anda.' }, { status: 401 });
        }

        // Link invitation token
        await query(
          'UPDATE users SET pending_invitation_token = $1 WHERE id = $2',
          [invitationToken, user.id]
        );

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

        // Insert OTP verification record into payload schema
        await query(
          `INSERT INTO payload.otp_verifications (otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at)
           VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, 'account_verification', NOW(), NOW())`,
          [otpHash, 'whatsapp', cleanPhone]
        );

        await sendEventNotification('forgot_password', { email: cleanEmail, whatsapp: cleanPhone, nama_lengkap: namaLengkap }, { otp_code: otp });

        return NextResponse.json({
          success: true,
          requiresOtp: true,
          userId: user.id,
          message: 'Akun terdaftar ditemukan. Kode OTP verifikasi telah dikirim ke WhatsApp/Email Anda.'
        });
      } else {
        if (isAjax) {
          return NextResponse.json({ success: false, error: 'Email atau nomor WhatsApp sudah terdaftar!' }, { status: 409 });
        }
        return NextResponse.redirect(new URL('/register?error=Email%20atau%20nomor%20WhatsApp%20sudah%20terdaftar%21', request.url), REDIRECT_STATUS);
      }
    }

    // 4. Validate username uniqueness if provided
    if (usernameRaw) {
      if (!/^[a-z0-9._-]{3,80}$/.test(usernameRaw)) {
        if (isAjax) {
          return NextResponse.json({ success: false, error: 'Username tidak valid. Minimal 3 karakter, huruf kecil, angka, titik, atau strip.' }, { status: 400 });
        }
        return NextResponse.redirect(new URL('/register?error=Username%20tidak%20valid', request.url), REDIRECT_STATUS);
      }
      const usernameTaken = await query(
        'SELECT id FROM users WHERE LOWER(username) = $1',
        [usernameRaw]
      );
      if (usernameTaken.rows.length > 0) {
        if (isAjax) {
          return NextResponse.json({ success: false, error: 'Username sudah digunakan!' }, { status: 409 });
        }
        return NextResponse.redirect(new URL('/register?error=Username%20sudah%20digunakan', request.url), REDIRECT_STATUS);
      }
    }

    // 5. Check referral
    const selfRefCode = 'GPRO-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    let referredByUserId = null;
    let refereeTokenBonus = 0;

    if (referralCode) {
      const referrer = await query(
        'SELECT id FROM users WHERE referral_code = $1',
        [referralCode.trim().toUpperCase()]
      );
      if (referrer.rows.length > 0) {
        referredByUserId = referrer.rows[0].id;
        refereeTokenBonus = 10;
        await query(
          'UPDATE users SET token_limit = token_limit + 20, cashback_balance = cashback_balance + 10000 WHERE id = $1',
          [referredByUserId]
        );
      }
    }

    const hashed = await hashPassword(password);

    // 6. Create User in public.users with verification pending
    const newUser = await query(
      `INSERT INTO users (
         username, email, whatsapp, nama_lengkap, token_limit, referral_code, 
         referred_by, password_hash, subscription_start, subscription_end, 
         status_langganan, is_active, pdp_consent_given, pdp_consent_version, 
         pdp_consent_date, phone_verified, email_verified, account_type, pending_invitation_token
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'free', TRUE, TRUE, $9, NOW(), FALSE, FALSE, $10, $11)
       RETURNING id, email, whatsapp`,
      [
        usernameRaw || null, cleanEmail, cleanPhone, namaLengkap, 
        5 + refereeTokenBonus, selfRefCode, referredByUserId, hashed,
        pdpPolicyVersion, accountType, invitationToken || null
      ]
    );

    const user = newUser.rows[0];

    if (referredByUserId) {
      await query(
        `INSERT INTO referrals (referrer_id, referee_id, reward_tokens, cashback_amount)
         VALUES ($1, $2, 20, 10000)`,
        [referredByUserId, user.id]
      );
    }

    await query(
      `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'Registrasi Akun Baru', `Registrasi tertunda verifikasi OTP ${referredByUserId ? 'menggunakan referral ' + referralCode : ''}`, '127.0.0.1']
    );

    // 7. Create OTP verification in payload schema
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    await query(
      `INSERT INTO payload.otp_verifications (otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, 'account_verification', NOW(), NOW())`,
      [otpHash, 'whatsapp', cleanPhone]
    );

    // Dispatch welcome/verification event
    await sendEventNotification('forgot_password', { email: cleanEmail, whatsapp: cleanPhone, nama_lengkap: namaLengkap }, { otp_code: otp });

    return NextResponse.json({
      success: true,
      requiresOtp: true,
      userId: user.id,
      message: 'Registrasi berhasil! Kode verifikasi OTP telah dikirimkan ke WhatsApp/Email Anda.'
    });
  } catch (err: any) {
    console.error('Register API Error:', err);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem.' }, { status: 500 });
  }
}
