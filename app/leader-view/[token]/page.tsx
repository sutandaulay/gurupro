"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  IconUser,
  IconFileText,
  IconCalendar,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconLock,
  IconMail,
  IconBrandWhatsapp,
  IconLoader2,
  IconExternalLink,
  IconChevronDown,
  IconChevronRight,
  IconBuilding,
} from "@tabler/icons-react";

interface TeacherSummary {
  teacherId: string;
  teacherName: string;
  token: string;
  stats?: Record<string, unknown>;
}

interface Level1Data {
  stats: Record<string, unknown>;
  accessLevel: string;
}

interface Level2Data {
  available: boolean;
  grants: Array<{
    id: string;
    documentCategory: string;
    otpVerified: boolean;
    grantedAt: string;
  }>;
}

interface LeaderViewData {
  teacherName: string;
  period: string;
  shareUrl: string;
  leaderName: string;
  level1: Level1Data;
  level2: Level2Data;
  multiTeacher: {
    hasMultipleTeachers: boolean;
    teachers: TeacherSummary[];
  };
  isOptedOut: boolean;
}

interface AggregatedStats {
  totalActivities?: number;
  onTimeCount?: number;
  lateCount?: number;
  missingCount?: number;
  rppCompletionRate?: number;
  jurnalCompletionRate?: number;
  lastActivityDate?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  rpp_modul_ajar: "RPP / Modul Ajar",
  jurnal_harian: "Jurnal Harian",
  bank_soal: "Bank Soal / Evaluasi",
  lkpd_bahan_ajar: "LKPD / Bahan Ajar",
  presensi_kinerja: "Laporan Presensi & Kinerja",
};

export default function LeaderViewPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<LeaderViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [otpModal, setOtpModal] = useState<{ category: string; open: boolean }>({
    category: "",
    open: false,
  });
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifiedCategories, setVerifiedCategories] = useState<Set<string>>(new Set());
  const [resendLoading, setResendLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/performance-share/token/${token}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Gagal memuat data");
      }

      setData(result);
      if (result.level2?.grants) {
        const verified = new Set(
          result.level2.grants
            .filter((g: { documentCategory: string; otpVerified: boolean }) => g.otpVerified)
            .map((g: { documentCategory: string }) => g.documentCategory)
        );
        setVerifiedCategories(verified);
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

  const toggleTeacherExpand = (teacherId: string) => {
    const newExpanded = new Set(expandedTeachers);
    if (newExpanded.has(teacherId)) {
      newExpanded.delete(teacherId);
    } else {
      newExpanded.add(teacherId);
    }
    setExpandedTeachers(newExpanded);
  };

  const handleRequestOtp = async (category: string, channel: "whatsapp" | "email") => {
    setResendLoading(category);

    try {
      const res = await fetch(`/api/performance-share/token/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grant-access",
          documentCategory: category,
          channel,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal mengirim OTP");
      }

      setOtpModal({ category, open: true });
      setOtpCode("");
      setOtpError(null);
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setResendLoading(null);
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
      const res = await fetch(`/api/performance-share/token/${token}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otpCode,
          documentCategory: otpModal.category,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Kode OTP tidak valid");
      }

      const newVerified = new Set(verifiedCategories);
      newVerified.add(otpModal.category);
      setVerifiedCategories(newVerified);
      setOtpModal({ category: "", open: false });
      setOtpCode("");
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
      const res = await fetch(`/api/performance-share/token/${token}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "whatsapp" }),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-violet-600 border-t-transparent rounded-full mx-auto mb-4" />
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

  const stats = data.level1.stats as AggregatedStats | undefined;

  const getTrafficLight = (rate?: number) => {
    if (rate === undefined || rate === null) return "bg-gray-300";
    if (rate >= 80) return "bg-green-500";
    if (rate >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  const renderStatsCard = (teacherName: string, teacherStats?: AggregatedStats, showDocuments = true) => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
          <IconUser size={20} className="text-violet-600" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">{teacherName}</h2>
          <p className="text-sm text-gray-500">{data.period}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-lg border">
          <p className="text-xs text-gray-500">Total Aktivitas</p>
          <p className="text-xl font-bold text-gray-900">{teacherStats?.totalActivities || 0}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border">
          <p className="text-xs text-gray-500">On Time</p>
          <p className="text-xl font-bold text-green-600">{teacherStats?.onTimeCount || 0}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border">
          <p className="text-xs text-gray-500">Terlambat</p>
          <p className="text-xl font-bold text-amber-600">{teacherStats?.lateCount || 0}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border">
          <p className="text-xs text-gray-500">Belum</p>
          <p className="text-xl font-bold text-red-600">{teacherStats?.missingCount || 0}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium text-gray-700">Kelengkapan per Kategori</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getTrafficLight(teacherStats?.rppCompletionRate)}`} />
            <span className="flex-1 text-sm">RPP/Modul Ajar</span>
            <span className="text-sm font-medium">
              {teacherStats?.rppCompletionRate?.toFixed(0) || 0}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getTrafficLight(teacherStats?.jurnalCompletionRate)}`} />
            <span className="flex-1 text-sm">Jurnal Harian</span>
            <span className="text-sm font-medium">
              {teacherStats?.jurnalCompletionRate?.toFixed(0) || 0}%
            </span>
          </div>
        </div>
      </div>

      {showDocuments && data.level2.available && (
        <div className="pt-4 border-t border-gray-200">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <IconFileText size={18} />
            Dokumen Tersedia
          </h3>
          <div className="space-y-2">
            {data.level2.grants.map((grant) => {
              const isVerified = verifiedCategories.has(grant.documentCategory) || grant.otpVerified;
              return (
                <div
                  key={grant.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                >
                  <span className="text-sm font-medium">
                    {CATEGORY_LABELS[grant.documentCategory] || grant.documentCategory}
                  </span>
                  {isVerified ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <IconCheck size={16} />
                      Terverifikasi
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRequestOtp(grant.documentCategory, "whatsapp")}
                      disabled={resendLoading === grant.documentCategory}
                      className="flex items-center gap-1 px-3 py-1 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 disabled:opacity-50"
                    >
                      {resendLoading === grant.documentCategory ? (
                        <IconLoader2 size={14} className="animate-spin" />
                      ) : (
                        <IconLock size={14} />
                      )}
                      Verifikasi
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-6">
          {data.multiTeacher.hasMultipleTeachers ? (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <IconBuilding size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-bold text-amber-900">
                      {data.multiTeacher.teachers.length + 1} Guru Membagikan Kinerja
                    </h2>
                    <p className="text-sm text-amber-700 mt-1">
                      Anda mengelola beberapa guru. Klik untuk melihat ringkasan masing-masing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => toggleTeacherExpand("main")}
                  className="w-full flex items-center gap-3 p-4 bg-violet-50 rounded-lg border border-violet-200 hover:bg-violet-100 transition-colors"
                >
                  {expandedTeachers.has("main") ? (
                    <IconChevronDown size={20} className="text-violet-600" />
                  ) : (
                    <IconChevronRight size={20} className="text-violet-600" />
                  )}
                  <div className="w-10 h-10 rounded-full bg-violet-200 flex items-center justify-center">
                    <IconUser size={20} className="text-violet-700" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-gray-900">{data.teacherName}</p>
                    <p className="text-sm text-gray-500">Guru Utama</p>
                  </div>
                </button>

                {expandedTeachers.has("main") && (
                  <div className="pl-6">
                    {renderStatsCard(data.teacherName, stats)}
                  </div>
                )}

                {data.multiTeacher.teachers.map((teacher) => (
                  <div key={teacher.teacherId}>
                    <button
                      onClick={() => toggleTeacherExpand(teacher.teacherId)}
                      className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      {expandedTeachers.has(teacher.teacherId) ? (
                        <IconChevronDown size={20} className="text-gray-600" />
                      ) : (
                        <IconChevronRight size={20} className="text-gray-600" />
                      )}
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <IconUser size={20} className="text-gray-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-900">{teacher.teacherName}</p>
                        <p className="text-sm text-gray-500">
                          {teacher.token ? (
                            <a
                              href={`/leader-view/${teacher.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-violet-600 hover:text-violet-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Lihat Halaman
                              <IconExternalLink size={14} />
                            </a>
                          ) : (
                            "Link tidak tersedia"
                          )}
                        </p>
                      </div>
                    </button>

                    {expandedTeachers.has(teacher.teacherId) && teacher.token && (
                      <div className="pl-6 mt-2">
                        <a
                          href={`/leader-view/${teacher.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-4 bg-gray-50 rounded-lg border border-gray-200 text-center text-sm text-violet-600 hover:text-violet-700"
                        >
                          Buka Halaman Guru Ini
                          <IconExternalLink size={14} className="inline ml-1" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 bg-gradient-to-r from-violet-600 to-violet-700 rounded-lg text-white">
                <h3 className="font-bold mb-2">Upgrade ke GuruPRO Institution</h3>
                <p className="text-sm text-violet-100 mb-4">
                  Dapatkan dashboard resmi, laporan otomatis, dan manajemen akses penuh untuk
                  sekolah Anda.
                </p>
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-violet-700 rounded-lg font-medium text-sm hover:bg-violet-50"
                >
                  Lihat Paket Institution
                  <IconExternalLink size={16} />
                </a>
              </div>
            </div>
          ) : (
            renderStatsCard(data.teacherName, stats)
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Halaman ini dibagikan oleh guru terkait melalui{" "}
            <a href="/" className="text-violet-600 hover:text-violet-700">
              GuruPRO AI
            </a>
            .{" "}
            <button className="text-gray-500 hover:text-gray-700 underline">
              Berhenti menerima link seperti ini
            </button>
          </p>
        </div>
      </div>

      {otpModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !otpLoading && setOtpModal({ category: "", open: false })} />
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <button
              onClick={() => !otpLoading && setOtpModal({ category: "", open: false })}
              disabled={otpLoading}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <IconX size={20} />
            </button>

            <h3 className="text-lg font-bold text-gray-900 mb-2">Verifikasi OTP</h3>
            <p className="text-sm text-gray-500 mb-4">
              Masukkan kode yang dikirim ke WhatsApp Anda untuk melihat{" "}
              <strong>{CATEGORY_LABELS[otpModal.category] || otpModal.category}</strong>.
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
                className="w-full text-center text-2xl tracking-widest px-4 py-3 rounded-lg border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
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
                className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg font-medium text-sm hover:bg-violet-700 disabled:opacity-50"
              >
                {otpLoading ? <IconLoader2 size={18} className="animate-spin mx-auto" /> : "Verifikasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
