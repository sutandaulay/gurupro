"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";

interface AlertItem {
  id: string;
  level: "critical" | "warning" | "info";
  kategori: string;
  judul: string;
  deskripsi: string;
  nilai: number;
  target: { id: string; nama: string }[];
}

const LEVEL_LABEL: Record<string, string> = {
  critical: "Kritis",
  warning: "Perhatian",
  info: "Info",
};

const LEVEL_COLOR: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

const LEVEL_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
};

const KATEGORI_LABEL: Record<string, string> = {
  kehadiran_siswa: "Kehadiran Siswa",
  kehadiran_guru: "Kehadiran Guru",
  assignment: "Assignment",
  raport: "E-Raport",
  jurnal: "Jurnal Mengajar",
  administrasi: "Administrasi",
};

export default function SmartAlertsContent() {
  const params = useParams();
  const institutionId = params.institutionId as string;

  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [summary, setSummary] = useState({ critical: 0, warning: 0, info: 0, total: 0 });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/smart-alerts`);
      const data = await res.json();
      if (res.ok) {
        setFeatureEnabled(Boolean(data.featureEnabled));
        if (data.featureEnabled) {
          setSummary(data.summary || { critical: 0, warning: 0, info: 0, total: 0 });
          setAlerts(data.alerts || []);
        }
      } else {
        setError(data.error || "Gagal memuat data");
      }
    } catch {
      setError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.level === filter);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Smart Alert</h1>
        <p className="text-sm text-gray-500">
          Deteksi anomali operasional institusi secara otomatis
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : featureEnabled === false ? (
        <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
          Fitur Smart Alert belum aktif untuk institusi ini. Aktifkan lewat pengaturan institusi.
        </div>
      ) : (
        <>
          {/* Ringkasan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-500">Total Alert</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">{summary.total}</div>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-5">
              <div className="text-xs text-red-500">Kritis</div>
              <div className="text-3xl font-bold text-red-600 mt-1">{summary.critical}</div>
            </div>
            <div className="bg-white rounded-xl border border-amber-200 p-5">
              <div className="text-xs text-amber-500">Perhatian</div>
              <div className="text-3xl font-bold text-amber-600 mt-1">{summary.warning}</div>
            </div>
            <div className="bg-white rounded-xl border border-blue-200 p-5">
              <div className="text-xs text-blue-500">Info</div>
              <div className="text-3xl font-bold text-blue-600 mt-1">{summary.info}</div>
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            {[
              { key: "all", label: `Semua (${alerts.length})` },
              { key: "critical", label: `Kritis (${summary.critical})` },
              { key: "warning", label: `Perhatian (${summary.warning})` },
              { key: "info", label: `Info (${summary.info})` },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                  filter === f.key
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Daftar alert */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
              Tidak ada alert pada filter ini. Semua aman.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-xl border p-4 ${LEVEL_COLOR[a.level]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded ${LEVEL_BADGE[a.level]}`}
                        >
                          {LEVEL_LABEL[a.level]}
                        </span>
                        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                          {KATEGORI_LABEL[a.kategori] || a.kategori}
                        </span>
                      </div>
                      <div className="font-semibold text-gray-900 mt-1.5">{a.judul}</div>
                      <div className="text-sm text-gray-600 mt-0.5">{a.deskripsi}</div>
                    </div>
                    {a.target.length > 0 && (
                      <button
                        onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        className="shrink-0 text-xs font-medium text-gray-500 hover:text-gray-800 underline"
                      >
                        {a.target.length} nama
                      </button>
                    )}
                  </div>
                  {expanded === a.id && a.target.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <div className="flex flex-wrap gap-1.5">
                        {a.target.map((t) => (
                          <span
                            key={t.id}
                            className="px-2 py-1 text-xs bg-white/70 rounded text-gray-700 border border-black/5"
                          >
                            {t.nama}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
