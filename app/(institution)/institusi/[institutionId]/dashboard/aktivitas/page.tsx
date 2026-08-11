"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from "react";
import { Card, Badge, Spinner } from "@/app/components/ui";
import { useToast } from "@/app/components/ui/toast";
import { IconUsers, IconAlertCircle, IconTrendingUp, IconCalendar, IconClock } from "@tabler/icons-react";

interface GuruAktivitas {
  guru_id: number;
  guru_nama: string;
  guru_email: string | null;
  role: string;
  total_jurnal: number;
  jurnal_final: number;
  jurnal_draft: number;
  jurnal_terakhir: string | null;
  total_hari: number;
  hadir: number;
  telat: number;
  sakit: number;
  izin: number;
  alpa: number;
  cuti: number;
  total_menit: number;
  total_sesi: number;
  skor: number;
}

const roleBadgeVariant: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  kepala_sekolah: "success",
  wakasek: "info",
  operator: "warning",
  bendahara: "default",
  guru: "default",
};

const roleLabel: Record<string, string> = {
  kepala_sekolah: "Kepsek",
  wakasek: "Wakasek",
  operator: "Operator",
  bendahara: "Bendahara",
  guru: "Guru",
};

export default function AktivitasGuruPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const toast = useToast();
  const [institutionId, setInstitutionId] = useState<number | null>(null);
  const [gurus, setGurus] = useState<GuruAktivitas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"today" | "week" | "month" | "semester">("month");
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  useEffect(() => {
    params.then((p) => setInstitutionId(parseInt(p.institutionId, 10)));
  }, [params]);

  const fetchData = async (p = period) => {
    if (!institutionId) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        period: p,
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      const res = await apiFetch(`/api/institution/${institutionId}/aktivitas-guru?${qs}`);
      if (res.status === 403) {
        setError("Anda tidak punya akses ke halaman ini.");
        return;
      }
      if (!res.ok) {
        setError("Gagal memuat data aktivitas guru.");
        return;
      }
      const data = await res.json();
      setGurus(data.gurus || []);
      setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch {
      setError("Gagal memuat data aktivitas guru.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (institutionId) fetchData();
  }, [institutionId, period]);

  const totalHadir = gurus.reduce((sum, g) => sum + g.hadir, 0);
  const totalAlpa = gurus.reduce((sum, g) => sum + g.alpa, 0);
  const totalJurnal = gurus.reduce((sum, g) => sum + g.total_jurnal, 0);
  const avgScore = gurus.length > 0 ? Math.round(gurus.reduce((sum, g) => sum + g.skor, 0) / gurus.length) : 0;

  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}j ${min}m` : `${min}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aktivitas Guru</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pantau aktivitas dan kehadiran guru di institusi.
        </p>
      </div>

      {/* Period Filter */}
      <div className="flex items-center gap-2">
        {(["today", "week", "month", "semester"] as const).map((p) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setPagination((prev) => ({ ...prev, page: 1 })); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              period === p
                ? "bg-violet-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p === "today" ? "Hari Ini" : p === "week" ? "Minggu Ini" : p === "month" ? "Bulan Ini" : "Semester"}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <IconUsers size={18} className="text-violet-500" />
            <p className="text-sm text-gray-500">Total Guru</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <IconClock size={18} className="text-green-500" />
            <p className="text-sm text-gray-500">Total Hadir</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{totalHadir}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <IconAlertCircle size={18} className="text-red-400" />
            <p className="text-sm text-gray-500">Total Alpa</p>
          </div>
          <p className="text-2xl font-bold text-red-500">{totalAlpa}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <IconTrendingUp size={18} className="text-amber-500" />
            <p className="text-sm text-gray-500">Rata-rata Skor</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{avgScore}</p>
        </Card>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="p-12 text-center">
          <IconAlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-600">{error}</p>
        </Card>
      ) : gurus.length === 0 ? (
        <Card className="p-12 text-center">
          <IconUsers size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Belum ada data aktivitas guru untuk periode ini.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Guru</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500">Role</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500">Skor</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500">Hadir</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500">Telat</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500">Alpa</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500">Sakit</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500">Izin</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500">Jurnal</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500">Final</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gurus.map((g) => (
                  <tr key={g.guru_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{g.guru_nama || "-"}</p>
                      {g.guru_email && <p className="text-xs text-gray-400">{g.guru_email}</p>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant={roleBadgeVariant[g.role] || "default"}>
                        {roleLabel[g.role] || g.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-gray-500">{g.skor}</td>
                    <td className="px-3 py-3 text-center text-green-600 font-medium">{g.hadir}</td>
                    <td className="px-3 py-3 text-center text-amber-600">{g.telat}</td>
                    <td className="px-3 py-3 text-center text-red-500 font-medium">{g.alpa}</td>
                    <td className="px-3 py-3 text-center text-gray-500">{g.sakit}</td>
                    <td className="px-3 py-3 text-center text-gray-500">{g.izin}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{g.total_jurnal}</td>
                    <td className="px-3 py-3 text-center">
                      {g.jurnal_final > 0 ? (
                        <span className="text-green-600 font-medium">{g.jurnal_final}</span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">
                      {g.jurnal_terakhir || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500 text-center">
              Halaman {pagination.page} dari {pagination.totalPages} — {pagination.total} guru
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
