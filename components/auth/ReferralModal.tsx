"use client";

import { useState, useEffect } from "react";
import {
  IconGift,
  IconLoader2,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconCoin,
} from "@tabler/icons-react";

interface ReferralModalProps {
  onProcessed?: () => void;
}

export default function ReferralModal({ onProcessed }: ReferralModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Check for pending referral code on mount
  useEffect(() => {
    const checkPendingReferral = async () => {
      try {
        const storedCode = localStorage.getItem("referral_code");

        if (storedCode) {
          setReferralCode(storedCode);
          setIsOpen(true);

          // Auto-process the referral code
          await processReferral(storedCode);
        }
      } catch (err) {
        console.error("Failed to check pending referral:", err);
      } finally {
        setChecking(false);
      }
    };

    checkPendingReferral();
  }, []);

  const processReferral = async (code: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/referral/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: code }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        // Clear localStorage
        localStorage.removeItem("referral_code");
        // Notify parent after delay
        setTimeout(() => {
          setIsOpen(false);
          onProcessed?.();
        }, 3000);
      } else if (data.alreadyReferred) {
        // User already has a referral, just dismiss silently
        localStorage.removeItem("referral_code");
        setIsOpen(false);
      } else {
        setError(data.error || "Gagal memproses kode referral");
      }
    } catch (err) {
      console.error("Process referral error:", err);
      setError("Terjadi masalah koneksi");
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    // Don't remove from localStorage, user can try again later
  };

  // Don't render anything while checking or if no pending referral
  if (checking || !isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                {loading ? (
                  <IconLoader2 size={24} className="text-white animate-spin" />
                ) : success ? (
                  <IconCheck size={24} className="text-white" />
                ) : (
                  <IconGift size={24} className="text-white" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {loading ? "Memproses..." : success ? "Berhasil!" : "Kode Referral"}
                </h3>
                <p className="text-emerald-200 text-sm">
                  {loading ? "Mohon tunggu sebentar" : "neo-gurupro"}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {success ? (
              /* ===== SUCCESS STATE ===== */
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <IconCoin size={32} className="text-emerald-600" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">
                  Kode Referral Terproses!
                </h4>
                <p className="text-sm text-slate-600 mb-4">
                  Anda mendapat bonus pendaftaran:
                </p>
                <div className="bg-emerald-50 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-center gap-2 text-emerald-700">
                    <IconCoin size={20} />
                    <span className="font-bold text-lg">+10 Poin</span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-1">
                    Bonus untuk pendaftar baru via referral
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Share kode referral Anda ke teman dan dapatkan rewards! 🎁
                </p>
              </div>
            ) : (
              /* ===== LOADING/ERROR STATE ===== */
              <>
                <div className="text-center mb-4">
                  <p className="text-sm text-slate-600 mb-2">
                    Kode referral ditemukan:
                  </p>
                  <div className="inline-block bg-slate-100 rounded-lg px-4 py-2">
                    <span className="font-bold text-violet-600 text-lg">
                      {referralCode}
                    </span>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <IconAlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleDismiss}
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => referralCode && processReferral(referralCode)}
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <IconLoader2 size={16} className="animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <IconCheck size={16} />
                        Klaim Bonus
                      </>
                    )}
                  </button>
                </div>

                <p className="text-center text-xs text-slate-400 mt-4">
                  Klaim sekarang dan dapatkan +10 poin bonus
                </p>
              </>
            )}
          </div>

          {/* Close button for success */}
          {success && (
            <div className="px-6 pb-6">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onProcessed?.();
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold text-white transition-colors cursor-pointer"
              >
                Lanjutkan ke Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
