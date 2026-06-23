"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

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

  const formattedAmount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(amount));

  const handleSimulatePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Panggil webhook lokal untuk mensimulasikan callback sukses pembayaran Xendit
      const response = await fetch("/api/webhook/xendit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PAID",
          id: invoiceId,
          amount: Number(amount),
          payment_method: paymentMethod === "qris" ? "QRIS" : "VIRTUAL_ACCOUNT",
          userId: userId,
          plan: plan,
          isMock: true // Penanda simulasi internal
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal mengirim status pembayaran.");
      }

      // Berhasil -> Redirect kembali ke dashboard dengan parameter sukses
      router.push(`/dashboard?payment=success&tx=${invoiceId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal mensimulasikan pembayaran. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-1.5">
            <span className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-white text-sm shadow">X</span>
            <span className="text-sm font-bold tracking-tight text-slate-300">Xendit <span className="text-[10px] text-indigo-400 font-extrabold px-1.5 py-0.5 bg-indigo-950 border border-indigo-900 rounded-full uppercase ml-1">Mock Gateway</span></span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">PENDING</span>
        </div>

        {/* Amount */}
        <div className="text-center bg-slate-950/60 border border-slate-800/80 rounded-2xl py-5 px-4 mb-6">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block mb-1">Total Tagihan</span>
          <h2 className="text-2xl font-black text-white tracking-tight">{formattedAmount}</h2>
          <p className="text-[10px] text-slate-500 mt-1 font-mono">Invoice ID: {invoiceId.substring(0, 8)}...</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-900/60 text-rose-300 rounded-xl text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Payment Method Selector */}
        <div className="mb-6">
          <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wide">Pilih Metode Pembayaran Simulasi</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod("qris")}
              className={`p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center gap-2 cursor-pointer ${
                paymentMethod === "qris"
                  ? "border-indigo-500 bg-indigo-600/10 text-indigo-400"
                  : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className="text-2xl">📱</span>
              QRIS / Gopay / OVO
            </button>
            <button
              onClick={() => setPaymentMethod("va")}
              className={`p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center gap-2 cursor-pointer ${
                paymentMethod === "va"
                  ? "border-indigo-500 bg-indigo-600/10 text-indigo-400"
                  : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className="text-2xl">🏦</span>
              Virtual Account Bank
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-950/30 border border-slate-800/40 rounded-2xl p-4 text-xs text-slate-400 mb-6 space-y-2 leading-relaxed">
          <p className="font-semibold text-slate-300">💡 Instruksi Simulasi:</p>
          {paymentMethod === "qris" ? (
            <ol className="list-decimal pl-4 space-y-1">
              <li>Pindai Kode QR simulasi yang terbayangkan di layar Anda.</li>
              <li>Klik tombol <strong>Bayar Sekarang</strong> di bawah untuk memproses verifikasi instan.</li>
            </ol>
          ) : (
            <ol className="list-decimal pl-4 space-y-1">
              <li>Transfer dana simulasi ke VA: <strong>8856-1293-8409</strong></li>
              <li>Klik tombol <strong>Bayar Sekarang</strong> di bawah untuk memproses verifikasi instan.</li>
            </ol>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleSimulatePayment}
          disabled={loading}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0 transition duration-200 cursor-pointer text-center"
        >
          {loading ? "Memproses Verifikasi..." : "⚡ Bayar Sekarang"}
        </button>

        {/* Safety Warning */}
        <p className="text-[10px] text-slate-500 text-center mt-4">
          Ini adalah gerbang pembayaran simulasi internal untuk tahap pengujian lokal GuruPRO. Tidak ada saldo nyata yang ditarik.
        </p>

      </div>
    </div>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm font-semibold text-slate-500">Memuat Gerbang Simulasi...</div>}>
      <MockCheckoutContent />
    </Suspense>
  );
}
