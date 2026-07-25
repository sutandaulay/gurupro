"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { signInWithGoogle } from '@/lib/oauth';
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconBolt,
  IconShieldCheck,
  IconSchool,
  IconUser,
  IconPhone,
  IconIdBadge2,
  IconKey,
  IconArrowLeft,
  IconArrowRight,
  IconAlertCircle,
  IconCircleCheck,
} from '@tabler/icons-react';

/* ============================ Sub-components ============================ */

/** Official 4-color Google "G" logo */
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/** Simple SVG illustration of a teacher at a chalkboard */
function TeacherIllustration() {
  return (
    <svg viewBox="0 0 400 280" className="w-full max-w-xs mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="200" cy="140" r="120" fill="rgba(255,255,255,0.05)" />
      {/* chalkboard */}
      <rect x="70" y="40" width="190" height="115" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
      <line x1="92" y1="68" x2="180" y2="68" stroke="rgba(196,181,253,0.7)" strokeWidth="4" strokeLinecap="round" />
      <line x1="92" y1="88" x2="220" y2="88" stroke="rgba(196,181,253,0.5)" strokeWidth="4" strokeLinecap="round" />
      <rect x="92" y="105" width="36" height="28" rx="4" fill="rgba(196,181,253,0.35)" />
      <rect x="138" y="105" width="36" height="28" rx="4" fill="rgba(196,181,253,0.2)" />
      {/* teacher */}
      <circle cx="305" cy="120" r="20" fill="rgba(255,255,255,0.95)" />
      <path d="M286 118 Q286 96 305 96 Q324 96 324 118 Q318 108 305 108 Q292 108 286 118 Z" fill="rgba(167,139,250,0.7)" />
      <path d="M272 205 Q272 158 305 158 Q338 158 338 205 Z" fill="rgba(255,255,255,0.9)" />
      <path d="M282 172 Q250 160 218 128" stroke="rgba(255,255,255,0.9)" strokeWidth="9" strokeLinecap="round" />
      {/* desk */}
      <rect x="250" y="210" width="120" height="7" rx="2" fill="rgba(255,255,255,0.3)" />
      <line x1="262" y1="217" x2="262" y2="248" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
      <line x1="358" y1="217" x2="358" y2="248" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
      <rect x="290" y="196" width="28" height="14" rx="2" fill="rgba(196,181,253,0.5)" />
      {/* accents */}
      <circle cx="55" cy="210" r="5" fill="rgba(196,181,253,0.45)" />
      <circle cx="365" cy="70" r="7" fill="rgba(196,181,253,0.35)" />
      <circle cx="345" cy="255" r="4" fill="rgba(196,181,253,0.55)" />
    </svg>
  );
}

type TablerIcon = React.ComponentType<{ size?: number; stroke?: number; className?: string }>;

function FeatureBullet({ icon: Icon, title, desc }: { icon: TablerIcon; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-button bg-white/10 border border-white/15 flex items-center justify-center">
        <Icon size={20} stroke={1.75} className="text-violet-100" />
      </div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-violet-200/90 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/** Reusable input with icon, error state, disabled state, and optional right element */
function TextField({
  label,
  icon: Icon,
  error,
  disabled,
  rightElement,
  className = '',
  inputClassName = '',
  ...props
}: {
  label?: string;
  icon?: TablerIcon;
  error?: string | null;
  disabled?: boolean;
  rightElement?: React.ReactNode;
  className?: string;
  inputClassName?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={18}
            stroke={1.75}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        )}
        <input
          disabled={disabled}
          className={`w-full rounded-button border bg-white py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-150
            ${Icon ? 'pl-10' : 'pl-3.5'} ${rightElement ? 'pr-11' : 'pr-3.5'}
            ${error
              ? 'border-error-400 focus:border-error-500 focus:ring-2 focus:ring-error-500/20'
              : 'border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
            ${inputClassName}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-error-600">{error}</p>}
    </div>
  );
}

/* ============================ Submit button with loading state ============================ */

function SubmitBtn({ label, icon: Icon, loading }: { label: string; icon?: React.ComponentType<{ size?: number; stroke?: number }>; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-button shadow-md shadow-violet-200 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-1"
    >
      {loading ? (
        <IconLoader2 size={18} stroke={2} className="animate-spin" />
      ) : (
        <>
          <span>{label}</span>
          {Icon && <Icon size={18} stroke={2} />}
        </>
      )}
    </button>
  );
}

/* ============================ Main content ============================ */

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);

  // Invitation states
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationSchoolName, setInvitationSchoolName] = useState<string | null>(null);

  // Forgot password flow states: 'none' | 'request_otp' | 'verify_otp' | 'verify_account'
  const [forgotStep, setForgotStep] = useState<'none' | 'request_otp' | 'verify_otp' | 'verify_account'>('none');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpUserId, setOtpUserId] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [refCode, setRefCode] = useState('');

  // New UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Auto-switch to register mode if URL has mode=register or ref code
  useEffect(() => {
    const mode = searchParams.get('mode');
    const ref = searchParams.get('ref');
    const token = searchParams.get('token');
    if (mode === 'register' || ref) {
      setIsRegister(true);
    } else {
      setIsRegister(false);
    }
    if (ref) {
      setRefCode(ref.toUpperCase());
    }
    // Check for invitation token
    if (token) {
      setInvitationToken(token);
      apiFetch(`/api/auth/invitation/verify?token=${token}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.invitation) {
            setInvitationSchoolName(data.invitation.institutionName);
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  // Read error from URL (returned by route handler redirect)
  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      setError(decodeURIComponent(err));
      const newPath = window.location.pathname;
      window.history.replaceState(null, '', newPath);
    }
  }, [searchParams]);

  const clearErrors = () => {
    setError(null);
    setEmailError(null);
    setPasswordError(null);
  };

  // Handle login/register form submission via fetch API
  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Add checkout_plan if present in URL
    const checkoutPlan = searchParams.get('checkout');
    if (checkoutPlan) {
      formData.set('checkout_plan', checkoutPlan);
    }

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Redirect to dashboard or admin based on response
        router.push(data.redirectUrl);
      } else if (data.requiresOtp) {
        setOtpUserId(data.userId);
        setForgotStep('verify_account');
        setSuccess(data.message || 'Silakan masukkan kode OTP yang dikirim.');
      } else {
        // Show error message
        setError(data.error || 'Terjadi kesalahan. Silakan coba lagi.');
      }
    } catch (err) {
      console.error('Login/Register Error:', err);
      setError('Masalah koneksi jaringan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // Verify Account OTP
  const handleVerifyAccountOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setError('Kode OTP wajib diisi!');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: otpUserId,
          otp: otpCode,
          purpose: 'account_verification',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(data.message || 'Akun Anda berhasil diverifikasi!');
        setForgotStep('none');
        setOtpCode('');
        router.push(data.redirectUrl || '/dashboard');
      } else {
        setError(data.error || 'Gagal verifikasi OTP.');
      }
    } catch (err) {
      setError('Masalah koneksi jaringan.');
    } finally {
      setLoading(false);
    }
  };

  // Request OTP for password reset
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setError('Email atau username wajib diisi!');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        setForgotStep('verify_otp');
      } else {
        setError(data.error || 'Gagal mengirim OTP.');
      }
    } catch (err) {
      setError('Masalah koneksi jaringan.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP & Reset Password
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !newPassword) {
      setError('Kode OTP dan Password Baru wajib diisi!');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          otp: otpCode,
          password: newPassword,
          purpose: 'password_reset',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        setForgotStep('none');
        setOtpCode('');
        setNewPassword('');
      } else {
        setError(data.error || 'Gagal verifikasi OTP.');
      }
    } catch (err) {
      setError('Masalah koneksi jaringan.');
    } finally {
      setLoading(false);
    }
  };

  // Password show/hide toggle button
  const passwordToggle = (show: boolean, setShow: (v: boolean) => void) => (
    <button
      type="button"
      onClick={() => setShow(!show)}
      tabIndex={-1}
      className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
      aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
    >
      {show ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
    </button>
  );

  return (
    <div className="min-h-screen flex">
      {/* ============ LEFT PANEL — desktop only ============ */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-gradient-to-br from-violet-700 via-violet-800 to-violet-950 overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Guru<span className="text-violet-200">PRO</span>
          </h1>
        </div>

        {/* Illustration + tagline */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <TeacherIllustration />
          <h2 className="mt-6 text-2xl font-bold text-white leading-snug">
            Platform Administrasi<br />Guru Berbasis AI
          </h2>
          <p className="mt-2 text-sm text-violet-200/90 max-w-xs">
            Satu aplikasi untuk semua kebutuhan administrasi mengajar Anda.
          </p>
        </div>

        {/* Feature bullets */}
        <div className="relative z-10 space-y-4">
          <FeatureBullet icon={IconBolt} title="Pembuat Soal AI" desc="Generate soal, RPP, dan materi dalam hitungan detik." />
          <FeatureBullet icon={IconShieldCheck} title="Keamanan Terjamin" desc="Data sekolah dan siswa terlindungi enkripsi." />
          <FeatureBullet icon={IconSchool} title="Administrasi Terpadu" desc="Jurnal, presensi, dan nilai dalam satu platform." />
        </div>
      </div>

      {/* ============ RIGHT PANEL — form ============ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-2xl font-black tracking-tight text-violet-600">
              Guru<span className="text-slate-800">PRO</span>
            </h1>
          </div>

          {/* Title + subtitle */}
          <div className="mb-6">
            {forgotStep === 'none' && !isRegister && (
              <>
                <h2 className="text-2xl font-bold text-slate-900">Selamat Datang Kembali</h2>
                <p className="text-sm text-slate-500 mt-1">Masuk ke akun GuruPRO AI Anda</p>
              </>
            )}
            {forgotStep === 'none' && isRegister && (
              <>
                <h2 className="text-2xl font-bold text-slate-900">Daftar Akun Baru</h2>
                <p className="text-sm text-slate-500 mt-1">Buat akun GuruPRO AI dalam hitungan menit</p>
              </>
            )}
            {forgotStep === 'request_otp' && (
              <>
                <h2 className="text-2xl font-bold text-slate-900">Lupa Password</h2>
                <p className="text-sm text-slate-500 mt-1">Kami akan mengirim kode OTP ke email Anda</p>
              </>
            )}
            {forgotStep === 'verify_otp' && (
              <>
                <h2 className="text-2xl font-bold text-slate-900">Verifikasi OTP</h2>
                <p className="text-sm text-slate-500 mt-1">Masukkan kode OTP dan password baru Anda</p>
              </>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 p-3.5 bg-error-50 border border-error-200 text-error-700 rounded-button text-xs font-semibold flex items-start gap-2.5">
              <IconAlertCircle size={18} stroke={1.75} className="flex-shrink-0 mt-px" />
              <p className="leading-normal">{error}</p>
            </div>
          )}
          {/* Success banner */}
          {success && (
            <div className="mb-5 p-3.5 bg-success-50 border border-success-200 text-success-700 rounded-button text-xs font-semibold flex items-start gap-2.5">
              <IconCircleCheck size={18} stroke={1.75} className="flex-shrink-0 mt-px" />
              <p className="leading-normal">{success}</p>
            </div>
          )}

          {/* Invitation info banner */}
          {invitationSchoolName && forgotStep === 'none' && (
            <div className="mb-5 p-3 bg-violet-50 border border-violet-200 rounded-lg flex items-center gap-3">
              <IconSchool size={20} className="text-violet-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-violet-900">Undangan dari {invitationSchoolName}</p>
                <p className="text-xs text-violet-700">
                  Login atau daftar untuk terhubung dengan sekolah ini
                </p>
              </div>
            </div>
          )}

          {/* ===== FORGOT: REQUEST OTP ===== */}
          {forgotStep === 'request_otp' && (
            <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
              <TextField
                label="Email / Username Terdaftar"
                icon={IconMail}
                type="text"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="email atau username"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-button shadow-md shadow-violet-200 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <IconLoader2 size={18} stroke={2} className="animate-spin" /> : 'Kirim Kode OTP'}
              </button>
              <button
                type="button"
                onClick={() => { setForgotStep('none'); setError(null); setSuccess(null); }}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer mt-1"
              >
                <IconArrowLeft size={14} stroke={2} /> Kembali ke Halaman Masuk
              </button>
            </form>
          )}

          {/* ===== FORGOT: VERIFY OTP ===== */}
          {forgotStep === 'verify_otp' && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <TextField
                label="Kode OTP (6 Digit)"
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="123456"
                disabled={loading}
                inputClassName="text-center tracking-[0.3em] font-bold"
              />
              <TextField
                label="Kata Sandi Baru"
                icon={IconLock}
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                disabled={loading}
                rightElement={passwordToggle(showNewPassword, setShowNewPassword)}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-success-600 hover:bg-success-700 text-white font-bold text-sm rounded-button shadow-md shadow-success-200 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <IconLoader2 size={18} stroke={2} className="animate-spin" /> : 'Perbarui Kata Sandi'}
              </button>
              <button
                type="button"
                onClick={() => { setForgotStep('request_otp'); setError(null); }}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors cursor-pointer mt-1"
              >
                <IconArrowLeft size={14} stroke={2} /> Kirim Ulang Kode OTP
              </button>
            </form>
          )}

          {/* ===== VERIFY ACCOUNT OTP ===== */}
          {forgotStep === 'verify_account' && (
            <form onSubmit={handleVerifyAccountOtp} className="flex flex-col gap-4">
              <TextField
                label="Kode OTP Verifikasi Akun (6 Digit)"
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="123456"
                disabled={loading}
                inputClassName="text-center tracking-[0.3em] font-bold"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-success-600 hover:bg-success-700 text-white font-bold text-sm rounded-button shadow-md shadow-success-200 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <IconLoader2 size={18} stroke={2} className="animate-spin" /> : 'Verifikasi Akun'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setSuccess(null);
                  setLoading(true);
                  try {
                    const res = await apiFetch('/api/auth/otp/request', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: otpUserId, purpose: 'account_verification' }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setSuccess(data.message || 'OTP berhasil dikirim ulang!');
                    } else {
                      setError(data.error || 'Gagal mengirim ulang OTP.');
                    }
                  } catch {
                    setError('Masalah koneksi jaringan.');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors cursor-pointer mt-1"
              >
                Kirim Ulang Kode OTP
              </button>
              <button
                type="button"
                onClick={() => { setForgotStep('none'); setError(null); setSuccess(null); }}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer mt-1"
              >
                <IconArrowLeft size={14} stroke={2} /> Kembali ke Halaman Masuk
              </button>
            </form>
          )}

          {/* ===== LOGIN / REGISTER ===== */}
          {forgotStep === 'none' && (
            <>
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                {searchParams.get('checkout') && (
                  <input type="hidden" name="checkout_plan" value={searchParams.get('checkout') || ''} />
                )}

                {isRegister && (
                  <TextField
                    label="Nama Lengkap & Gelar"
                    icon={IconUser}
                    type="text"
                    name="nama_lengkap"
                    required
                    placeholder="Contoh: ElHanum, S.Pd."
                    disabled={loading}
                  />
                )}

                <TextField
                  label={isRegister ? 'Alamat Email Aktif' : 'Email / Username'}
                  icon={IconMail}
                  type={isRegister ? 'email' : 'text'}
                  name="email"
                  required
                  placeholder={isRegister ? 'email' : 'email atau username'}
                  error={emailError}
                  disabled={loading}
                />

                {isRegister && (
                  <TextField
                    label="Username (Opsional)"
                    icon={IconIdBadge2}
                    type="text"
                    name="username"
                    placeholder="username unik untuk login"
                    disabled={loading}
                  />
                )}

                {isRegister && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">No. WhatsApp Aktif</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold pointer-events-none">+62</span>
                      <input
                        type="tel"
                        name="whatsapp"
                        required
                        placeholder="81234567xx"
                        disabled={loading}
                        className="w-full rounded-button border border-slate-200 bg-white py-2.5 pl-12 pr-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400 font-medium">Untuk notifikasi, OTP, dan info pencairan.</p>
                  </div>
                )}

                {/* Password */}
                <TextField
                  label="Kata Sandi"
                  icon={IconLock}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  placeholder="••••••••"
                  error={passwordError}
                  disabled={loading}
                  rightElement={passwordToggle(showPassword, setShowPassword)}
                />

                {isRegister && (
                  <TextField
                    label="Kode Referral (Opsional)"
                    icon={IconKey}
                    type="text"
                    name="referral_code"
                    value={refCode}
                    onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                    placeholder="GPRO-ABCDE"
                    disabled={loading}
                    inputClassName="uppercase font-bold"
                  />
                )}

                {isRegister && (
                  <div className="mt-1">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        name="pdp_consent"
                        required
                        disabled={loading}
                        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                      />
                      <span className="text-xs text-slate-600 leading-relaxed">
                        Saya menyetujui pemrosesan data pribadi saya sesuai dengan{" "}
                        <a href="/privacy-policy" target="_blank" className="font-bold text-violet-600 hover:underline">
                          Kebijakan Privasi
                        </a>{" "}
                        dan ketentuan UU PDP No. 27/2022.
                      </span>
                    </label>
                    <input type="hidden" name="pdp_policy_version" value="1.0" />
                  </div>
                )}

                {/* Forgot password (login only) */}
                {!isRegister && (
                  <div className="flex items-center justify-between -mt-1">
                    <div />
                    <button
                      type="button"
                      onClick={() => { setForgotStep('request_otp'); setError(null); setSuccess(null); }}
                      className="text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors cursor-pointer"
                    >
                      Lupa password?
                    </button>
                  </div>
                )}

                {/* Submit button */}
                <SubmitBtn
                  label={isRegister ? 'Daftar Akun GuruPRO AI' : 'Masuk'}
                  icon={!isRegister ? IconArrowRight : undefined}
                  loading={loading}
                />
              </form>

              {/* Divider + Google button (login only) */}
              {!isRegister && (
                <>
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs font-medium text-slate-400">atau masuk dengan</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      signInWithGoogle(searchParams, { invitationSchoolName });
                    }}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-sm font-semibold text-slate-700 rounded-button transition-colors duration-150 cursor-pointer"
                  >
                    <GoogleIcon size={18} />
                    <span>Masuk dengan Google</span>
                  </button>
                  {(invitationSchoolName || searchParams.get('ref')) && (
                    <p className="mt-2 text-xs text-center text-slate-500">
                      {invitationSchoolName && (
                        <>Anda akan otomatis terhubung ke {invitationSchoolName}. </>
                      )}
                      {searchParams.get('ref') && (
                        <>Kode referral {searchParams.get('ref')?.toUpperCase()} akan otomatis terproses.</>
                      )}
                    </p>
                  )}
                </>
              )}

              {/* Toggle login / register */}
              <p className="mt-6 text-center text-sm text-slate-500">
                {isRegister ? (
                  <>
                    Sudah punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsRegister(false); setError(null); setSuccess(null); setEmailError(null); setPasswordError(null); }}
                      className="font-bold text-violet-600 hover:text-violet-700 transition-colors cursor-pointer"
                    >
                      Masuk sekarang
                    </button>
                  </>
                ) : (
                  <>
                    Belum punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsRegister(true); setError(null); setSuccess(null); setEmailError(null); setPasswordError(null); }}
                      className="font-bold text-violet-600 hover:text-violet-700 transition-colors cursor-pointer"
                    >
                      Daftar sekarang
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <IconLoader2 size={32} stroke={2} className="animate-spin text-violet-500" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
