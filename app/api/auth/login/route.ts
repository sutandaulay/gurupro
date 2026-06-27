import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const REDIRECT_STATUS = 303;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const loginId = formData.get('email')?.toString().trim().toLowerCase();
  const password = formData.get('password')?.toString();
  const checkoutPlan = formData.get('checkout_plan')?.toString();

  // Check if this is an AJAX request (fetch API from client)
  const isAjax = request.headers.get('X-Requested-With') === 'XMLHttpRequest';

  if (!loginId || !password) {
    const errorMsg = 'Email%2FUsername%20dan%20Password%20wajib%20diisi%21';
    if (isAjax) {
      return NextResponse.json({ success: false, error: 'Email/Username dan Password wajib diisi!' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/login?error=' + errorMsg, request.url), REDIRECT_STATUS);
  }

  try {
    const userRes = await query(
      'SELECT id, email, username, whatsapp, role, password_hash, is_active FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
      [loginId]
    );

    if (userRes.rows.length === 0) {
      const errorMsg = 'Email%20atau%20Password%20salah%21';
      if (isAjax) {
        return NextResponse.json({ success: false, error: 'Email atau Password salah!' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login?error=' + errorMsg, request.url), REDIRECT_STATUS);
    }

    const user = userRes.rows[0];

    if (user.is_active === false) {
      const errorMsg = 'Akun%20Anda%20dinonaktifkan.';
      if (isAjax) {
        return NextResponse.json({ success: false, error: 'Akun Anda dinonaktifkan.' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/login?error=' + errorMsg, request.url), REDIRECT_STATUS);
    }

    if (user.password_hash === null) {
      const hashed = hashPassword(password);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, user.id]);
      user.password_hash = hashed;
    }

    const inputHash = hashPassword(password);
    if (inputHash !== user.password_hash) {
      const errorMsg = 'Email%20atau%20Password%20salah%21';
      if (isAjax) {
        return NextResponse.json({ success: false, error: 'Email atau Password salah!' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login?error=' + errorMsg, request.url), REDIRECT_STATUS);
    }

    const sessionData = JSON.stringify({ id: user.id, role: user.role || 'guru' });

    const targetUrl = user?.role === 'admin'
      ? '/admin'
      : checkoutPlan
        ? `/dashboard?checkout=${checkoutPlan}`
        : '/dashboard';

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
    console.error('Login Error:', err);
    const errorMsg = 'Terjadi%20masalah%20koneksi.';
    if (isAjax) {
      return NextResponse.json({ success: false, error: 'Terjadi masalah koneksi.' }, { status: 500 });
    }
    return NextResponse.redirect(new URL('/login?error=' + errorMsg, request.url), REDIRECT_STATUS);
  }
}
