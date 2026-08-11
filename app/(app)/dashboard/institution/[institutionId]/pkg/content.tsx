"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";

interface GuruPKG {
  guru_id: string;
  nama: string;
  totalObservasi: number;
  rataRating: number | null;
  laporanStatus: string | null;
  predikat: string | null;
  semester: string | null;
  laporanRataRating: number | null;
}

interface KomponenPKG {
  id: string;
  kode: string;
  nama: string;
  komponen: string;
  bobotPersen: number;
  jumlahRating: number;
  rataRating: number | null;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  selesai: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const PREDIKAT_BADGE: Record<string, string> = {
  "amat baik": "bg-emerald-100 text-emerald-700",
  baik: "bg-blue-100 text-blue-700",
  "cukup": "bg-amber-100 text-amber-700",
  kurang: "bg-red-100 text-red-700",
};

function fmtRating(v: number | null): string {
  if (v === null || v === undefined) return "-";
  return v.toFixed(1);
}

export default function PkgDigitalContent() {
  const params = useParams();
  const institutionId = params.institutionId as string;

  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [perGuru, setPerGuru] = useState<GuruPKG[]>([]);
  const [perKomponen, setPerKomponen] = useState<KomponenPKG[]>([]);
  const [error, setError] = useState("");

  const loadPkg = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/pkg-digital`);
      const data = await res.json();
      if (res.ok) {
        setFeatureEnabled(Boolean(data.featureEnabled));
        if (data.featureEnabled) {
          setSummary(data.summary || null);
          setPerGuru(data.perGuru || []);
          setPerKomponen(data.perKomponen || []);
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
    loadPkg();
  }, [loadPkg]);

  const coverageRate = summary?.totalGuru
    ? Math.round((summary.guruDiobservasi / summary.totalGuru) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">PKG Digital</h1>
        <p className="text-sm text-gray-500">
          Pemantauan Penilaian Kinerja Guru per institusi
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
          Fitur PKG Digital belum aktif untuk institusi ini. Aktifkan lewat pengaturan institusi.
        </div>
      ) : (
        <>
          {/* Ringkasan */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-500">Total Guru</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">
                {summary?.totalGuru || 0}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-500">Guru Diobservasi</div>
              <div className="text-3xl font-bold text-violet-600 mt-1">
                {summary?.guruDiobservasi || 0}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">{coverageRate}% cakupan</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-500">Total Observasi</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">
                {summary?.totalObservasi || 0}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-500">Rata-rata Rating</div>
              <div className="text-3xl font-bold text-emerald-600 mt-1">
                {fmtRating(summary?.rataRataInstitusi)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-500">Tanpa Laporan Kinerja</div>
              <div className="text-3xl font-bold text-amber-600 mt-1">
                {summary?.tanpaLaporan || 0}
              </div>
            </div>
          </div>

          {/* Rating per komponen */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Rating per Komponen Indikator</h2>
            {perKomponen.length === 0 ? (
              <div className="text-sm text-gray-400 py-6 text-center">
                Belum ada konfigurasi indikator kinerja aktif.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {perKomponen.map((k) => (
                  <div key={k.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{k.nama}</div>
                        <div className="text-xs text-gray-400">
                          {k.kode} · bobot {k.bobotPersen}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">
                          {fmtRating(k.rataRating)}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {k.jumlahRating} rating
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabel per guru */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Penilaian per Guru</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="px-5 py-3">Guru</th>
                    <th className="px-5 py-3">Observasi</th>
                    <th className="px-5 py-3">Rating</th>
                    <th className="px-5 py-3">Laporan</th>
                    <th className="px-5 py-3">Predikat</th>
                  </tr>
                </thead>
                <tbody>
                  {perGuru.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                        Belum ada data guru.
                      </td>
                    </tr>
                  ) : (
                    perGuru.map((g) => (
                      <tr key={g.guru_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{g.nama}</td>
                        <td className="px-5 py-3 text-gray-600">{g.totalObservasi}</td>
                        <td className="px-5 py-3 font-semibold text-gray-900">
                          {fmtRating(g.rataRating)}
                        </td>
                        <td className="px-5 py-3">
                          {g.laporanStatus ? (
                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                                STATUS_BADGE[g.laporanStatus] || "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {g.laporanStatus}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Belum ada</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {g.predikat ? (
                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                                PREDIKAT_BADGE[String(g.predikat).toLowerCase()] ||
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {g.predikat}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
