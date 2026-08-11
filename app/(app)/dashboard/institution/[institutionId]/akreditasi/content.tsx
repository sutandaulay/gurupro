"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/app/components/ui/toast";

interface AkreditasiItem {
  id: string;
  kode: string;
  nama: string;
  status: "belum" | "proses" | "lengkap";
  catatan: string | null;
}

interface StandarAkreditasi {
  id: string;
  kode: string;
  nama: string;
  urutan: number;
  total: number;
  lengkap: number;
  proses: number;
  persen: number;
  items: AkreditasiItem[];
}

const STATUS_OPTIONS = [
  { key: "belum", label: "Belum", color: "bg-gray-100 text-gray-600 border-gray-200" },
  { key: "proses", label: "Dalam Proses", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "lengkap", label: "Lengkap", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
] as const;

function statusColor(status: string): string {
  for (const s of STATUS_OPTIONS) if (s.key === status) return s.color;
  return STATUS_OPTIONS[0].color;
}

export default function AkreditasiContent() {
  const params = useParams();
  const institutionId = params.institutionId as string;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [standar, setStandar] = useState<StandarAkreditasi[]>([]);
  const [error, setError] = useState("");
  const [expandAll, setExpandAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const loadAkreditasi = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/akreditasi`);
      const data = await res.json();
      if (res.ok) {
        setFeatureEnabled(Boolean(data.featureEnabled));
        if (data.featureEnabled) {
          setSummary(data.summary || null);
          setStandar(data.standar || []);
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
    loadAkreditasi();
  }, [loadAkreditasi]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandAll) setExpanded(new Set());
    else setExpanded(new Set(standar.map((s) => s.id)));
    setExpandAll((v) => !v);
  };

  const updateItem = async (item: AkreditasiItem, newStatus: string, catatan?: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/akreditasi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id, status: newStatus, catatan: catatan || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal update status");
      setStandar((prev) => {
        const next = prev.map((s) => {
          const items = s.items.map((i) =>
            i.id === item.id ? { ...i, status: newStatus as any, catatan: catatan || null } : i
          );
          const lengkap = items.filter((i) => i.status === "lengkap").length;
          const proses = items.filter((i) => i.status === "proses").length;
          return {
            ...s,
            items,
            lengkap,
            proses,
            persen: s.total > 0 ? Math.round((lengkap / s.total) * 100) : 0,
          };
        });
        const totalItems = next.reduce((acc, st) => acc + st.total, 0);
        const totalLengkap = next.reduce((acc, st) => acc + st.lengkap, 0);
        const totalProses = next.reduce((acc, st) => acc + st.proses, 0);
        setSummary({
          totalItems,
          totalLengkap,
          totalProses,
          progres: totalItems > 0 ? Math.round((totalLengkap / totalItems) * 100) : 0,
        });
        return next;
      });
      toast.success("Status diperbarui");
    } catch (err: any) {
      toast.error(err.message || "Gagal update status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Akreditasi & Pengawasan</h1>
          <p className="text-sm text-gray-500">
            Pemantauan pemenuhan 8 standar akreditasi nasional
          </p>
        </div>
        {featureEnabled === true && (
          <button
            onClick={toggleExpandAll}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
          >
            {expandAll ? "Tutup Semua" : "Buka Semua"}
          </button>
        )}
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
          Fitur Akreditasi belum aktif untuk institusi ini. Aktifkan lewat pengaturan institusi.
        </div>
      ) : (
        <>
          {/* Ringkasan progres */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="text-xs text-gray-500">Progres Pemenuhan</div>
                <div className="text-4xl font-bold text-gray-900 mt-1">
                  {summary?.progres || 0}%
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {summary?.totalLengkap || 0}
                  </div>
                  <div className="text-xs text-gray-400">Lengkap</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">
                    {summary?.totalProses || 0}
                  </div>
                  <div className="text-xs text-gray-400">Proses</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {summary?.totalItems || 0}
                  </div>
                  <div className="text-xs text-gray-400">Total Item</div>
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 rounded-full transition-all"
                style={{ width: `${summary?.progres || 0}%` }}
              />
            </div>
          </div>

          {/* Daftar standar */}
          <div className="space-y-4">
            {standar.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 text-left"
                >
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    {s.kode.replace("STD-", "")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{s.nama}</div>
                    <div className="text-xs text-gray-400">
                      {s.lengkap}/{s.total} item lengkap
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${s.persen}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{s.persen}%</span>
                  </div>
                  <span className="text-gray-400">
                    {expanded.has(s.id) ? "▲" : "▼"}
                  </span>
                </button>

                {expanded.has(s.id) && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    <ul className="space-y-3">
                      {s.items.map((item) => (
                        <li key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                          <div className="min-w-0">
                            <div className="text-sm text-gray-800">
                              <span className="text-gray-400 font-medium mr-2">{item.kode}</span>
                              {item.nama}
                            </div>
                            {item.catatan && (
                              <div className="text-xs text-amber-600 mt-0.5">
                                Catatan: {item.catatan}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            {STATUS_OPTIONS.map((o) => (
                              <button
                                key={o.key}
                                onClick={() => updateItem(item, o.key)}
                                disabled={saving || item.status === o.key}
                                className={`px-3 py-1 text-xs font-medium rounded-lg border transition ${
                                  item.status === o.key
                                    ? o.color
                                    : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}