"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

interface BreakdownItem {
  fitur: string;
  label: string;
  totalPoin: number;
  totalTransaksi: number;
  details: { guru: string; jumlah: number; tanggal: string }[];
}

interface Transaction {
  id: string;
  feature: string;
  guru: string;
  jumlah: number;
  tanggal: string;
}

interface PoinData {
  available: boolean;
  saldo: number | null;
  totalPoin: number;
  totalTransaksi: number;
  breakdown: BreakdownItem[];
  recentTransactions: Transaction[];
  proyeksiHariHabis: number | null;
  rataPerHari: number | null;
}

export default function BendaharaDashboardContent() {
  const params = useParams();
  const institutionId = params.institutionId as string;

  const [data, setData] = useState<PoinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");

  const fetchData = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/bendahara`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      console.error("Gagal fetch data Poin");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async () => {
    if (!institutionId) return;
    const url = `/api/institution/${institutionId}/bendahara?export=csv`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12 text-gray-400">Memuat data Poin...</div>
      </div>
    );
  }

  if (!data || !data.available) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-700 font-medium">Poin ledger belum tersedia</p>
          <p className="text-sm text-amber-600 mt-1">Fitur Poin belum dikonfigurasi untuk institusi ini</p>
        </div>
      </div>
    );
  }

  const fiturColor: Record<string, string> = {
    'raport-ai': 'bg-violet-50 border-violet-200',
    'raport-deskripsi': 'bg-violet-50 border-violet-200',
    'voice-briefing': 'bg-blue-50 border-blue-200',
    'silabus-generate': 'bg-green-50 border-green-200',
    'atp-generate': 'bg-green-50 border-green-200',
    'soal-generate': 'bg-green-50 border-green-200',
    'lkpd-generate': 'bg-green-50 border-green-200',
    'bahan-ajar-generate': 'bg-green-50 border-green-200',
    'journal-ai': 'bg-cyan-50 border-cyan-200',
    'attendance-insight': 'bg-amber-50 border-amber-200',
    'lainnya': 'bg-gray-50 border-gray-200',
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Bendahara</h1>
          <p className="text-sm text-gray-500">Saldo Poin &amp; laporan transaksi</p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
        >
          Export CSV
        </button>
      </div>

      {/* Saldo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-xl p-6 text-white">
          <div className="text-xs font-medium opacity-70 mb-1">Saldo Poin</div>
          <div className="text-3xl font-bold">
            {data.saldo != null ? data.saldo.toLocaleString() : "—"}
          </div>
          {data.saldo != null && (
            <div className="text-xs opacity-60 mt-1">Poin tersedia</div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-xs font-medium text-gray-500 mb-1">Total Digunakan (90 hari)</div>
          <div className="text-3xl font-bold text-gray-900">{data.totalPoin.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">{data.totalTransaksi} transaksi</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-xs font-medium text-gray-500 mb-1">Fitur Aktif</div>
          <div className="text-3xl font-bold text-gray-900">{data.breakdown.length}</div>
          <div className="text-xs text-gray-400 mt-1">fitur digunakan</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-xs font-medium text-gray-500 mb-1">Proyeksi Habis</div>
          <div className="text-3xl font-bold text-gray-900">
            {data.proyeksiHariHabis != null
              ? `± ${data.proyeksiHariHabis} hari`
              : "—"}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {data.rataPerHari != null
              ? `${data.rataPerHari.toLocaleString()} poin/hari`
              : "belum ada data pemakaian"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "overview" ? "bg-white shadow-sm text-violet-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          Breakdown per Fitur
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "transactions" ? "bg-white shadow-sm text-violet-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          Semua Transaksi
        </button>
      </div>

      {activeTab === "overview" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.breakdown.map(item => (
            <div key={item.fitur} className={`rounded-xl border p-5 ${fiturColor[item.fitur] || 'bg-gray-50 border-gray-200'}`}>
              <div className="font-semibold text-gray-900 mb-1">{item.label}</div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{item.totalPoin.toLocaleString()}</div>
              <div className="text-xs text-gray-500">{item.totalTransaksi} transaksi</div>
              {item.details.length > 0 && (
                <div className="mt-3 pt-3 border-t border-black/10 space-y-1.5">
                  {item.details.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-600">
                      <span className="truncate">{d.guru}</span>
                      <span className="font-medium shrink-0 ml-2">{d.jumlah}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Tanggal</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Fitur</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Guru</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                    Belum ada transaksi
                  </td>
                </tr>
              ) : data.recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-600">{tx.tanggal}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{tx.feature}</td>
                  <td className="px-5 py-3 text-gray-600">{tx.guru}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{tx.jumlah.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
