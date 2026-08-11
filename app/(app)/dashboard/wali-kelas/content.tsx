'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardTab from './components/dashboard-tab';
import SiswaTab from './components/siswa-tab';
import CatatanTab from './components/catatan-tab';
import LaporanTab from './components/laporan-tab';
import type { WaliKelasDashboardData } from './components/types';

interface Kelas {
  id: string;
  nama_kelas: string;
}

const TAB_LABELS: { key: string; label: string }[] = [
  { key: '', label: 'Dashboard Wali Kelas' },
  { key: 'siswa', label: 'Daftar Siswa' },
  { key: 'catatan', label: 'Catatan Wali Kelas' },
  { key: 'laporan', label: 'Laporan Wali Kelas' },
];

function defaultPeriode(): string {
  const now = new Date();
  const year = now.getFullYear();
  const semester = now.getMonth() >= 6 ? 'ganjil' : 'genap';
  return `${year}/${year + 1}-${semester}`;
}

function WaliKelasDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tab = searchParams.get('tab') ?? '';
  const kelasParam = searchParams.get('kelas');
  const periodeParam = searchParams.get('periode');
  const siswaParam = searchParams.get('siswa');

  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [kelasLoading, setKelasLoading] = useState(true);
  const [kelasError, setKelasError] = useState<string | null>(null);

  const [data, setData] = useState<WaliKelasDashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [periodeInput, setPeriodeInput] = useState<string>(periodeParam || defaultPeriode());

  // Sync periode input whenever URL periode changes externally (e.g. tab navigation)
  useEffect(() => {
    setPeriodeInput(periodeParam || defaultPeriode());
  }, [periodeParam]);

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      router.replace(`/dashboard/wali-kelas?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Load kelas list (both Master Data path + assignment path via my-classes)
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/wali-kelas/my-classes')
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error || 'Gagal memuat daftar kelas');
        const list: Kelas[] = body.data ?? [];
        setKelasList(list);
        // Persist default kelas in URL so it is shared across tabs
        if (list.length > 0 && !searchParams.get('kelas')) {
          const params = new URLSearchParams(searchParams.toString());
          params.set('kelas', list[0].id);
          router.replace(`/dashboard/wali-kelas?${params.toString()}`, { scroll: false });
        }
      })
      .catch((err) => {
        if (!cancelled) setKelasError(err.message);
      })
      .finally(() => {
        if (!cancelled) setKelasLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveKelas =
    kelasParam && kelasList.some((k) => k.id === kelasParam) ? kelasParam : kelasList[0]?.id ?? '';
  const effectivePeriode = periodeParam || defaultPeriode();

  // Load dashboard payload (batch queries, RBAC-scoped) whenever kelas/periode changes
  useEffect(() => {
    if (!effectiveKelas || !effectivePeriode) return;
    let cancelled = false;
    setDataLoading(true);
    setDataError(null);
    const url = `/api/wali-kelas/dashboard?kelasId=${encodeURIComponent(effectiveKelas)}&periode=${encodeURIComponent(effectivePeriode)}`;
    apiFetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error || 'Gagal memuat data');
        setData(body.data);
      })
      .catch((err) => {
        if (!cancelled) setDataError(err.message);
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveKelas, effectivePeriode, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (kelasLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Memuat...</p>
      </div>
    );
  }

  if (kelasError) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto p-4 rounded border border-red-200 bg-red-50 text-red-700">
          {kelasError}
        </div>
      </div>
    );
  }

  if (kelasList.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Anda belum ditugaskan sebagai wali kelas.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dashboard Wali Kelas</h1>

        {/* Kelas & Periode selector (shared across all tabs via URL) */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Kelas</label>
            <select
              value={effectiveKelas}
              onChange={(e) => updateParams({ kelas: e.target.value })}
              className="p-2 border rounded bg-white"
            >
              {kelasList.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>
                  {kelas.nama_kelas}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Periode</label>
            <input
              type="text"
              value={periodeInput}
              onChange={(e) => setPeriodeInput(e.target.value)}
              onBlur={(e) => {
                if (e.target.value.trim() !== effectivePeriode) {
                  updateParams({ periode: e.target.value.trim() || null });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              className="p-2 border rounded"
              placeholder="2025/2026-ganjil"
            />
          </div>
        </div>

        {/* Tab navigation */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {TAB_LABELS.map((t) => (
            <button
              key={t.key}
              onClick={() => updateParams({ tab: t.key || null, siswa: null })}
              className={`px-4 py-2 rounded ${
                tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'siswa' ? (
          <SiswaTab
            data={data}
            loading={dataLoading}
            error={dataError}
            kelasId={effectiveKelas}
            periode={effectivePeriode}
            selectedSiswa={siswaParam}
            onSelectSiswa={(id) => updateParams({ siswa: id })}
            onRefresh={refresh}
          />
        ) : tab === 'catatan' ? (
          <CatatanTab
            data={data}
            loading={dataLoading}
            error={dataError}
            kelasId={effectiveKelas}
            periode={effectivePeriode}
            selectedSiswa={siswaParam}
            onSelectSiswa={(id) => updateParams({ siswa: id })}
            onRefresh={refresh}
          />
        ) : tab === 'laporan' ? (
          <LaporanTab
            data={data}
            loading={dataLoading}
            error={dataError}
            kelasId={effectiveKelas}
            periode={effectivePeriode}
            onRefresh={refresh}
          />
        ) : (
          <DashboardTab
            data={data}
            loading={dataLoading}
            error={dataError}
            onNavigate={(patch) => updateParams(patch)}
          />
        )}
      </div>
    </div>
  );
}

export default function WaliKelasDashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <p>Memuat...</p>
      </div>
    }>
      <WaliKelasDashboardContent />
    </Suspense>
  );
}
