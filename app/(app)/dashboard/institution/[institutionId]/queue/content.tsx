"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/app/components/ui/toast";

interface QueueItem {
  id: string;
  kategori: "dokumen" | "raport" | "izin" | "observasi";
  judul: string;
  deskripsi: string;
  pengaju: string | null;
  tipe: string;
  tanggal: string | null;
  target: string | null;
  aksiable?: boolean;
  aksiUrl?: string;
}

const KATEGORI_LABEL: Record<string, string> = {
  raport: "E-Raport",
  dokumen: "Dokumen Administrasi",
  izin: "Izin Guru",
  observasi: "Observasi",
};

const KATEGORI_COLOR: Record<string, string> = {
  raport: "bg-violet-100 text-violet-700",
  dokumen: "bg-emerald-100 text-emerald-700",
  izin: "bg-sky-100 text-sky-700",
  observasi: "bg-amber-100 text-amber-700",
};

function fmtTanggal(v: string | null | undefined): string {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function ApprovalQueueContent() {
  const params = useParams();
  const institutionId = params.institutionId as string;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, byKategori: {} as Record<string, number> });
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [catatanMap, setCatatanMap] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/approval-queue`);
      const data = await res.json();
      if (res.ok) {
        setFeatureEnabled(Boolean(data.featureEnabled));
        if (data.featureEnabled) {
          setItems(data.items || []);
          setSummary(data.summary || { total: 0, byKategori: {} });
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
    loadQueue();
  }, [loadQueue]);

  const handleAction = async (item: QueueItem, aksi: "approve" | "revisi") => {
    if (!item.aksiUrl || processing) return;
    setProcessing(item.id);
    setError("");
    try {
      const res = await fetch(item.aksiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi, catatan: catatanMap[item.id] || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses");
      toast.success(aksi === "approve" ? "Dokumen disetujui" : "Dokumen diminta revisi");
      setItems((prev) => prev.filter((i) => i !== item));
      const newSummary = { ...summary, byKategori: { ...summary.byKategori } };
      newSummary.total = Math.max(0, newSummary.total - 1);
      const key = item.kategori;
      newSummary.byKategori[key] = Math.max(0, (newSummary.byKategori[key] || 0) - 1);
      setSummary(newSummary);
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses");
    } finally {
      setProcessing(null);
    }
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.kategori === filter);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Approval Queue</h1>
        <p className="text-sm text-gray-500">
          Semua antrian persetujuan institusi dalam satu tempat
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
          Fitur Approval Queue belum aktif untuk institusi ini. Aktifkan lewat pengaturan institusi.
        </div>
      ) : (
        <>
          {/* Ringkasan per kategori */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-500">Total Antrian</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">{summary.total}</div>
            </div>
            {Object.entries(KATEGORI_LABEL).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(filter === key ? "all" : key)}
                className={`bg-white rounded-xl border p-5 text-left ${
                  filter === key ? "border-violet-500 ring-1 ring-violet-200" : "border-gray-200"
                }`}
              >
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {summary.byKategori[key] || 0}
                </div>
              </button>
            ))}
          </div>

          {/* Daftar antrian */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
              Tidak ada antrian pada filter ini.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <li key={`${item.kategori}-${item.id}`} className="p-4 flex items-start gap-4">
                    <span
                      className={`shrink-0 px-2 py-1 text-[11px] font-semibold rounded ${KATEGORI_COLOR[item.kategori]}`}
                    >
                      {KATEGORI_LABEL[item.kategori]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900">{item.judul}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{item.deskripsi}</div>
                      {item.pengaju && (
                        <div className="text-xs text-gray-400 mt-1">Diajukan: {item.pengaju}</div>
                      )}
                      {item.aksiable && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <input
                            value={catatanMap[item.id] || ""}
                            onChange={(e) =>
                              setCatatanMap((m) => ({ ...m, [item.id]: e.target.value }))
                            }
                            placeholder="Catatan (opsional)"
                            className="px-2 py-1 text-xs border border-gray-200 rounded-md w-48"
                          />
                          <button
                            onClick={() => handleAction(item, "approve")}
                            disabled={processing === item.id}
                            className="px-3 py-1 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Setujui
                          </button>
                          <button
                            onClick={() => handleAction(item, "revisi")}
                            disabled={processing === item.id}
                            className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                          >
                            Minta Revisi
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-gray-400">{fmtTanggal(item.tanggal)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Dokumen administrasi dapat disetujui langsung dari sini. Raport, izin &amp; observasi
            read-only — tindakannya dilakukan lewat modul masing-masing.
          </p>
        </>
      )}
    </div>
  );
}
