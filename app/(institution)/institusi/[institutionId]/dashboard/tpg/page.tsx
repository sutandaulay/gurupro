"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from "react";
import { Card, Badge, Spinner } from "@/app/components/ui";
import { IconAlertCircle, IconCheck, IconX, IconTrendingUp } from "@tabler/icons-react";

interface TeacherTPG {
  guru_id: number;
  guru_nama: string;
  guru_email: string | null;
  role: string;
  total_hari: number;
  hari_efektif: number;
  hadir: number;
  telat: number;
  sakit: number;
  izin: number;
  alpa: number;
  total_menit: number;
  total_sesi: number;
  period_required: number;
  meets_requirement: boolean;
  deficit: number;
  percentage: number;
}

const roleBadgeVariant: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  kepala_sekolah: "success",
  wakasek: "info",
  operator: "warning",
  guru: "default",
};

const roleLabel: Record<string, string> = {
  kepala_sekolah: "Kepsek",
  wakasek: "Wakasek",
  operator: "Operator",
  guru: "Guru",
};

export default function TpgRecapPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const [institutionId, setInstitutionId] = useState<number | null>(null);
  const [institutionName, setInstitutionName] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [teachers, setTeachers] = useState<TeacherTPG[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "semester">("monthly");

  useEffect(() => {
    params.then((p) => setInstitutionId(parseInt(p.institutionId, 10)));
  }, [params]);

  const fetchData = async () => {
    if (!institutionId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(
        `/api/institution/${institutionId}/tpg-report?periodType=${period}`
      );
      if (res.status === 403) {
        setError("Anda tidak punya akses.");
        return;
      }
      if (!res.ok) {
        setError("Gagal memuat data.");
        return;
      }
      const data = await res.json();
      setTeachers(data.teachers || []);
      setSummary(data.summary || null);
      setPeriodLabel(data.period || period);
      setInstitutionName(data.institutionName || "");
    } catch {
      setError("Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (institutionId) fetchData();
  }, [institutionId, period]);

  const formatMinutes = (m: number) => {
    const j = Math.floor(m / 60);
    const min = m % 60;
    return j > 0 ? `${j}j ${min}m` : `${min}m`;
  };

  const requiredLabel = period === "weekly"
    ? "24 jp/minggu"
    : period === "semester"
      ? "24 jp/minggu"
      : "96 jp/bulan";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rekap TPG</h1>
        <p className="text-sm text-gray-500 mt-1">
          Rekap tunjangan profesi guru (TPG) — {institutionName}
        </p>
      </div>

      {/* Period Filter */}
      <div className="flex items-center gap-2">
        {(["weekly", "monthly", "semester"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              period === p
                ? "bg-violet-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p === "weekly" ? "Mingguan" : p === "monthly" ? "Bulanan" : "Semester"}
          </button>
        ))}
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-5">
            <p className="text-sm text-gray-500">Total Guru</p>
            <p className="text-2xl font-bold text-gray-900">{summary.totalTeachers}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-gray-500">Memenuhi Syarat</p>
            <p className="text-2xl font-bold text-green-600">{summary.requirementMet}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-gray-500">Belum Memenuhi</p>
            <p className="text-2xl font-bold text-red-500">{summary.requirementNotMet}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-gray-500">Rata-rata Menit</p>
            <p className="text-2xl font-bold text-violet-600">{formatMinutes(summary.avgMinutes)}</p>
          </Card>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Syarat TPG:</strong> Minimal <strong>24 JP (1.440 menit)</strong> per {period === "weekly" ? "minggu" : period === "semester" ? "minggu (selama semester)" : "bulan"}. Guru yang belum memenuhi akan tampil di bawah.
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="p-12 text-center">
          <IconAlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-600">{error}</p>
        </Card>
      ) : teachers.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">Belum ada data TPG untuk periode ini.</p>
        </Card>
      ) : (
        <>
          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Guru</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Hadir</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Telat</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Alpa</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Total Menit</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">%</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {teachers.map((t) => (
                    <tr key={t.guru_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{t.guru_nama || "-"}</p>
                        {t.guru_email && <p className="text-xs text-gray-400">{t.guru_email}</p>}
                      </td>
                      <td className="px-3 py-3 text-center text-green-600 font-medium">{t.hadir}</td>
                      <td className="px-3 py-3 text-center text-amber-600">{t.telat}</td>
                      <td className="px-3 py-3 text-center text-red-500 font-medium">{t.alpa}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-medium ${t.meets_requirement ? "text-green-600" : "text-red-500"}`}>
                          {formatMinutes(t.total_menit)}
                        </span>
                        <span className="text-gray-400 text-xs block">/ {formatMinutes(t.period_required)}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-12 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${t.meets_requirement ? "bg-green-500" : "bg-red-400"}`}
                              style={{ width: `${t.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{t.percentage}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {t.meets_requirement ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold">
                            <IconCheck size={14} /> Memenuhi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold">
                            <IconX size={14} /> Defisit {formatMinutes(t.deficit)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Legend */}
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" /> Memenuhi syarat</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" /> Defisit</span>
            <span>1 JP = 45 menit | 24 JP = 1.080 menit (standar Depdagri)</span>
          </div>
        </>
      )}
    </div>
  );
}
