"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  IconUser,
  IconFileText,
  IconDownload,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconLock,
  IconMail,
  IconBrandWhatsapp,
  IconLoader2,
  IconSchool,
  IconTableExport,
} from "@tabler/icons-react";

interface KontakInfo {
  id: string;
  namaKontak: string;
  kontakWA: string | null;
  kontakEmail: string | null;
  statusKlaim: string;
  claimedByMemberId: string | null;
}

interface DataRaportSiswa {
  id: string;
  siswa_id: string;
  nisn: string;
  nis_lokal: string;
  nama_siswa: string;
  nama_kelas: string;
  nama_template: string;
  periode: string;
  status: string;
  catatan_wali_kelas: string | null;
  presensi_snapshot: any;
  nomor_absen: number | null;
}

interface TokenResponse {
  kontak: KontakInfo;
  kelasNama: string;
  guruMapelNama: string;
  otpExpiredAt: string;
  dataRaports: DataRaportSiswa[];
}

export default function RaportEksternalPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<TokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otpModal, setOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);
  const [exportWarning, setExportWarning] = useState<string | null>(null);

  const isLinkExpired = data ? new Date() > new Date(data.otpExpiredAt) : false;

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/raport/kontak-eksternal/token/${token}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Gagal memuat data");
      }

      setData(result);
      if (result.otpVerified) {
        setOtpVerified(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (!data) return;
    if (selectedIds.size === data.dataRaports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.dataRaports.map((r) => r.id)));
    }
  };

  const handleRequestOtp = async () => {
    setResendLoading(true);
    setOtpError(null);

    try {
      const res = await apiFetch(`/api/raport/kontak-eksternal/token/${token}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: data?.kontak.kontakWA ? "whatsapp" : "email" }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal mengirim OTP");
      }

      setOtpModal(true);
      setOtpCode("");
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setOtpError("Masukkan kode OTP 6 digit");
      return;
    }

    setOtpLoading(true);
    setOtpError(null);

    try {
      const res = await apiFetch(`/api/raport/kontak-eksternal/token/${token}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpCode, kontakId: data?.kontak.id }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Kode OTP tidak valid");
      }

      setOtpVerified(true);
      setOtpModal(false);
      setOtpCode("");
      await fetchData();
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpLoading(true);
    setOtpError(null);

    try {
      const res = await apiFetch(`/api/raport/kontak-eksternal/token/${token}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: data?.kontak.kontakWA ? "whatsapp" : "email" }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal mengirim ulang OTP");
      }
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!data || selectedIds.size === 0) return;
    setExportLoading(true);

    try {
      const res = await apiFetch(`/api/raport/eksternal/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          dataRaportIds: Array.from(selectedIds),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal generate PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!data || selectedIds.size === 0) return;
    setExportLoading(true);
    setExportWarning(null);

    try {
      const res = await apiFetch(`/api/raport/eksternal/generate-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          dataRaportIds: Array.from(selectedIds),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal generate Excel");
      }

      const result = await res.json();
      if (result.warning) {
        setExportWarning(result.warning);
      }

      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(result.rows);
      XLSX.utils.book_append_sheet(wb, ws, "Raport");
      XLSX.writeFile(wb, `raport-${data.kelasNama}.xlsx`);
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <IconX size={32} className="text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link Tidak Tersedia</h1>
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (isLinkExpired) {
    return (
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
          <IconAlertTriangle size={32} className="text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link Kedaluwarsa</h1>
        <p className="text-gray-500">
          Link akses raport ini sudah tidak berlaku. Hubungi guru terkait untuk meminta link baru.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/30 flex items-center justify-center">
              <IconSchool size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Data Raport Siswa</h1>
              <p className="text-sm text-emerald-100">{data.kelasNama}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <IconUser size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{data.kontak.namaKontak}</p>
              <p className="text-sm text-gray-500">
                Dibagikan oleh: {data.guruMapelNama}
              </p>
            </div>
          </div>

          {!otpVerified ? (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <IconLock size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-amber-900">Verifikasi Diperlukan</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    Untuk melihat dan mengunduh data raport, verifikasi terlebih dahulu melalui
                    {data.kontak.kontakWA ? " WhatsApp" : " Email"} Anda.
                  </p>
                  <button
                    onClick={handleRequestOtp}
                    disabled={resendLoading}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {resendLoading ? (
                      <IconLoader2 size={16} className="animate-spin" />
                    ) : (
                      data.kontak.kontakWA ? <IconBrandWhatsapp size={16} /> : <IconMail size={16} />
                    )}
                    Kirim Kode Verifikasi
                  </button>
                  {otpError && (
                    <p className="mt-2 text-sm text-red-600">{otpError}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {data.dataRaports.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">
                      Data Siswa ({data.dataRaports.length})
                    </h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={selectAll}
                        className="text-sm text-emerald-600 hover:text-emerald-700"
                      >
                        {selectedIds.size === data.dataRaports.length
                          ? "Batalkan Semua"
                          : "Pilih Semua"}
                      </button>
                      <span className="text-sm text-gray-500">
                        {selectedIds.size} terpilih
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {data.dataRaports.map((siswa) => (
                      <label
                        key={siswa.id}
                        className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(siswa.id)}
                          onChange={() => toggleSelect(siswa.id)}
                          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <IconUser size={16} className="text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{siswa.nama_siswa}</p>
                          <p className="text-sm text-gray-500">
                            NISN: {siswa.nisn || '-'} | Periode: {siswa.periode}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            siswa.status === 'siap_print'
                              ? 'bg-green-100 text-green-700'
                              : siswa.status === 'difinalisasi'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {siswa.status}
                        </span>
                      </label>
                    ))}
                  </div>

                  {selectedIds.size > 0 && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={handleDownloadPdf}
                        disabled={exportLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {exportLoading ? (
                          <IconLoader2 size={16} className="animate-spin" />
                        ) : (
                          <IconDownload size={16} />
                        )}
                        Download PDF
                      </button>
                      <button
                        onClick={handleDownloadExcel}
                        disabled={exportLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {exportLoading ? (
                          <IconLoader2 size={16} className="animate-spin" />
                        ) : (
                          <IconTableExport size={16} />
                        )}
                        Download Excel
                      </button>
                    </div>
                  )}

                  {exportWarning && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <IconAlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">{exportWarning}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Halaman ini dibagikan oleh guru terkait melalui{" "}
            <a href="/" className="text-emerald-600 hover:text-emerald-700">
              GuruPRO AI
            </a>
            . Link berlaku hingga{" "}
            {new Date(data.otpExpiredAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
        </div>
      </div>

      {otpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !otpLoading && setOtpModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <button
              onClick={() => !otpLoading && setOtpModal(false)}
              disabled={otpLoading}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <IconX size={20} />
            </button>

            <h3 className="text-lg font-bold text-gray-900 mb-2">Verifikasi OTP</h3>
            <p className="text-sm text-gray-500 mb-4">
              Masukkan kode yang dikirim ke{" "}
              {data.kontak.kontakWA ? "WhatsApp" : "Email"} Anda.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kode OTP
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-2xl tracking-widest px-4 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                maxLength={6}
                disabled={otpLoading}
              />
            </div>

            {otpError && (
              <div className="mb-4 p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600">{otpError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleResendOtp}
                disabled={otpLoading}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Kirim Ulang
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={otpLoading || otpCode.length !== 6}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {otpLoading ? (
                  <IconLoader2 size={18} className="animate-spin mx-auto" />
                ) : (
                  "Verifikasi"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
