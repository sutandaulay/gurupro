"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import {
  IconLoader2,
  IconCheck,
  IconX,
  IconBarcode,
  IconBuildingBank,
  IconCreditCard,
} from "@tabler/icons-react";

function MockCheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const invoiceId = searchParams.get("invoice_id") || "";
  const amount = searchParams.get("amount") || "49000";
  const userId = searchParams.get("userId") || "";
  const plan = searchParams.get("plan") || "pro_monthly";

  const [paymentMethod, setPaymentMethod] = useState<"qris" | "va">("qris");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const formattedAmount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(amount));

  // Countdown timer for simulated payment processing
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSimulatePayment = async () => {
    setLoading(true);
    setError(null);
    setCountdown(3); // Simulate 3 second processing time

    // Wait for countdown
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const pmLabel = paymentMethod === "qris" ? "QRIS" : "VIRTUAL_ACCOUNT";
      // Call mock checkout API to verify transaction and grant tokens
      const response = await fetch(`/api/checkout/mock?invoice_id=${invoiceId}&userId=${userId}&payment_method=${pmLabel}`, {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal memverifikasi pembayaran.");
      }

      // Successful payment simulation -> redirect back to dashboard
      router.push(data.redirect || `/dashboard?payment=success&tx=${invoiceId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal mensimulasikan pembayaran. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col justify-center items-center p-4 font-sans">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">

        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg">
              <IconCreditCard size={18} />
            </span>
            <div>
              <span className="text-sm font-bold tracking-tight text-white">GuruPRO</span>
              <span className="block text-[10px] text-indigo-400 font-medium">Simulasi Pembayaran</span>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            PENDING
          </span>
        </div>

        {/* Amount */}
        <div className="text-center bg-gradient-to-br from-slate-900/60 to-slate-800/40 border border-slate-700/50 rounded-2xl py-6 px-4 mb-6">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block mb-2">Total Tagihan</span>
          <h2 className="text-3xl font-black text-white tracking-tight">{formattedAmount}</h2>
          <p className="text-[10px] text-slate-500 mt-2 font-mono">Invoice: {invoiceId.substring(0, 12)}...</p>
        </div>

        {/* Payment Method Selector */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-slate-400 block mb-3 uppercase tracking-wide">Pilih Metode Pembayaran</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod("qris")}
              className={`p-4 rounded-2xl border transition flex flex-col items-center gap-2 cursor-pointer ${
                paymentMethod === "qris"
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                  : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600"
              }`}
            >
              <IconBarcode size={28} stroke={1.5} />
              <span className="text-[10px] font-bold">QRIS</span>
              <span className="text-[9px] text-slate-500">GoPay, OVO, DANA</span>
            </button>
            <button
              onClick={() => setPaymentMethod("va")}
              className={`p-4 rounded-2xl border transition flex flex-col items-center gap-2 cursor-pointer ${
                paymentMethod === "va"
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                  : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600"
              }`}
            >
              <IconBuildingBank size={28} stroke={1.5} />
              <span className="text-[10px] font-bold">Virtual Account</span>
              <span className="text-[9px] text-slate-500">BCA, Mandiri, BRI</span>
            </button>
          </div>
        </div>

        {/* Instructions */}
        {paymentMethod === "qris" ? (
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <IconBarcode size={16} className="text-indigo-400" />
              <p className="text-[10px] font-bold text-indigo-300 uppercase">Petunjuk Pembayaran QRIS</p>
            </div>
            <ol className="text-[10px] text-slate-400 space-y-1.5 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold">1.</span>
                Buka aplikasi e-wallet (GoPay, OVO, DANA, dll.)
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold">2.</span>
                Pilih menu "Scan QR" atau "Bayar QR"
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold">3.</span>
                Pindai kode QR yang tampil di layar Anda
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold">4.</span>
                Masukkan PIN dan konfirmasi pembayaran
              </li>
            </ol>
          </div>
        ) : (
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <IconBuildingBank size={16} className="text-indigo-400" />
              <p className="text-[10px] font-bold text-indigo-300 uppercase">Petunjuk Virtual Account</p>
            </div>
            <ol className="text-[10px] text-slate-400 space-y-1.5 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold">1.</span>
                Buka aplikasi mobile banking Anda
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold">2.</span>
                Pilih menu "Transfer" → "Virtual Account Billing"
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold">3.</span>
                Masukkan nomor VA: <strong className="text-indigo-300">8800 + invoice ID</strong>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold">4.</span>
                Masukkan nominal ({formattedAmount}) dan konfirmasi
              </li>
            </ol>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-2">
            <IconX size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Success Indicator */}
        {loading && countdown === 0 && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2">
            <IconCheck size={16} className="flex-shrink-0 animate-pulse" />
            Pembayaran berhasil diverifikasi! Mengalihkan ke dashboard...
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleSimulatePayment}
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer text-center disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <IconLoader2 size={18} stroke={2} className="animate-spin" />
              {countdown > 0 ? `Memproses Pembayaran... ${countdown}s` : "Mengarahkan ke Dashboard..."}
            </>
          ) : (
            <>
              <IconCheck size={18} stroke={2} />
              Bayar Sekarang - {formattedAmount}
            </>
          )}
        </button>

        {/* Safety Warning */}
        <p className="text-[9px] text-slate-500 text-center mt-4 leading-relaxed">
          ⚠️ Ini adalah gerbang pembayaran <strong className="text-slate-400">SIMULASI</strong> untuk tahap pengujian lokal.
          Tidak ada saldo nyata yang ditarik atau diproses.
        </p>
      </div>
    </div>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <IconLoader2 size={32} stroke={2} className="animate-spin text-indigo-500" />
          <span className="text-sm font-semibold text-slate-500">Memuat Gerbang Pembayaran...</span>
        </div>
      </div>
    }>
      <MockCheckoutContent />
    </Suspense>
  );
}
