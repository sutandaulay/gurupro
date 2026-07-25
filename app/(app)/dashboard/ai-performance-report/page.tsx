"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback } from "react";
import PerformanceSharePanel from "@/app/components/performance-share/PerformanceSharePanel";
import { useActiveSchool } from "@/lib/stores";

interface AggregatedStats {
  period: string;
  totalActivities: number;
  completedActivities: number;
  onTimeCount: number;
  lateCount: number;
  missingCount: number;
  rppCompletionRate: number;
  jurnalCompletionRate: number;
  bankSoalCompletionRate: number;
  lkpdCompletionRate: number;
  totalRpp: number;
  totalJurnal: number;
  totalBankSoal: number;
  totalLkpd: number;
  totalAssessments: number;
  lastActivityDate: string;
}

interface UserSession {
  id: string;
  nama_lengkap: string;
  email: string;
}

export default function AiPerformanceReportPage() {
  const { activeSchoolId } = useActiveSchool();
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeSchoolId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch user session
      const sessionRes = await apiFetch("/api/me");
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setUser(sessionData.user || null);
      }

      // Fetch aggregated stats
      const statsRes = await apiFetch(`/api/aggregated-stats?school_id=${activeSchoolId}`);
      if (!statsRes.ok) {
        throw new Error("Gagal mengambil data statistik");
      }
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeSchoolId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTrafficLight = (rate?: number) => {
    if (rate === undefined || rate === null) return { bg: "bg-gray-300", label: "Tidak ada data" };
    if (rate >= 80) return { bg: "bg-green-500", label: "Baik" };
    if (rate >= 50) return { bg: "bg-amber-500", label: "Perlu Perbaikan" };
    return { bg: "bg-red-500", label: "Rendah" };
  };

  if (!activeSchoolId) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-bold text-amber-900 mb-2">Pilih Sekolah</h2>
          <p className="text-amber-700">Silakan pilih sekolah terlebih dahulu untuk melihat laporan.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500">Memuat data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-bold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const rppLight = getTrafficLight(stats?.rppCompletionRate);
  const jurnalLight = getTrafficLight(stats?.jurnalCompletionRate);
  const bankSoalLight = getTrafficLight(stats?.bankSoalCompletionRate);
  const lkpdLight = getTrafficLight(stats?.lkpdCompletionRate);

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">
            🤖
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Performance Report</h1>
            <p className="text-violet-200 mt-1">
              {stats?.period || "Periode ini"}
            </p>
            {user && (
              <p className="text-violet-200 text-sm mt-1">
                {user.nama_lengkap}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Aktivitas</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalActivities || 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Selesai</p>
          <p className="text-2xl font-bold text-green-600">{stats?.completedActivities || 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Terlambat</p>
          <p className="text-2xl font-bold text-amber-600">{stats?.lateCount || 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Belum</p>
          <p className="text-2xl font-bold text-red-600">{stats?.missingCount || 0}</p>
        </div>
      </div>

      {/* Completion Rates */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Kelengkapan per Kategori</h2>
        <div className="space-y-4">
          {/* RPP/Modul Ajar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${rppLight.bg}`} />
                <span className="font-medium text-gray-900">RPP / Modul Ajar</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{stats?.totalRpp || 0} dokumen</span>
                <span className="text-sm font-bold">{stats?.rppCompletionRate || 0}%</span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${rppLight.bg}`}
                style={{ width: `${stats?.rppCompletionRate || 0}%` }}
              />
            </div>
          </div>

          {/* Jurnal Harian */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${jurnalLight.bg}`} />
                <span className="font-medium text-gray-900">Jurnal Harian</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{stats?.totalJurnal || 0} entries</span>
                <span className="text-sm font-bold">{stats?.jurnalCompletionRate || 0}%</span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${jurnalLight.bg}`}
                style={{ width: `${stats?.jurnalCompletionRate || 0}%` }}
              />
            </div>
          </div>

          {/* Bank Soal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${bankSoalLight.bg}`} />
                <span className="font-medium text-gray-900">Bank Soal / Evaluasi</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{stats?.totalBankSoal || 0} soal</span>
                <span className="text-sm font-bold">{stats?.bankSoalCompletionRate || 0}%</span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${bankSoalLight.bg}`}
                style={{ width: `${stats?.bankSoalCompletionRate || 0}%` }}
              />
            </div>
          </div>

          {/* LKPD */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${lkpdLight.bg}`} />
                <span className="font-medium text-gray-900">LKPD / Bahan Ajar</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{stats?.totalLkpd || 0} dokumen</span>
                <span className="text-sm font-bold">{stats?.lkpdCompletionRate || 0}%</span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${lkpdLight.bg}`}
                style={{ width: `${stats?.lkpdCompletionRate || 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Performance Share Panel */}
      <div className="bg-white rounded-xl border p-6">
        <PerformanceSharePanel
          userId={user?.id || ""}
          aggregatedStats={(stats as any) || {}}
        />
      </div>
    </div>
  );
}
