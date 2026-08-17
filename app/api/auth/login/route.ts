import { NextResponse } from 'next/server';
import { performLogin } from '@/lib/auth-login';

const REDIRECT_STATUS = 303;

export async function POST(request: Request) {
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
    const result = await performLogin({ loginId, password, checkoutPlan });

    if (result.requiresOtp && result.userId) {
      if (isAjax) {
        return NextResponse.json({ success: true, ...result }, { status: 200 });
      }
      return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(result.error || ''), request.url), REDIRECT_STATUS);
    }

    if (result.error) {
      if (isAjax) {
        const status = result.requiresOtp ? 403 : 401;
        return NextResponse.json({ success: false, ...result }, { status });
      }
      return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(result.error), request.url), REDIRECT_STATUS);
    }

    if (isAjax) {
      return NextResponse.json({ success: true, ...result });
    }
    return NextResponse.redirect(new URL(result.redirectUrl || '/dashboard', request.url), 303);
  } catch (err) {
    console.error('Login API Error:', err);
    const errorMsg = 'Terjadi kesalahan sistem.';
    if (isAjax) {
      return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
    }
    return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(errorMsg), request.url), REDIRECT_STATUS);
  }
}
