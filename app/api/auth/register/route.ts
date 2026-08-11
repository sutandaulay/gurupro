import { NextResponse } from 'next/server';
import { performRegister } from '@/lib/auth-login';

const REDIRECT_STATUS = 303;

export async function POST(request: Request) {
  const isAjax = request.headers.get('X-Requested-With') === 'XMLHttpRequest' ||
                 request.headers.get('Content-Type')?.includes('application/json');

  let email = '';
  let password = '';
  let confirmPassword = '';
  let whatsapp = '';
  let namaLengkap = 'Guru Mandiri';
  let username = '';
  let pdpConsent = false;
  let pdpPolicyVersion = '1.0';
  let referralCode = '';
  let invitationToken = '';
  let accountType: 'individual' | 'institutional' = 'individual';
  let checkoutPlan = '';

  if (request.headers.get('Content-Type')?.includes('application/json')) {
    const body = await request.json();
    email = body.email || '';
    password = body.password || '';
    confirmPassword = body.confirmPassword || body.confirm_password || '';
    whatsapp = body.whatsapp || '';
    namaLengkap = body.nama_lengkap || body.namaLengkap || 'Guru Mandiri';
    username = body.username || '';
    pdpConsent = !!body.pdpConsent || !!body.pdp_consent;
    pdpPolicyVersion = body.pdpPolicyVersion || body.pdp_policy_version || '1.0';
    referralCode = body.referralCode || body.referral_code || '';
    invitationToken = body.invitationToken || body.invitation_token || '';
    accountType = body.accountType || body.account_type || 'individual';
    checkoutPlan = body.checkoutPlan || body.checkout_plan || '';
  } else {
    const formData = await request.formData();
    email = formData.get('email')?.toString() || '';
    password = formData.get('password')?.toString() || '';
    confirmPassword = formData.get('confirm_password')?.toString() || '';
    whatsapp = formData.get('whatsapp')?.toString() || '';
    namaLengkap = formData.get('nama_lengkap')?.toString() || 'Guru Mandiri';
    username = formData.get('username')?.toString() || '';
    pdpConsent = formData.get('pdp_consent')?.toString() === 'on';
    pdpPolicyVersion = formData.get('pdp_policy_version')?.toString() || '1.0';
    referralCode = formData.get('referral_code')?.toString() || '';
    invitationToken = formData.get('invitation_token')?.toString() || '';
    accountType = (formData.get('account_type')?.toString() as 'individual' | 'institutional') || 'individual';
    checkoutPlan = formData.get('checkout_plan')?.toString() || '';
  }

  try {
    const result = await performRegister({
      email, password, confirmPassword, whatsapp, namaLengkap, username,
      pdpConsent, pdpPolicyVersion, referralCode, invitationToken, accountType, checkoutPlan,
    });

    if (result.error) {
      if (isAjax) {
        return NextResponse.json({ success: false, ...result }, { status: 400 });
      }
      return NextResponse.redirect(new URL('/register?error=' + encodeURIComponent(result.error), request.url), REDIRECT_STATUS);
    }

    if (isAjax) {
      return NextResponse.json({ success: true, ...result });
    }
    return NextResponse.redirect(new URL('/verify-otp', request.url), REDIRECT_STATUS);
  } catch (err) {
    console.error('Register API Error:', err);
    if (isAjax) {
      return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem.' }, { status: 500 });
    }
    return NextResponse.redirect(new URL('/register?error=Terjadi%20kesalahan%20sistem', request.url), REDIRECT_STATUS);
  }
}
