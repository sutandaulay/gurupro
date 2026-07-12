"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconShieldCheck,
  IconSchool,
  IconUser,
  IconPhone,
  IconCircleCheck,
  IconCircleX,
  IconAlertCircle,
  IconArrowRight,
  IconChevronDown,
  IconGift,
  IconCreditCardOff,
  IconCalendarCancel,
} from "@tabler/icons-react";

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
  className = "",
  inputClassName = "",
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
            ${Icon ? "pl-10" : "pl-3.5"} ${rightElement ? "pr-11" : "pr-3.5"}
            ${error
              ? "border-error-400 focus:border-error-500 focus:ring-2 focus:ring-error-500/20"
              : "border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            }
            ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}
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

/** Reusable select with icon and chevron, styled to match TextField */
function SelectField({
  label,
  icon: Icon,
  options,
  error,
  disabled,
  className = "",
  ...props
}: {
  label?: string;
  icon?: TablerIcon;
  options: { value: string; label: string }[];
  error?: string | null;
  disabled?: boolean;
  className?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
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
        <select
          disabled={disabled}
          className={`w-full appearance-none rounded-button border bg-white py-2.5 text-sm text-slate-800 outline-none transition-all duration-150
            ${Icon ? "pl-10" : "pl-3.5"} pr-10
            ${error
              ? "border-error-400 focus:border-error-500 focus:ring-2 focus:ring-error-500/20"
              : "border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            }
            ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "cursor-pointer"}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <IconChevronDown
          size={18}
          stroke={1.75}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
      {error && <p className="mt-1 text-xs font-medium text-error-600">{error}</p>}
    </div>
  );
}

/** 3-segment password strength bar */
function PasswordStrength({ password }: { password: string }) {
  const { score, label, barColor } = useMemo(() => {
    if (!password) return { score: 0, label: "", barColor: "" };
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^a-zA-Z0-9]/.test(password)) s++;
    if (s <= 2) return { score: 1, label: "Lemah", barColor: "bg-error-500" };
    if (s <= 3) return { score: 2, label: "Sedang", barColor: "bg-warning-500" };
    return { score: 3, label: "Kuat", barColor: "bg-success-500" };
  }, [password]);

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
              i <= score ? barColor : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] font-medium text-slate-500">
        Kekuatan: <span className="font-bold">{label}</span>
      </p>
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

function RegisterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [role, setRole] = useState("guru");

  // Field errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  const passwordToggle = (show: boolean, setShow: (v: boolean) => void) => (
    <button
      type="button"
      onClick={() => setShow(!show)}
      tabIndex={-1}
      className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
      aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
    >
      {show ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
    </button>
  );

  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;
  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  // Read error from URL (returned by route handler redirect)
  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      setError(decodeURIComponent(err));
      const newPath = window.location.pathname;
      window.history.replaceState(null, '', newPath);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    setTermsError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const nameVal = formData.get("nama_lengkap")?.toString().trim();
    const emailVal = formData.get("email")?.toString().trim();

    let valid = true;
    if (!nameVal) {
      setNameError("Nama lengkap wajib diisi.");
      valid = false;
    }
    if (!emailVal) {
      setEmailError("Email wajib diisi.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setEmailError("Format email tidak valid.");
      valid = false;
    }
    if (!password) {
      setPasswordError("Password wajib diisi.");
      valid = false;
    } else if (password.length < 6) {
      setPasswordError("Password minimal 6 karakter.");
      valid = false;
    }
    if (confirmPassword !== password) {
      setConfirmError("Konfirmasi password tidak cocok.");
      valid = false;
    }
    if (!agreed) {
      setTermsError("Anda harus menyetujui Syarat & Ketentuan.");
      valid = false;
    }
    if (!valid) {
      return;
    }

    // Submit via fetch API
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push(data.redirectUrl);
      } else {
        setError(data.error || 'Terjadi kesalahan. Silakan coba lagi.');
      }
    } catch (err) {
      console.error('Register Error:', err);
      setError('Masalah koneksi jaringan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

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
            Bergabung dengan ribuan<br />guru Indonesia
          </h2>
          <p className="mt-2 text-sm text-violet-200/90 max-w-xs">
            Mulai perjalanan mengajar yang lebih cerdas bersama GuruPRO AI.
          </p>
        </div>

        {/* Feature bullets */}
        <div className="relative z-10 space-y-4">
          <FeatureBullet icon={IconGift} title="Gratis 14 Hari" desc="Coba semua fitur premium tanpa biaya apa pun." />
          <FeatureBullet icon={IconCreditCardOff} title="Tanpa Kartu Kredit" desc="Tidak perlu metode pembayaran untuk mulai." />
          <FeatureBullet icon={IconCalendarCancel} title="Batalkan Kapan Saja" desc="Berhenti berlangganan kapan pun Anda mau." />
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
            <h2 className="text-2xl font-bold text-slate-900">Buat Akun Baru</h2>
            <p className="text-sm text-slate-500 mt-1">Mulai perjalanan mengajar yang lebih cerdas</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 p-3.5 bg-error-50 border border-error-200 text-error-700 rounded-button text-xs font-semibold flex items-start gap-2.5">
              <IconAlertCircle size={18} stroke={1.75} className="flex-shrink-0 mt-px" />
              <p className="leading-normal">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Nama Lengkap */}
            <TextField
              label="Nama Lengkap & Gelar"
              icon={IconUser}
              type="text"
              name="nama_lengkap"
              required
              placeholder="Contoh: ElHanum, S.Pd."
              error={nameError}
              disabled={loading}
            />

            {/* Email */}
            <TextField
              label="Alamat Email"
              icon={IconMail}
              type="email"
              name="email"
              required
              placeholder="email"
              error={emailError}
              disabled={loading}
            />

            {/* WhatsApp (opsional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                No. WhatsApp <span className="text-slate-400 font-normal">(opsional)</span>
              </label>
              <div className="relative">
                <IconPhone
                  size={18}
                  stroke={1.75}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold pointer-events-none">
                  +62
                </span>
                <input
                  type="tel"
                  name="whatsapp"
                  placeholder="81234567xx"
                  disabled={loading}
                  className="w-full rounded-button border border-slate-200 bg-white py-2.5 pl-[4.5rem] pr-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400 font-medium">Untuk notifikasi, OTP, dan info pencairan.</p>
            </div>

            {/* Role */}
            <SelectField
              label="Pilih Peran"
              icon={IconSchool}
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
              options={[
                { value: "guru", label: "Guru" },
                { value: "kepala_sekolah", label: "Kepala Sekolah" },
                { value: "admin", label: "Admin" },
              ]}
            />

            {/* Password */}
            <div>
              <TextField
                label="Kata Sandi"
                icon={IconLock}
                type={showPassword ? "text" : "password"}
                name="password"
                required
                placeholder="Minimal 6 karakter"
                error={passwordError}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                rightElement={passwordToggle(showPassword, setShowPassword)}
              />
              <PasswordStrength password={password} />
            </div>

            {/* Confirm Password */}
            <div>
              <TextField
                label="Konfirmasi Kata Sandi"
                icon={IconLock}
                type={showConfirm ? "text" : "password"}
                name="confirm_password"
                required
                placeholder="Ulangi kata sandi Anda"
                error={confirmError}
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                rightElement={passwordToggle(showConfirm, setShowConfirm)}
              />
              {passwordsMatch && (
                <div className="mt-2 flex items-center gap-1.5">
                  <IconCircleCheck size={14} stroke={2} className="text-success-500" />
                  <span className="text-[10px] font-medium text-success-600">Password cocok</span>
                </div>
              )}
              {passwordsMismatch && (
                <div className="mt-2 flex items-center gap-1.5">
                  <IconCircleX size={14} stroke={2} className="text-error-500" />
                  <span className="text-[10px] font-medium text-error-600">Password tidak cocok</span>
                </div>
              )}
            </div>

            {/* Terms checkbox */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  disabled={loading}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    setTermsError(null);
                  }}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer disabled:opacity-50"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Saya setuju dengan{" "}
                  <a href="#" className="font-bold text-violet-600 hover:underline">
                    Syarat &amp; Ketentuan
                  </a>{" "}
                  dan{" "}
                  <a href="#" className="font-bold text-violet-600 hover:underline">
                    Kebijakan Privasi
                  </a>
                </span>
              </label>
              {termsError && <p className="mt-1 text-xs font-medium text-error-600">{termsError}</p>}
            </div>

            {/* Submit button */}
            <SubmitBtn
              label="Daftar Sekarang"
              icon={IconArrowRight}
              loading={loading}
            />
          </form>

          {/* Divider + Google button */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-medium text-slate-400">atau daftar dengan</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-sm font-semibold text-slate-700 rounded-button transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GoogleIcon size={18} />
            <span>Daftar dengan Google</span>
          </button>

          {/* Link to login */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="font-bold text-violet-600 hover:text-violet-700 transition-colors"
            >
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <IconLoader2 size={32} stroke={2} className="animate-spin text-violet-500" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
