"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { handleAuth } from '../actions';

function LoginContent() {
  const searchParams = useSearchParams();
  const [isRegister, setIsRegister] = useState(false);
  
  // Forgot password flow states: 'none' | 'request_otp' | 'verify_otp'
  const [forgotStep, setForgotStep] = useState<'none' | 'request_otp' | 'verify_otp'>('none');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState("");

  // Auto-switch to register mode if URL has mode=register or ref code
  useEffect(() => {
    const mode = searchParams.get('mode');
    const ref = searchParams.get('ref');
    if (mode === 'register' || ref) {
      setIsRegister(true);
    } else {
      setIsRegister(false);
    }
    if (ref) {
      setRefCode(ref.toUpperCase());
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const result = await handleAuth(formData);
    
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  // Request OTP for password reset
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setError("Email wajib diisi!");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        setForgotStep('verify_otp');
      } else {
        setError(data.error || "Gagal mengirim OTP.");
      }
    } catch (err) {
      setError("Masalah koneksi jaringan.");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP & Reset Password
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !newPassword) {
      setError("Kode OTP dan Password Baru wajib diisi!");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail,
          otp: otpCode,
          password: newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        setForgotStep('none');
        setOtpCode('');
        setNewPassword('');
      } else {
        setError(data.error || "Gagal verifikasi OTP.");
      }
    } catch (err) {
      setError("Masalah koneksi jaringan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-indigo-50/50 via-slate-50 to-emerald-50/30 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-100/50 relative overflow-hidden transition-all duration-300">
        
        {/* Top visual accents */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500" />
        
        {/* LOGO & HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-indigo-600 font-sans">
            Guru<span className="text-slate-800">PRO</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 font-medium uppercase tracking-wide">
            Asisten AI & Administrasi Guru Indonesia
          </p>
        </div>

        {/* NOTIFICATION MESSAGES */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-semibold flex items-start gap-2 animate-fadeIn">
            <span>⚠️</span>
            <p className="leading-normal">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-semibold flex items-start gap-2 animate-fadeIn">
            <span>✅</span>
            <p className="leading-normal">{success}</p>
          </div>
        )}

        {/* 1. FORGOT PASSWORD: REQUEST OTP SCREEN */}
        {forgotStep === 'request_otp' && (
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
            <div className="mb-2">
              <h2 className="text-base font-bold text-slate-800 font-sans">Lupa Password Akun</h2>
              <p className="text-xs text-slate-500 mt-1">Masukkan alamat email terdaftar Anda. Kami akan mengirimkan 6-digit kode OTP untuk mereset password Anda.</p>
            </div>
            
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Alamat Email Terdaftar</label>
              <input 
                type="email" 
                required 
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="nama@email.com" 
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition duration-200" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition cursor-pointer"
            >
              {loading ? "Memproses..." : "Kirim Kode OTP"}
            </button>

            <button 
              type="button" 
              onClick={() => { setForgotStep('none'); setError(null); }}
              className="text-xs font-bold text-indigo-600 hover:underline text-center mt-2 cursor-pointer"
            >
              Kembali ke Halaman Masuk
            </button>
          </form>
        )}

        {/* 2. FORGOT PASSWORD: VERIFY OTP SCREEN */}
        {forgotStep === 'verify_otp' && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <div className="mb-2">
              <h2 className="text-base font-bold text-slate-800 font-sans">Verifikasi Kode OTP</h2>
              <p className="text-xs text-slate-500 mt-1">Masukkan kode OTP 6-digit yang kami kirimkan ke email/WA Anda, beserta kata sandi baru Anda.</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Kode OTP (6 Digit)</label>
              <input 
                type="text" 
                required 
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Contoh: 123456" 
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 text-center font-bold tracking-widest text-indigo-600 focus:bg-white focus:border-indigo-500 focus:outline-none transition duration-200" 
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Kata Sandi Baru</label>
              <input 
                type="password" 
                required 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter" 
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition duration-200" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-100 transition cursor-pointer"
            >
              {loading ? "Memverifikasi..." : "Perbarui Kata Sandi"}
            </button>

            <button 
              type="button" 
              onClick={() => { setForgotStep('request_otp'); setError(null); }}
              className="text-xs font-bold text-indigo-600 hover:underline text-center mt-2 cursor-pointer"
            >
              Kirim Ulang Kode OTP
            </button>
          </form>
        )}

        {/* 3. LOGIN & REGISTER SCREEN */}
        {forgotStep === 'none' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input type="hidden" name="auth_mode" value={isRegister ? "register" : "login"} />
            
            {searchParams.get('checkout') && (
              <input type="hidden" name="checkout_plan" value={searchParams.get('checkout') || ""} />
            )}

            {isRegister && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Nama Lengkap &amp; Gelar</label>
                <input 
                  type="text" 
                  name="nama_lengkap" 
                  required 
                  placeholder="Contoh: Andi Wijaya, S.Pd." 
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition duration-200" 
                />
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Alamat Email Aktif</label>
              <input 
                type="email" 
                name="email" 
                required 
                placeholder="nama@email.com" 
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition duration-200" 
              />
            </div>

            {isRegister && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">No. WhatsApp Aktif</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-xs text-slate-400 font-bold">+62</span>
                  <input 
                    type="tel" 
                    name="whatsapp" 
                    required 
                    placeholder="81234567xx" 
                    className="w-full pl-14 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition duration-200" 
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-1 font-medium">Digunakan untuk menerima notifikasi, OTP, dan info pencairan.</p>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Kata Sandi (Password)</label>
                {!isRegister && (
                  <button 
                    type="button" 
                    onClick={() => { setForgotStep('request_otp'); setError(null); }}
                    className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Lupa Sandi?
                  </button>
                )}
              </div>
              <input 
                type="password" 
                name="password" 
                required 
                placeholder="••••••••" 
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition duration-200" 
              />
            </div>

            {isRegister && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Kode Referral (Opsional)</label>
                <input
                  type="text"
                  name="referral_code"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: GPRO-ABCDE"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs uppercase bg-slate-50 font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition duration-200"
                />
                <p className="text-[9px] text-slate-400 mt-1 font-medium">Masukkan kode milik teman Anda untuk mendapatkan bonus tambahan +10 Token kuota.</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition mt-2 cursor-pointer"
            >
              {loading ? "Memproses..." : (isRegister ? "Daftar Akun GuruPRO" : "Masuk ke Dashboard")}
            </button>
          </form>
        )}

        {/* TOGGLE PERALIHAN LOGIN / REGISTER */}
        {forgotStep === 'none' && (
          <div className="mt-8 text-center text-xs border-t border-slate-100 pt-6">
            <button 
              type="button" 
              onClick={() => { setIsRegister(!isRegister); setError(null); setSuccess(null); }} 
              className="text-indigo-600 font-bold hover:underline cursor-pointer"
            >
              {isRegister ? "Sudah punya akun? Masuk Sekarang" : "Belum punya akun? Daftar Sekarang"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-500">Memuat Halaman...</div>}>
      <LoginContent />
    </Suspense>
  );
}