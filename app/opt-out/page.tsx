"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { IconCheck, IconX, IconLoader2 } from "@tabler/icons-react";

function OptOutContent() {
  const searchParams = useSearchParams();
  const contactId = searchParams.get("contact");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() && !phone.trim()) {
      setError("Minimal salah satu dari WhatsApp atau Email wajib diisi");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch("/api/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          phoneNumber: phone.trim() || undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Gagal memproses permintaan");
      }

      setSuccess(result.message);
      setEmail("");
      setPhone("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-violet-700 p-6 text-center">
            <h1 className="text-xl font-bold text-white">Berhenti Menerima</h1>
            <p className="text-violet-200 text-sm mt-1">GuruPRO AI</p>
          </div>

          <div className="p-6">
            {success ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <IconCheck size={32} className="text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Berhasil!</h2>
                <p className="text-gray-600">{success}</p>
                <p className="text-sm text-gray-500 mt-4">
                  Anda tidak akan lagi menerima link ringkasan kinerja dari GuruPRO AI.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-2">
                  Berhenti Menerima Link?
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Masukkan nomor WhatsApp atau email yang digunakan untuk menerima link
                  ringkasan kinerja. Anda akan berhenti menerima link baru.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Nomor WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="08xxxxxxxxxx atau +628xxxxxxxxxx"
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                      disabled={loading}
                    />
                  </div>

                  <div className="text-center text-gray-400 text-sm">atau</div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@contoh.com"
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                      disabled={loading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <IconLoader2 size={18} className="animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      "Berhenti Menerima"
                    )}
                  </button>
                </form>

                <p className="mt-6 text-xs text-gray-500 text-center">
                  Catatan: Decision ini hanya berlaku untuk kontak Anda. Guru lain tetap bisa
                  membagikan ringkasan kepada Anda dengan kontak lain.
                </p>
              </>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-center">
            <a href="/" className="text-sm text-violet-600 hover:text-violet-700">
              Kembali ke GuruPRO AI
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OptOutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <IconLoader2 size={32} className="animate-spin text-violet-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Memuat...</p>
        </div>
      </div>
    }>
      <OptOutContent />
    </Suspense>
  );
}
