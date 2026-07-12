"use client";

import { useState } from "react";
import { IconLock, IconLockOpen, IconCheck, IconX, IconLoader2 } from "@tabler/icons-react";

interface DocumentGrant {
  id: string;
  documentCategory: string;
  otpVerified: boolean;
  grantedAt?: string;
  revokedAt?: string;
}

interface DocumentAccessToggleProps {
  shareLinkId: string;
  category: {
    value: string;
    label: string;
    description: string;
  };
  grant?: DocumentGrant;
  leaderName: string;
  onGrant: (category: string, channel: "whatsapp" | "email") => Promise<void>;
  onRevoke: (grantId: string) => Promise<void>;
  disabled?: boolean;
}

export default function DocumentAccessToggle({
  shareLinkId,
  category,
  grant,
  leaderName,
  onGrant,
  onRevoke,
  disabled = false,
}: DocumentAccessToggleProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<"whatsapp" | "email" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGranted = grant && !grant.revokedAt;
  const isVerified = isGranted && grant.otpVerified;

  const getStatusLabel = () => {
    if (!isGranted) return "Belum Diizinkan";
    if (!isVerified) return "Menunggu Verifikasi";
    return "Aktif";
  };

  const getStatusColor = () => {
    if (!isGranted) return "text-gray-400";
    if (!isVerified) return "text-amber-600";
    return "text-green-600";
  };

  const handleGrant = async () => {
    if (!selectedChannel) {
      setError("Pilih metode pengiriman OTP");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onGrant(category.value, selectedChannel);
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || "Gagal mengirim OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!grant) return;

    setLoading(true);
    setError(null);

    try {
      await onRevoke(grant.id);
    } catch (err: any) {
      setError(err.message || "Gagal mencabut akses");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="p-4 border rounded-lg bg-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">{category.label}</h4>
            <p className="text-sm text-gray-500 mt-0.5">{category.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-medium ${getStatusColor()}`}>
                {getStatusLabel()}
              </span>
              {isGranted && grant.grantedAt && (
                <span className="text-xs text-gray-400">
                  sejak {new Date(grant.grantedAt).toLocaleDateString("id-ID")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {isVerified ? (
              <>
                <button
                  onClick={() => setShowModal(true)}
                  disabled={disabled || loading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconLockOpen size={16} />
                  Cabut
                </button>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                  <IconCheck size={16} className="text-green-600" />
                </div>
              </>
            ) : isGranted ? (
              <button
                onClick={() => setShowModal(true)}
                disabled={disabled || loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-200 text-amber-600 text-sm hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconLoader2 size={16} className="animate-spin" />
                Kirim Ulang OTP
              </button>
            ) : (
              <button
                onClick={() => setShowModal(true)}
                disabled={disabled || loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconLock size={16} />
                Izinkan
              </button>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !loading && setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <button
              onClick={() => !loading && setShowModal(false)}
              disabled={loading}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <IconX size={20} />
            </button>

            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {isGranted && isVerified
                ? "Cabut Izin Akses Dokumen"
                : isGranted
                  ? "Verifikasi OTP"
                  : "Izinkan Akses Dokumen"}
            </h3>

            {isGranted && isVerified ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Anda akan mencabut izin untuk <strong>{leaderName}</strong> melihat{" "}
                  <strong>{category.label}</strong> Anda.
                </p>
                <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                  Setelah dicabut, pimpinan tidak akan bisa melihat dokumen ini lagi.
                </p>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleRevoke}
                    disabled={loading}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? "Mencabut..." : "Cabut Akses"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {isGranted
                    ? `Kirim ulang kode OTP ke ${leaderName} untuk verifikasi:`
                    : `Izinkan ${leaderName} melihat ${category.label} Anda.`}
                </p>

                {!isGranted && (
                  <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
                    <p className="text-xs text-violet-700">
                      <strong>Catatan:</strong> Data keuangan pribadi Anda TIDAK PERNAH termasuk.
                      Anda bisa mencabut izin ini kapan saja.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Metode Verifikasi
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedChannel("whatsapp")}
                      disabled={loading}
                      className={`p-3 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                        selectedChannel === "whatsapp"
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="font-medium text-sm">WhatsApp</div>
                      <div className="text-xs text-gray-500">Kode via WA</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannel("email")}
                      disabled={loading}
                      className={`p-3 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                        selectedChannel === "email"
                          ? "border-violet-500 bg-violet-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="font-medium text-sm">Email</div>
                      <div className="text-xs text-gray-500">Kode via Email</div>
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleGrant}
                    disabled={loading || !selectedChannel}
                    className="flex-1 px-4 py-2 rounded-lg bg-violet-600 text-white font-medium text-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Mengirim..." : isGranted ? "Kirim Ulang" : "Izinkan"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
