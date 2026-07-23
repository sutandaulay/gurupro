"use client";

import { useState } from "react";

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  onAction: (action: string) => void;
  onRefresh: () => void;
}

export default function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
  onAction,
  onRefresh
}: TransactionDetailModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  if (!isOpen || !transaction) return null;

  const getPlanName = (planId: string) => {
    const plans: Record<string, string> = {
      "three_month": "GuruPRO Premium 3 Bulan",
      "six_month": "GuruPRO Premium 6 Bulan",
      "one_year": "GuruPRO Premium 1 Tahun",
      "free": "GuruPRO Free",
      "pro_monthly": "GuruPRO Pro Bulanan",
      "pro_yearly": "GuruPRO Pro Tahunan"
    };
    return plans[planId || ""] || planId || "Unknown";
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; bg: string; icon: string; label: string }> = {
      "PENDING": { color: "text-amber-700", bg: "bg-amber-100 border-amber-200", icon: "⏳", label: "Menunggu Pembayaran" },
      "PAID": { color: "text-blue-700", bg: "bg-blue-100 border-blue-200", icon: "💰", label: "Sudah Dibayar (Belum Aktif)" },
      "ACTIVATED": { color: "text-emerald-700", bg: "bg-emerald-100 border-emerald-200", icon: "✅", label: "Aktif" },
      "REFUNDED": { color: "text-rose-700", bg: "bg-rose-100 border-rose-200", icon: "↩️", label: "Direfund" },
      "EXPIRED": { color: "text-slate-700", bg: "bg-slate-100 border-slate-200", icon: "⏰", label: "Kadaluarsa" },
      "CANCELLED": { color: "text-slate-700", bg: "bg-slate-100 border-slate-200", icon: "❌", label: "Dibatalkan" }
    };
    return configs[status] || { color: "text-slate-700", bg: "bg-slate-100 border-slate-200", icon: "❓", label: status };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const statusConfig = getStatusConfig(transaction.status);

  const handleAction = async (action: string) => {
    setIsProcessing(true);
    setShowConfirm(null);

    try {
      await onAction(action);
      onRefresh();
      onClose();
    } catch (error) {
      console.error("Action error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getActionButtons = () => {
    const buttons = [];

    if (transaction.status === "PENDING") {
      buttons.push(
        { action: "resend_invoice", label: "📧 Kirim Ulang Invoice", color: "bg-indigo-600 hover:bg-indigo-700", confirmMsg: "Kirim ulang invoice ke email customer?" },
        { action: "follow_up", label: "📧 Kirim Follow-Up", color: "bg-amber-600 hover:bg-amber-700", confirmMsg: "Kirim pesan pengingat ke customer?" },
        { action: "expire", label: "⏰ Jadikan Kadaluarsa", color: "bg-slate-600 hover:bg-slate-700", confirmMsg: "Tandai transaksi ini sebagai kadaluarsa?" },
        { action: "cancel", label: "❌ Batalkan", color: "bg-rose-600 hover:bg-rose-700", confirmMsg: "Batalkan transaksi ini?" }
      );
    }

    if (transaction.status === "EXPIRED") {
      buttons.push(
        { action: "resend_invoice", label: "📧 Kirim Ulang Invoice", color: "bg-indigo-600 hover:bg-indigo-700", confirmMsg: "Kirim ulang invoice ke email customer?" }
      );
    }

    if (transaction.status === "PAID") {
      buttons.push(
        { action: "activate", label: "✅ Aktifkan Paket", color: "bg-emerald-600 hover:bg-emerald-700", confirmMsg: "Aktifkan paket untuk customer ini? Kuota poin akan ditambahkan." },
        { action: "refund", label: "↩️ Refund", color: "bg-rose-600 hover:bg-rose-700", confirmMsg: "Refund transaksi ini? Poin customer akan dipotong." }
      );
    }

    if (transaction.status === "ACTIVATED") {
      buttons.push(
        { action: "refund", label: "↩️ Refund", color: "bg-rose-600 hover:bg-rose-700", confirmMsg: "Refund transaksi ini? Poin customer akan dipotong dan status langganan dikembalikan ke free." }
      );
    }

    return buttons;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                💳 Detail Transaksi
              </h2>
              <p className="text-slate-300 text-xs mt-1 font-mono">
                {transaction.id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-xl transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Badge */}
          <div className={`p-4 rounded-2xl border ${statusConfig.bg}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-lg font-black ${statusConfig.color}`}>
                  {statusConfig.icon} {statusConfig.label}
                </span>
                <p className={`text-xs ${statusConfig.color} mt-1`}>
                  Status terakhir diperbarui: {transaction.updated_at ? formatDate(transaction.updated_at) : "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
              Detail Pembelian
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Invoice / External ID</span>
                <p className="font-mono text-sm text-slate-800 mt-1">{transaction.external_id || "-"}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Paket Langganan</span>
                <p className="font-bold text-sm text-slate-800 mt-1">{getPlanName(transaction.plan_id)}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Jumlah Pembayaran</span>
                <p className="font-black text-lg text-emerald-600 mt-1">{formatCurrency(transaction.amount)}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Metode Pembayaran</span>
                <p className="font-bold text-sm text-slate-800 mt-1">{transaction.payment_method || "Menunggu..."}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Tanggal Dibuat</span>
                <p className="font-medium text-sm text-slate-800 mt-1">{formatDate(transaction.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
              Informasi Customer
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Nama Lengkap</span>
                <p className="font-bold text-sm text-slate-800 mt-1">{transaction.nama_lengkap || "-"}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Email</span>
                <p className="font-medium text-sm text-slate-800 mt-1">{transaction.email}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Nomor WhatsApp</span>
                <p className="font-mono text-sm text-indigo-600 mt-1">+{transaction.whatsapp || "-"}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {transaction.notes && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
                Catatan
              </h3>
              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">{transaction.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          {getActionButtons().length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
                Aksi Cepat
              </h3>

              {showConfirm ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-bold text-amber-800">{showConfirm}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowConfirm(null)}
                      className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleAction(showConfirm === "Aktifkan paket untuk customer ini? Kuota poin akan ditambahkan." ? "activate" :
                        showConfirm === "Refund transaksi ini? Poin customer akan dipotong." ? "refund" :
                        showConfirm === "Kirim ulang invoice ke email customer?" ? "resend_invoice" :
                        showConfirm === "Kirim pesan pengingat ke customer?" ? "follow_up" :
                        showConfirm === "Tandai transaksi ini sebagai kadaluarsa?" ? "expire" :
                        showConfirm === "Batalkan transaksi ini?" ? "cancel" : "")}
                      disabled={isProcessing}
                      className="flex-1 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition disabled:opacity-50"
                    >
                      {isProcessing ? "Memproses..." : "Konfirmasi"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {getActionButtons().map((btn, idx) => (
                    <button
                      key={idx}
                      onClick={() => setShowConfirm(btn.confirmMsg)}
                      disabled={isProcessing}
                      className={`py-2.5 px-3 text-xs font-bold text-white rounded-xl transition disabled:opacity-50 ${btn.color}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}