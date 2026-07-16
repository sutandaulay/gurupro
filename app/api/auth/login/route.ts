import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, comparePassword } from '@/lib/auth';
import { setDefaultSessionCookie } from '@/lib/session';
import { sendEventNotification } from '@/lib/notifications';
import crypto from 'crypto';

const REDIRECT_STATUS = 303;

export async function POST(request: NextRequest) {
  const isAjax = request.headers.get('X-Requested-With') === 'XMLHttpRequest' ||
                 request.headers.get('Content-Type')?.includes('application/json');

  let loginId = '';
  let password = '';
  let checkoutPlan = '';

  if (request.headers.get('Content-Type')?.includes('application/json')) {
    const body = await request.json();
    loginId = body.identifier || body.email || '';
    password = body.password || '';
    checkoutPlan = body.checkout_plan || body.checkoutPlan || '';
  } else {
    const formData = await request.formData();
    loginId = formData.get('email')?.toString() || '';
    password = formData.get('password')?.toString() || '';
    checkoutPlan = formData.get('checkout_plan')?.toString() || '';
  }

  loginId = loginId.trim().toLowerCase();

  if (!loginId || !password) {
    const errorMsg = 'Email/Username dan Password wajib diisi!';
    if (isAjax) {
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(errorMsg), request.url), REDIRECT_STATUS);
  }

  try {
    // 1. Fetch user including rate limit columns
    const userRes = await query(
      `SELECT id, email, username, whatsapp, role, password_hash, is_active, 
              login_attempts, lock_until, phone_verified, email_verified 
       FROM users 
       WHERE LOWER(email) = $1 OR LOWER(username) = $1`,
      [loginId]
    );

    if (userRes.rows.length === 0) {
      const errorMsg = 'Email atau Password salah!';
      if (isAjax) {
        return NextResponse.json({ success: false, error: errorMsg }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(errorMsg), request.url), REDIRECT_STATUS);
    }

    const user = userRes.rows[0];

    // 2. Check Lockout State
    if (user.lock_until) {
      const lockUntil = new Date(user.lock_until);
      if (lockUntil > new Date()) {
        const remainingMinutes = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
        const errorMsg = `Akun Anda terkunci sementara karena terlalu banyak kegagalan login. Silakan coba lagi dalam ${remainingMinutes} menit.`;
        if (isAjax) {
          return NextResponse.json({ success: false, error: errorMsg }, { status: 429 });
        }
        return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(errorMsg), request.url), REDIRECT_STATUS);
      }
    }

    // 3. Check Account Status
    if (user.is_active === false) {
      const errorMsg = 'Akun Anda dinonaktifkan oleh Admin.';
      if (isAjax) {
        return NextResponse.json({ success: false, error: errorMsg }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(errorMsg), request.url), REDIRECT_STATUS);
    }

    // 4. Verify password
    if (user.password_hash === null) {
      // Auto migrate passwordless users and reset login attempts
      const hashed = await hashPassword(password);
      await query('UPDATE users SET password_hash = $1, login_attempts = 0, lock_until = NULL WHERE id = $2', [hashed, user.id]);
      user.password_hash = hashed;
    }

    const match = await comparePassword(password, user.password_hash);
    
    if (!match) {
      // Increment login attempts
      const newAttempts = (user.login_attempts || 0) + 1;
      let lockUntilSql = null;
      let errorMsg = 'Email atau Password salah!';

      if (newAttempts >= 5) {
        lockUntilSql = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes lockout
        errorMsg = 'Terlalu banyak percobaan login gagal. Akun Anda terkunci sementara selama 10 menit.';
        
        // Log audit lockout
        await query(
          `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
           VALUES ($1, $2, $3, $4)`,
          [user.id, 'Lockout Akun', 'Akun dikunci karena 5x salah password', '127.0.0.1']
        );
        
        // Send notification
        await sendEventNotification('forgot_password', { 
          email: user.email, 
          whatsapp: user.whatsapp, 
          nama_lengkap: user.nama_lengkap || 'User GuruPRO' 
        }, { otp_code: 'LOGALERT' });
      } else {
        errorMsg = `Email atau Password salah! (Sisa percobaan: ${5 - newAttempts})`;
      }

      await query(
        'UPDATE users SET login_attempts = $1, lock_until = $2 WHERE id = $3',
        [newAttempts, lockUntilSql, user.id]
      );

      if (isAjax) {
        return NextResponse.json({ success: false, error: errorMsg }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(errorMsg), request.url), REDIRECT_STATUS);
    }

    // Reset login attempts on success
    await query(
      'UPDATE users SET login_attempts = 0, lock_until = NULL WHERE id = $1',
      [user.id]
    );

    // 5. Verification Gate (Check if email/whatsapp is verified)
    if (!user.phone_verified && !user.email_verified) {
      // Account is unverified, trigger OTP and block login
      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

      await query(
        `INSERT INTO payload.otp_verifications (otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, 'account_verification', NOW(), NOW())`,
        [otpHash, 'whatsapp', user.whatsapp]
      );

      await sendEventNotification('forgot_password', { 
        email: user.email, 
        whatsapp: user.whatsapp, 
        nama_lengkap: user.nama_lengkap || 'User GuruPRO' 
      }, { otp_code: otp });

      return NextResponse.json({
        success: false,
        error: 'Akun Anda belum terverifikasi! Silakan verifikasi OTP terlebih dahulu.',
        requiresOtp: true,
        userId: user.id
      }, { status: 403 });
    }

    // 6. Check for Multi-School Context Switcher
    const membershipRes = await query(
      `SELECT COUNT(*) as count FROM payload.institution_members WHERE app_user_id = $1 AND status = 'active'`,
      [user.id]
    );
    const activeMembershipsCount = parseInt(membershipRes.rows[0].count || '0');

    // If multi-school, redirect to switcher selection page
    let targetUrl = '/dashboard';
    if (activeMembershipsCount >= 2) {
      targetUrl = '/select-context';
    } else if (user.role === 'admin') {
      targetUrl = '/admin';
    } else if (checkoutPlan) {
      targetUrl = `/dashboard?checkout=${checkoutPlan}`;
    }

    // Create session using consistent helper
    await setDefaultSessionCookie({ id: user.id, role: user.role || 'guru' });

    if (isAjax) {
      return NextResponse.json({
        success: true,
        redirectUrl: targetUrl,
        needsSelection: activeMembershipsCount >= 2
      });
    }

    return NextResponse.redirect(new URL(targetUrl, request.url), 303);
  } catch (err) {
    console.error('Login API Error:', err);
    const errorMsg = 'Terjadi kesalahan sistem.';
    if (isAjax) {
      return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
    }
    return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(errorMsg), request.url), REDIRECT_STATUS);
  }
}
