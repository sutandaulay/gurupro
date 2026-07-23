"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (instId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const qs = instId ? `?institutionId=${instId}` : "";
      const res = await fetch(`/api/executive-dashboard${qs}`, { cache: "no-store" });
      if (res.status === 403) {
        setError("Halaman ini hanya untuk Kepala Sekolah atau Wakasek.");
        return;
      }
      if (!res.ok) throw new Error("Gagal memuat dashboard");
      const d = await res.json();
      setInstitutions(d.institutions || []);
      setSelectedId(d.selectedInstitutionId || null);
      setData(d.dashboard);
    } catch {
      setError("Gagal memuat dashboard eksekutif. Coba sebentar lagi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSwitch = (id: number) => {
    setSelectedId(id);
    load(id);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700 text-sm">← Kembali</button>
      </div>
      <h1 className="text-xl font-bold text-slate-800">Dasbor Eksekutif Sekolah</h1>
      <p className="text-sm text-slate-500 mt-1 mb-4">
        Ringkasan lintas guru di institusi Anda. Data diperbarui berkala (cache) agar ringan saat diakses bersamaan.
      </p>

      {institutions.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {institutions.map((inst: any) => (
            <button
              key={inst.id}
              onClick={() => handleSwitch(inst.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                selectedId === inst.id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {inst.name}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-10">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Memuat dasbor...</p>
        </div>
      )}

      {error && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">{error}</div>}

      {!loading && !error && !data && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <span className="text-3xl">⏳</span>
          <p className="text-sm text-slate-500 mt-2">Cache dashboard belum tersedia. Cron pembaruan akan mengisinya otomatis.</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          {/* Kartu ringkasan */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label="Guru Aktif" value={`${data.guruAktifMingguIni}/${data.totalGuru}`} sub="submit jurnal minggu ini" />
            <Card label="Sesi Mengajar" value={data.totalSesiMengajar} sub="total minggu ini" />
            <Card label="Progress Kurikulum" value={`${data.rataRataProgressKurikulum}%`} sub="rata-rata ATP" />
            <Card label="Completion Rate" value={`${data.completionRateSelesaiMengajar}%`} sub="guru sudah mengajar" />
          </div>

          {/* Progress per mapel */}
          {data.progressPerMapel?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="font-bold text-slate-800 mb-3">Progress Kurikulum per Mapel</p>
              <div className="space-y-3">
                {data.progressPerMapel.map((m: any) => (
                  <div key={m.mapel}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{m.mapel}</span>
                      <span className="text-slate-500">{m.persen}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${m.persen}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top guru */}
          {data.topGuru?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="font-bold text-slate-800 mb-3">Guru Paling Aktif</p>
              <div className="space-y-2">
                {data.topGuru.map((g: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                    <span className="font-medium text-slate-700">{g.nama}</span>
                    <span className="text-slate-500">{g.sesi} sesi</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className="text-[11px] text-slate-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
