/**
 * TokenHabisModal Component
 *
 * Modal yang muncul saat token tidak mencukupi.
 * Memberikan opsi:
 * 1. Beli Token Eceran (Top-Up)
 * 2. Upgrade Paket
 * 3. Hubungi Admin
 *
 * Usage:
 * ```tsx
 * const { showTokenModal, shortfall, closeModal, openTopUpModal } = useTokenError();
 *
 * <TokenHabisModal
 *   open={showTokenModal}
 *   shortfall={shortfall}
 *   onClose={closeModal}
 *   onBuyTopUp={openTopUpModal}
 *   onUpgrade={() => router.push('/pricing')}
 * />
 * ```
 */

"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { IconX, IconCreditCard, IconRocket, IconHelp } from "@tabler/icons-react";

// Lazy load TopUp modal to avoid SSR issues
const TokenTopUpModal = dynamic(() => import("./TokenTopUpModal"), { ssr: false });

interface TokenHabisModalProps {
  open: boolean;
  shortfall?: number;
  currentAddon?: number;
  onClose: () => void;
  onBuyTopUp?: () => void;
  onUpgrade?: () => void;
  userId?: string | null;
}

export default function TokenHabisModal({
  open,
  shortfall = 0,
  currentAddon = 0,
  onClose,
  onBuyTopUp,
  onUpgrade,
  userId,
}: TokenHabisModalProps) {
  const [showTopUpInner, setShowTopUpInner] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowTopUpInner(false);
    }
  }, [open]);

  if (!open) return null;

  const handleBuyTopUp = () => {
    setShowTopUpInner(true);
    onBuyTopUp?.();
  };

  const handleCloseTopUp = () => {
    setShowTopUpInner(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
          {/* Header - Gradient */}
          <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Token Habis!</h3>
                  <p className="text-xs text-violet-100">
                    Kuota utama Anda sudah terpakai
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              >
                <IconX size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">
                    Butuh {shortfall > 0 ? shortfall : "~"} Token Lagi
                  </p>
                  <p className="text-xs text-amber-700">
                    {currentAddon > 0
                      ? `Anda masih punya ${currentAddon} token ekstra yang bisa dipakai setelah kuota utama habis.`
                      : "Kuota utama reset setiap awal bulan. Beli token ekstra untuk kebutuhan tambahan."}
                  </p>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {/* Option 1: Beli Token Ekstra */}
              <button
                onClick={handleBuyTopUp}
                className="w-full flex items-center gap-4 p-4 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                  <IconCreditCard size={24} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">Beli Token Ekstra</p>
                  <p className="text-xs text-gray-500">
                    Top-up instan, langsung bisa dipakai
                  </p>
                </div>
                <span className="text-violet-600 font-bold">→</span>
              </button>

              {/* Option 2: Upgrade Paket */}
              <button
                onClick={onUpgrade}
                className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-amber-100/50 hover:from-amber-100 hover:to-amber-100 border border-amber-200 rounded-xl transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                  <IconRocket size={24} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">Upgrade Paket</p>
                  <p className="text-xs text-gray-500">
                    Dapatkan kuota lebih besar & fitur premium
                  </p>
                </div>
                <span className="text-amber-600 font-bold">→</span>
              </button>

              {/* Option 3: Hubungi Admin */}
              <a
                href="https://wa.me/6281283960337"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-600 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                  <IconHelp size={24} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">Butuh Bantuan?</p>
                  <p className="text-xs text-gray-500">
                    Hubungi admin untuk solusi custom
                  </p>
                </div>
                <span className="text-gray-600 font-bold">→</span>
              </a>
            </div>

            {/* Footer Note */}
            <p className="mt-5 text-center text-xs text-gray-400">
              Token ekstra tidak hangus saat reset bulanan.
              <br />
              Sisa token utama tidak diakumulasi ke bulan berikutnya.
            </p>
          </div>
        </div>
      </div>

      {/* Nested Top-Up Modal */}
      {showTopUpInner && (
        <div className="fixed inset-0 z-[110]">
          <TokenTopUpModal
            open={showTopUpInner}
            onClose={handleCloseTopUp}
            userId={userId}
          />
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoom-in {
          from { transform: scale(0.95); }
          to { transform: scale(1); }
        }
        .animate-in {
          animation: fade-in 0.2s ease-out, zoom-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
