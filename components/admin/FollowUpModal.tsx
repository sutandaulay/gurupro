"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  onSuccess: () => void;
}

// Helper function outside component
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

// Format nomor WhatsApp ke format Indonesia (+62)
const formatWALink = (phone: string): string => {
  if (!phone) return "";
  // Hapus semua karakter non-digit
  const digits = phone.replace(/\D/g, "");
  // Jika dimulai dengan 0, ganti dengan 62
  if (digits.startsWith("0")) {
    return "62" + digits.slice(1);
  }
  // Jika sudah dimulai dengan 62, biarkan
  if (digits.startsWith("62")) {
    return digits;
  }
  // Jika dimulai dengan +, hapus dan proses
  return digits;
};

// Format tampilan nomor WA
const formatWADisplay = (phone: string): string => {
  if (!phone) return "-";
  const formatted = formatWALink(phone);
  return `+${formatted}`;
};

export default function FollowUpModal({ isOpen, onClose, transaction, onSuccess }: FollowUpModalProps) {
  const [channel, setChannel] = useState<"email" | "whatsapp" | "both">("whatsapp"); // Default ke WhatsApp
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Initialize default messages when transaction changes
  useEffect(() => {
    if (transaction) {
      const planName = getPlanName(transaction.plan_id);
      const amount = Number(transaction.amount || 0);
      const customerName = transaction.nama_lengkap || "Pelanggan";

      const defaultEmailSubject = `Pengingat Pembayaran GuruPRO - Invoice #${transaction.external_id}`;
      const defaultEmailBody = `Halo ${customerName},

Kami dari GuruPRO ingin mengingatkan bahwa pembayaran untuk paket premium Anda dengan detail sebagai berikut:

📋 Detail Invoice:
- Invoice #: ${transaction.external_id}
- Paket: ${planName}
- Jumlah: Rp ${amount.toLocaleString("id-ID")}
- Status: BELUM DIBAYAR

⏰ Mohon segera menyelesaikan pembayaran untuk menikmati semua fitur premium GuruPRO.

Jika Anda sudah melakukan pembayaran, mohon abaikan pesan ini atau hubungi tim kami.

Terima kasih atas kepercayaan Anda menggunakan GuruPRO.

Salam,
Tim GuruPRO`;

      const defaultWaMessage = `Halo ${customerName} 👋

Kami dari GuruPRO ingin mengingatkan bahwa pembayaran untuk paket premium Anda:

📦 Paket: ${planName}
💰 Jumlah: Rp ${amount.toLocaleString("id-ID")}
📄 Invoice: ${transaction.external_id}

⏰ Segera selesaikan pembayaran untuk menikmati fitur premium GuruPRO!

Terima kasih 🙏`;

      const timer = setTimeout(() => {
        setEmailSubject(defaultEmailSubject);
        setEmailBody(defaultEmailBody);
        setWaMessage(defaultWaMessage);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [transaction]);

  // Reset result when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setResult(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen || !transaction) return null;

  const handleSend = async () => {
    if ((channel === "email" || channel === "both") && !emailBody.trim()) {
      alert("Pesan email wajib diisi!");
      return;
    }
    if ((channel === "whatsapp" || channel === "both") && !waMessage.trim()) {
      alert("Pesan WhatsApp wajib diisi!");
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const res = await apiFetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transaction.id,
          action: "follow_up",
          followUpChannel: channel,
          followUpMessage: {
            emailSubject,
            emailBody,
            waMessage
          }
        })
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        onSuccess();
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsSending(false);
    }
  };

  const formatCurrency = (amount: any) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(Number(amount) || 0);
  };

  const getChannelLabel = () => {
    if (channel === "whatsapp") return "WhatsApp";
    if (channel === "both") return "Email & WhatsApp";
    return "Email";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                💬 Kirim Follow-Up
              </h2>
              <p className="text-green-100 text-xs mt-1">
                Kirim pengingat pembayaran via {getChannelLabel()}
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

        {/* Transaction Info */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wide">Customer</span>
              <p className="font-bold text-slate-800 mt-1">{transaction.nama_lengkap || "(Tidak ada nama)"}</p>
              <p className="text-slate-500">{transaction.email}</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wide">WhatsApp</span>
              <p className="font-mono text-green-600 mt-1 font-bold">{formatWADisplay(transaction.whatsapp)}</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wide">Jumlah</span>
              <p className="font-black text-lg text-slate-800 mt-1">{formatCurrency(transaction.amount)}</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wide">Status</span>
              <p className="font-bold text-amber-600 mt-1">
                <span className="inline-block px-2 py-0.5 bg-amber-100 rounded-full text-[10px]">
                  ⏳ {transaction.status}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Channel Selection */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-2">
              Pilih Channel Pengiriman
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setChannel("email")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  channel === "email"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>📧</span> Email Saja
              </button>
              <button
                onClick={() => setChannel("whatsapp")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  channel === "whatsapp"
                    ? "bg-green-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>💬</span> WhatsApp Saja
              </button>
              <button
                onClick={() => setChannel("both")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  channel === "both"
                    ? "bg-purple-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>📱</span> Keduanya
              </button>
            </div>
          </div>

          {/* WhatsApp Section - Dulu karena prioritas */}
          {(channel === "whatsapp" || channel === "both") && (
            <div className="space-y-3 p-4 bg-green-50/50 rounded-2xl border border-green-200">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <h4 className="text-xs font-bold text-green-700 uppercase tracking-wide">
                  Pesan WhatsApp
                </h4>
                <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                  Direkomendasikan
                </span>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Nomor Tujuan
                </label>
                <div className="px-3 py-2 bg-green-100 border border-green-200 rounded-xl text-xs font-mono font-bold text-green-700">
                  {formatWADisplay(transaction.whatsapp)}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Isi Pesan WhatsApp</label>
                <textarea
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-green-200 rounded-xl text-xs bg-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Isi pesan WhatsApp..."
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[9px] text-slate-400">
                    Karakter: {waMessage.length}/1000
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const waNumber = formatWALink(transaction.whatsapp || "");
                      const linkWA = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;
                      window.open(linkWA, "_blank");
                    }}
                    className="text-[9px] text-green-600 font-bold hover:text-green-800"
                  >
                    💬 Buka di WhatsApp →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Section */}
          {(channel === "email" || channel === "both") && (
            <div className="space-y-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200">
              <div className="flex items-center gap-2">
                <span className="text-lg">📧</span>
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                  Pesan Email
                </h4>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Subjek Email</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-indigo-200 rounded-xl text-xs bg-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Subject email..."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Isi Pesan Email</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-indigo-200 rounded-xl text-xs bg-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Isi pesan email..."
                />
              </div>
            </div>
          )}

          {/* Preview Info */}
          <div className="bg-slate-100 rounded-xl p-3 text-[10px] text-slate-500">
            <p className="font-bold text-slate-600 mb-1">📋 Ringkasan Pengiriman:</p>
            <div className="grid grid-cols-2 gap-2">
              <p>• Channel: <span className="font-bold">{getChannelLabel()}</span></p>
              <p>• Paket: <span className="font-bold">{getPlanName(transaction.plan_id)}</span></p>
              <p>• Jumlah: <span className="font-bold">{formatCurrency(transaction.amount)}</span></p>
              <p>• Invoice: <span className="font-bold">{transaction.external_id}</span></p>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`p-4 rounded-2xl ${
              result.success ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"
            }`}>
              {result.success ? (
                <div>
                  <p className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                    <span className="text-lg">✅</span> {result.message || "Berhasil Dikirim!"}
                  </p>
                  {result.results && (
                    <div className="mt-2 space-y-1 text-[10px] text-emerald-600">
                      {result.results.email?.success && (
                        <p className="flex items-center gap-1">
                          <span>✓</span> Email berhasil dikirim ke {transaction.email}
                        </p>
                      )}
                      {result.results.whatsapp?.success && (
                        <p className="flex items-center gap-1">
                          <span>✓</span> WhatsApp berhasil dikirim ke {formatWADisplay(transaction.whatsapp)}
                        </p>
                      )}
                      {result.results.email?.reason && !result.results.email?.success && (
                        <p className="flex items-center gap-1 text-rose-600">
                          <span>✗</span> Email gagal: {result.results.email.reason}
                        </p>
                      )}
                      {result.results.whatsapp?.reason && !result.results.whatsapp?.success && (
                        <p className="flex items-center gap-1 text-rose-600">
                          <span>✗</span> WhatsApp gagal: {result.results.whatsapp.reason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs font-bold text-rose-700 flex items-center gap-2">
                  <span className="text-lg">❌</span> {result.error || "Gagal mengirim follow-up"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition"
          >
            Batal
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="px-6 py-2.5 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2 shadow-lg"
          >
            {isSending ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Mengirim...
              </>
            ) : (
              <>
                <span>{channel === "whatsapp" ? "💬" : channel === "both" ? "📱" : "📧"}</span>
                Kirim via {getChannelLabel()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}