"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { signInWithGoogle } from "@/lib/oauth";
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
  IconArrowLeft,
} from "@tabler/icons-react";

/* ============================ Sub-components ============================ */

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

function TeacherIllustration() {
  return (
    <svg viewBox="0 0 400 280" className="w-full max-w-xs mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="200" cy="140" r="120" fill="rgba(255,255,255,0.05)" />
      <rect x="70" y="40" width="190" height="115" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
      <line x1="92" y1="68" x2="180" y2="68" stroke="rgba(196,181,253,0.7)" strokeWidth="4" strokeLinecap="round" />
      <line x1="92" y1="88" x2="220" y2="88" stroke="rgba(196,181,253,0.5)" strokeWidth="4" strokeLinecap="round" />
      <rect x="92" y="105" width="36" height="28" rx="4" fill="rgba(196,181,253,0.35)" />
      <rect x="138" y="105" width="36" height="28" rx="4" fill="rgba(196,181,253,0.2)" />
      <circle cx="305" cy="120" r="20" fill="rgba(255,255,255,0.95)" />
      <path d="M286 118 Q286 96 305 96 Q324 96 324 118 Q318 108 305 108 Q292 108 286 118 Z" fill="rgba(167,139,250,0.7)" />
      <path d="M272 205 Q272 158 305 158 Q338 158 338 205 Z" fill="rgba(255,255,255,0.9)" />
      <path d="M282 172 Q250 160 218 128" stroke="rgba(255,255,255,0.9)" strokeWidth="9" strokeLinecap="round" />
      <rect x="250" y="210" width="120" height="7" rx="2" fill="rgba(255,255,255,0.3)" />
      <line x1="262" y1="217" x2="262" y2="248" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
      <line x1="358" y1="217" x2="358" y2="248" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
      <rect x="290" y="196" width="28" height="14" rx="2" fill="rgba(196,181,253,0.5)" />
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

function PasswordStrength({ password }: { password: string }) {
  const { score, label, barColor } = useMemo(() => {
    if (!password) return { score: 0, label: "", barColor: "" };
    let s = 0;
    if (password.length >= 8) s++;
    if (/[a-zA-Z]/.test(password) && /\d/.test(password)) s++;
    if (/[^a-zA-Z0-9]/.test(password)) s++;
    if (s <= 1) return { score: 1, label: "Lemah (Min 8 karakter + huruf/angka)", barColor: "bg-error-500" };
    if (s === 2) return { score: 2, label: "Sedang", barColor: "bg-warning-500" };
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
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Invitation fields
  const [invitationToken, setInvitationToken] = useState("");
  const [invitationSchoolName, setInvitationSchoolName] = useState("");

  // Referral code state
  const [referralCode, setReferralCode] = useState("");

  // OTP State
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otpUserId, setOtpUserId] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // Checkout plan (diteruskan dari landing page langganan)
  const [checkoutPlan, setCheckoutPlan] = useState("");

  // UI inputs
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [role, setRole] = useState("guru");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Field errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
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

  // Process invitation token on mount
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setInvitationToken(token);
      setLoading(true);
      apiFetch(`/api/auth/invitation/verify?token=${token}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.invitation) {
            setEmail(data.invitation.invitedEmail);
            setPhone(data.invitation.invitedPhone.replace("+62", ""));
            setInvitationSchoolName(data.invitation.institutionName);
            setSuccess(`Undangan terverifikasi untuk bergabung dengan ${data.invitation.institutionName}.`);
          } else {
            setError(data.error || "Token undangan tidak valid atau kedaluwarsa.");
          }
        })
        .catch(() => setError("Masalah jaringan saat memverifikasi undangan."))
        .finally(() => setLoading(false));
    }
  }, [searchParams]);

  // Process referral code on mount
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      const cleanRef = ref.toUpperCase();
      setReferralCode(cleanRef);
    }
    const checkout = searchParams.get("checkout");
    if (checkout) {
      setCheckoutPlan(checkout);
    }
  }, [searchParams]);

  // Read error from redirect
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      setError(decodeURIComponent(err));
      const newPath = window.location.pathname;
      window.history.replaceState(null, "", newPath);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setPasswordError(null);
    setConfirmError(null);
    setTermsError(null);

    let valid = true;
    if (!fullName.trim()) {
      setNameError("Nama lengkap wajib diisi.");
      valid = false;
    }
    if (!email.trim()) {
      setEmailError("Email wajib diisi.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Format email tidak valid.");
      valid = false;
    }
    if (!phone.trim()) {
      setPhoneError("Nomor WhatsApp wajib diisi.");
      valid = false;
    }
    if (!password) {
      setPasswordError("Password wajib diisi.");
      valid = false;
    } else if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
      setPasswordError("Kata sandi minimal 8 karakter dengan kombinasi huruf dan angka.");
      valid = false;
    }
    if (confirmPassword !== password) {
      setConfirmError("Konfirmasi kata sandi tidak cocok.");
      valid = false;
    }
    if (!agreed) {
      setTermsError("Persetujuan UU PDP wajib dicentang.");
      valid = false;
    }

    if (!valid) return;

    setLoading(true);

    // Prepare normalized E.164 phone
    const formattedPhone = phone.startsWith("+") ? phone : `+62${phone.replace(/^0+/, "")}`;

    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          nama_lengkap: fullName,
          email: email,
          whatsapp: formattedPhone,
          password: password,
          confirm_password: confirmPassword,
          pdp_consent: agreed,
          pdp_policy_version: "1.0",
          invitation_token: invitationToken,
          account_type: invitationToken ? "institutional" : "individual",
          role: role,
          checkout_plan: checkoutPlan,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.requiresOtp) {
          setOtpUserId(data.userId);
          setIsOtpStep(true);
          setSuccess(data.message || "Registrasi tertunda. Kode OTP verifikasi telah dikirim.");
        } else {
          router.push(data.redirectUrl);
        }
      } else {
        setError(data.error || "Gagal melakukan registrasi.");
      }
    } catch (err) {
      console.error("Register error:", err);
      setError("Terjadi masalah jaringan.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAccountOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setError("Kode OTP wajib diisi!");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: otpUserId,
          otp: otpCode,
          purpose: "account_verification",
          checkout_plan: checkoutPlan,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(data.message || "Akun Anda berhasil diverifikasi!");
        setIsOtpStep(false);
        setOtpCode("");
        router.push(data.redirectUrl || "/dashboard");
      } else {
        setError(data.error || "Kode OTP salah atau kedaluwarsa.");
      }
    } catch (err) {
      setError("Masalah jaringan saat verifikasi OTP.");
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

        <div className="relative z-10">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Guru<span className="text-violet-200">PRO</span>
          </h1>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <TeacherIllustration />
          <h2 className="mt-6 text-2xl font-bold text-white leading-snug">
            Bergabung dengan ribuan<br />guru Indonesia
          </h2>
          <p className="mt-2 text-sm text-violet-200/90 max-w-xs">
            Mulai perjalanan mengajar yang lebih cerdas bersama GuruPRO AI.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          <FeatureBullet icon={IconGift} title="Dual-Mode Fleksibel" desc="Kelola akun personal & terhubung ke institusi Anda sekaligus." />
          <FeatureBullet icon={IconCreditCardOff} title="Penyimpanan Data Aman" desc="Sesuai standar UU PDP dan tersertifikasi enkripsi SSL." />
          <FeatureBullet icon={IconCalendarCancel} title="Generator Soal Bloom" desc="Susun administrasi, RPP & bank soal berstandar HOTS." />
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
            {isOtpStep ? (
              <>
                <h2 className="text-2xl font-bold text-slate-900">Verifikasi Akun Anda</h2>
                <p className="text-sm text-slate-500 mt-1">Masukkan kode OTP yang dikirim ke nomor WhatsApp Anda</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-900">Buat Akun Baru</h2>
                {invitationSchoolName ? (
                  <div className="mt-2 p-3 bg-violet-50 border border-violet-100 rounded-lg text-xs font-semibold text-violet-850 flex items-center gap-2">
                    <IconSchool size={16} className="text-violet-600 shrink-0" />
                    <span>Undangan bergabung ke: <strong>{invitationSchoolName}</strong></span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 mt-1">Mulai perjalanan mengajar yang lebih cerdas</p>
                )}
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

          {isOtpStep ? (
            /* ===== OTP VERIFICATION SCREEN ===== */
            <form onSubmit={handleVerifyAccountOtp} className="flex flex-col gap-4">
              <TextField
                label="Kode OTP Verifikasi (6 Digit)"
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="123456"
                disabled={loading}
                inputClassName="text-center tracking-[0.3em] font-bold"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-success-600 hover:bg-success-700 text-white font-bold text-sm rounded-button shadow-md shadow-success-200 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <IconLoader2 size={18} stroke={2} className="animate-spin" /> : "Verifikasi & Aktifkan Akun"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setSuccess(null);
                  setLoading(true);
                  try {
                    const res = await apiFetch("/api/auth/otp/request", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: otpUserId, purpose: "account_verification" }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setSuccess(data.message || "OTP berhasil dikirim ulang ke WhatsApp!");
                    } else {
                      setError(data.error || "Gagal mengirim ulang OTP.");
                    }
                  } catch {
                    setError("Masalah jaringan saat mengirim ulang OTP.");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-750 transition-colors cursor-pointer mt-1"
              >
                Kirim Ulang Kode OTP
              </button>
              <button
                type="button"
                onClick={() => { setIsOtpStep(false); setError(null); setSuccess(null); }}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer mt-1"
              >
                <IconArrowLeft size={14} stroke={2} /> Kembali ke Form Pendaftaran
              </button>
            </form>
          ) : (
            /* ===== REGISTRATION FORM SCREEN ===== */
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Nama Lengkap */}
              <TextField
                label="Nama Lengkap & Gelar"
                icon={IconUser}
                type="text"
                name="nama_lengkap"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setNameError(null); }}
                required
                placeholder="Contoh: ElHanum, S.Pd."
                error={nameError}
                disabled={loading}
              />

              {/* Email */}
              <TextField
                label="Alamat Email Aktif"
                icon={IconMail}
                type="email"
                name="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                required
                placeholder="nama@email.com"
                error={emailError}
                disabled={loading || !!invitationToken}
              />

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">No. WhatsApp Aktif</label>
                <div className="relative">
                  <IconPhone
                    size={18}
                    stroke={1.75}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold pointer-events-none">+62</span>
                  <input
                    type="tel"
                    name="whatsapp"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setPhoneError(null); }}
                    required
                    placeholder="81234567xx"
                    disabled={loading || !!invitationToken}
                    className={`w-full rounded-button border bg-white py-2.5 pl-[4.5rem] pr-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-150
                      ${phoneError 
                        ? "border-error-400 focus:border-error-500 focus:ring-2 focus:ring-error-500/20" 
                        : "border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                      }
                      ${(loading || !!invitationToken) ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
                  />
                </div>
                {phoneError && <p className="mt-1 text-xs font-medium text-error-600">{phoneError}</p>}
                <p className="mt-1 text-[10px] text-slate-400 font-medium">Wajib diisi untuk pengiriman kode OTP verifikasi akun.</p>
              </div>

              {/* Peran (Hanya jika bukan via undangan) */}
              {!invitationToken && (
                <SelectField
                  label="Pilih Peran"
                  icon={IconSchool}
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={loading}
                  options={[
                    { value: "guru", label: "Guru Mandiri" },
                    { value: "kepala_sekolah", label: "Kepala Sekolah" },
                    { value: "admin_sekolah", label: "Admin Sekolah" },
                  ]}
                />
              )}

              {/* Password */}
              <div>
                <TextField
                  label="Kata Sandi"
                  icon={IconLock}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  placeholder="Minimal 8 karakter (kombinasi huruf/angka)"
                  error={passwordError}
                  disabled={loading}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
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
                  onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(null); }}
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

              {/* PDP Consent Checkbox */}
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
                    Saya menyetujui pemrosesan data pribadi saya sesuai dengan{" "}
                    <a href="/privacy-policy" target="_blank" className="font-bold text-violet-600 hover:underline">
                      Kebijakan Privasi
                    </a>{" "}
                    dan mematuhi regulasi perlindungan data UU PDP No. 27/2022.
                  </span>
                </label>
                {termsError && <p className="mt-1 text-xs font-medium text-error-600">{termsError}</p>}
              </div>

              {/* Submit button */}
              <SubmitBtn
                label="Daftar & Kirim OTP"
                icon={IconArrowRight}
                loading={loading}
              />
            </form>
          )}

          {/* Invitation info banner */}
          {invitationSchoolName && (
            <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-lg flex items-center gap-3">
              <IconSchool size={20} className="text-violet-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-violet-900">Undangan dari {invitationSchoolName}</p>
                <p className="text-xs text-violet-700">
                  Form di bawah akan menghubungkan akun Anda ke sekolah ini setelah verifikasi.
                </p>
              </div>
            </div>
          )}

          {/* Divider + Google signup */}
          {!isOtpStep && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs font-medium text-slate-400">atau daftar dengan</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <button
                type="button"
                onClick={() => {
                  signInWithGoogle(searchParams, { invitationSchoolName });
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-sm font-semibold text-slate-700 rounded-button transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <GoogleIcon size={18} />
                <span>Daftar dengan Google</span>
              </button>
              {(invitationSchoolName || referralCode) && (
                <p className="mt-2 text-xs text-center text-slate-500">
                  {invitationSchoolName && (
                    <>Anda akan otomatis terhubung ke {invitationSchoolName}. </>
                  )}
                  {referralCode && (
                    <>Kode referral {referralCode} akan otomatis terproses.</>
                  )}
                </p>
              )}
            </>
          )}

          {/* Link to login */}
          {!isOtpStep && (
            <p className="mt-6 text-center text-sm text-slate-500">
              Sudah punya akun?{" "}
              <Link
                href="/login"
                className="font-bold text-violet-600 hover:text-violet-750 transition-colors"
              >
                Masuk
              </Link>
            </p>
          )}
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
