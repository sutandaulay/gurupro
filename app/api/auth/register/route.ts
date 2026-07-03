import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { sendEventNotification } from '@/lib/notifications';

const REDIRECT_STATUS = 303;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get('email')?.toString().trim().toLowerCase();
  const password = formData.get('password')?.toString();
  const whatsapp = formData.get('whatsapp')?.toString().trim();
  const namaLengkap = formData.get('nama_lengkap')?.toString().trim() || 'Guru Mandiri';
  const usernameRaw = formData.get('username')?.toString().trim().toLowerCase() || '';

  // Check if this is an AJAX request (fetch API from client)
  const isAjax = request.headers.get('X-Requested-With') === 'XMLHttpRequest';

  if (!email || !password) {
    const errorMsg = 'Email%20dan%20Password%20wajib%20diisi%21';
    if (isAjax) {
      return NextResponse.json({ success: false, error: 'Email dan Password wajib diisi!' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/register?error=' + errorMsg, request.url), REDIRECT_STATUS);
  }

  if (!whatsapp) {
    const errorMsg = 'Nomor%20WhatsApp%20wajib%20diisi%21';
    if (isAjax) {
      return NextResponse.json({ success: false, error: 'Nomor WhatsApp wajib diisi!' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/register?error=' + errorMsg, request.url), REDIRECT_STATUS);
  }

  try {
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR whatsapp = $2',
      [email, whatsapp]
    );

    if (existingUser.rows.length > 0) {
      const errorMsg = 'Email%20atau%20No.%20WhatsApp%20sudah%20terdaftar%21';
      if (isAjax) {
        return NextResponse.json({ success: false, error: 'Email atau No. WhatsApp sudah terdaftar!' }, { status: 409 });
      }
      return NextResponse.redirect(new URL('/register?error=' + errorMsg, request.url), REDIRECT_STATUS);
    }

    if (usernameRaw) {
      if (!/^[a-z0-9._-]{3,80}$/.test(usernameRaw)) {
        const errorMsg = 'Username%20tidak%20valid.';
        if (isAjax) {
          return NextResponse.json({ success: false, error: 'Username tidak valid.' }, { status: 400 });
        }
        return NextResponse.redirect(new URL('/register?error=' + errorMsg, request.url), REDIRECT_STATUS);
      }
      const usernameTaken = await query(
        'SELECT id FROM users WHERE LOWER(username) = $1',
        [usernameRaw]
      );
      if (usernameTaken.rows.length > 0) {
        const errorMsg = 'Username%20sudah%20digunakan.';
        if (isAjax) {
          return NextResponse.json({ success: false, error: 'Username sudah digunakan.' }, { status: 409 });
        }
        return NextResponse.redirect(new URL('/register?error=' + errorMsg, request.url), REDIRECT_STATUS);
      }
    }

    const referralCode = formData.get('referral_code')?.toString().trim().toUpperCase() || null;
    const selfRefCode = 'GPRO-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    let referredByUserId = null;
    let refereeTokenBonus = 0;

    if (referralCode) {
      const referrer = await query(
        'SELECT id FROM users WHERE referral_code = $1',
        [referralCode]
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

    const newUser = await query(
      `INSERT INTO users (username, email, whatsapp, nama_lengkap, token_limit, referral_code, referred_by, password_hash, subscription_start, subscription_end, status_langganan, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'free', TRUE)
       RETURNING id, email, whatsapp, role`,
      [usernameRaw || null, email, whatsapp, namaLengkap, 5 + refereeTokenBonus, selfRefCode, referredByUserId, hashed]
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
      [user.id, 'Registrasi Akun', `Registrasi berhasil ${referredByUserId ? 'menggunakan referral ' + referralCode : ''}`, '127.0.0.1']
    );

    await sendEventNotification('register', { ...user, nama_lengkap: namaLengkap }, {
      referral_code: selfRefCode,
    });

    const sessionData = JSON.stringify({ id: user.id, role: user.role || 'guru' });
    const targetUrl = '/dashboard';

    // If AJAX request, return JSON with redirect URL instead of redirecting
    if (isAjax) {
      const response = NextResponse.json({ success: true, redirectUrl: targetUrl });
      response.cookies.set('gurupro_session', sessionData, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return response;
    }

    const response = NextResponse.redirect(new URL(targetUrl, request.url), 303);
    response.cookies.set('gurupro_session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Register Error:', err);
    const errorMsg = 'Terjadi%20masalah%20koneksi.';
    if (isAjax) {
      return NextResponse.json({ success: false, error: 'Terjadi masalah koneksi.' }, { status: 500 });
    }
    return NextResponse.redirect(new URL('/register?error=' + errorMsg, request.url), REDIRECT_STATUS);
  }
}
