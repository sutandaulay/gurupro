"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";

interface RaportItem {
  id: string;
  kelas_id: number;
  siswa_id: string;
  siswa_nama: string;
  nama_kelas: string;
  periode: string;
  status?: string;
  updated_at: string;
}

interface ObservasiItem {
  id: string;
  guru_id: string;
  guru_nama: string;
  tanggal: string;
  skor: number;
  aspek: string;
  catatan: string;
  observer: string;
}

interface GuruItem {
  guru_id: string;
  nama: string;
}

interface KurikulumData {
  summary: {
    totalAtp: number;
    totalMapel: number;
    guruMengajarMingguIni: number;
    guruAktifMingguIni: number;
    totalGuru: number;
    rataRataProgress: number;
  };
  progressPerMapel: {
    mapel: string;
    progress: number;
    total: number;
    guruCount: number;
    persen: number;
  }[];
  atpList: {
    id: string;
    mapel: string;
    judul: string;
    guruId: string;
    guruNama: string;
    fase: string;
    semester: number | null;
    approvalStatus: string | null;
    progress: number;
    total: number;
    persen: number;
    updatedAt: string | null;
  }[];
  jurnalMingguIni: {
    guruId: string;
    guruNama: string;
    kelas: string;
    sesi: number;
    terakhir: string | null;
  }[];
  guruList: { guruId: string; nama: string; aktifMingguIni: boolean }[];
  periode: { start: string; end: string };
}

function kurikulumPanel(kurikulum: KurikulumData | null) {
  if (!kurikulum) {
    return <div className="text-center py-12 text-gray-400">Memuat...</div>;
  }
  return (
    <>
      {/* KPI Ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500">Progress ATP rata-rata</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {kurikulum.summary.rataRataProgress}%
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500">ATP dipetakan</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {kurikulum.summary.totalAtp}
          </div>
          <div className="text-xs text-gray-400">{kurikulum.summary.totalMapel} mapel</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500">Sesi mengajar minggu ini</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {kurikulum.summary.guruMengajarMingguIni}
          </div>
          <div className="text-xs text-gray-400">
            {kurikulum.summary.guruAktifMingguIni}/{kurikulum.summary.totalGuru} guru aktif
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500">Periode</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            {kurikulum.periode.start} s/d {kurikulum.periode.end}
          </div>
        </div>
      </div>

      {/* Progress per Mapel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Progress Kurikulum per Mapel</h2>
        </div>
        {kurikulum.progressPerMapel.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            Belum ada pemetaan ATP untuk ditampilkan
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {kurikulum.progressPerMapel.map((m) => (
              <div key={m.mapel} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-gray-900">{m.mapel}</div>
                    <div className="text-xs text-gray-400">
                      {m.guruCount} guru · {m.progress}/{m.total} minggu
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900">{m.persen}%</div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.persen >= 75 ? "bg-green-500" : m.persen >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: Math.min(100, m.persen) + "%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monitoring Jurnal Mengajar */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Monitoring Jurnal Mengajar</h2>
        </div>
        {kurikulum.guruList.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            Belum ada data guru
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {kurikulum.guruList.map((g) => {
              const jSeq = kurikulum.jurnalMingguIni.filter((j) => j.guruId === g.guruId);
              return (
                <div key={g.guruId} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">{g.nama}</div>
                    <div
                      className={`text-xs font-medium px-2 py-1 rounded-md ${
                        g.aktifMingguIni
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {g.aktifMingguIni ? `${jSeq.reduce((a, j) => a + j.sesi, 0)} sesi` : "Belum mengajar"}
                    </div>
                  </div>
                  {g.aktifMingguIni && (
                    <div className="mt-2 space-y-1">
                      {jSeq.map((j, idx) => (
                        <div key={idx} className="text-xs text-gray-500">
                          {j.kelas} · {j.sesi} sesi · terakhir {j.terakhir}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function WakasekDashboardContent() {
  const { data: session } = useSession();
  const params = useParams();
  const institutionId = params.institutionId as string;

  const [activeTab, setActiveTab] = useState<"raport" | "observasi" | "kurikulum">("raport");
  const [raportPending, setRaportPending] = useState<RaportItem[]>([]);
  const [raportStats, setRaportStats] = useState<Record<string, number>>({});
  const [observasiList, setObservasiList] = useState<ObservasiItem[]>([]);
  const [guruList, setGuruList] = useState<GuruItem[]>([]);
  const [selectedGuru, setSelectedGuru] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notif, setNotif] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [kurikulum, setKurikulum] = useState<KurikulumData | null>(null);

  // Form observasi
  const [obsForm, setObsForm] = useState({
    guruId: "",
    tanggal: new Date().toISOString().split("T")[0],
    skor: "",
    aspek: "kelas",
    catatan: "",
  });

  const showNotif = (type: "success" | "error", msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 4000);
  };

  const fetchRaport = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/institution/${institutionId}/wakasek?view=raport`
      );
      const data = await res.json();
      if (res.ok) {
        setRaportPending(data.pending || []);
        setRaportStats(data.stats || {});
      }
    } catch {
      showNotif("error", "Gagal fetch data raport");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  const fetchObservasi = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/institution/${institutionId}/wakasek?view=observasi`
      );
      const data = await res.json();
      if (res.ok) {
        setObservasiList(data.observasi || []);
        setGuruList(data.guru || []);
      }
    } catch {
      showNotif("error", "Gagal fetch data observasi");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  const fetchKurikulum = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/kurikulum`);
      const data = await res.json();
      if (res.ok) {
        setKurikulum(data);
      } else {
        showNotif("error", data.error || "Gagal fetch data kurikulum");
      }
    } catch {
      showNotif("error", "Gagal fetch data kurikulum");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    if (activeTab === "raport") fetchRaport();
    else if (activeTab === "observasi") fetchObservasi();
    else fetchKurikulum();
  }, [activeTab, fetchRaport, fetchObservasi, fetchKurikulum]);

  const handleApproveRaport = async (raportId: string) => {
    setActionLoading(raportId);
    try {
      const res = await fetch(`/api/institution/${institutionId}/wakasek`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_raport", raportId }),
      });
      if (res.ok) {
        showNotif("success", "Raport berhasil difinalisasi");
        fetchRaport();
      } else {
        showNotif("error", "Gagal approve raport");
      }
    } catch {
      showNotif("error", "Gagal approve raport");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRaport = async (raportId: string) => {
    setActionLoading(raportId);
    try {
      const res = await fetch(`/api/institution/${institutionId}/wakasek`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject_raport", raportId }),
      });
      if (res.ok) {
        showNotif("success", "Raport dikembalikan ke draft");
        fetchRaport();
      } else {
        showNotif("error", "Gagal reject raport");
      }
    } catch {
      showNotif("error", "Gagal reject raport");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitObservasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsForm.guruId || !obsForm.tanggal) {
      showNotif("error", "Pilih guru dan tanggal");
      return;
    }
    setActionLoading("obs");
    try {
      const res = await fetch(`/api/institution/${institutionId}/wakasek`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "observasi",
          guruId: obsForm.guruId,
          guruNama: obsForm.guruId ? guruList.find(g => g.guru_id === obsForm.guruId)?.nama : "",
          tanggal: obsForm.tanggal,
          skor: obsForm.skor ? parseFloat(obsForm.skor) : null,
          aspek: obsForm.aspek,
          catatan: obsForm.catatan,
        }),
      });
      if (res.ok) {
        showNotif("success", "Observasi berhasil disimpan");
        setObsForm({ guruId: "", tanggal: new Date().toISOString().split("T")[0], skor: "", aspek: "kelas", catatan: "" });
        fetchObservasi();
      } else {
        showNotif("error", "Gagal simpan observasi");
      }
    } catch {
      showNotif("error", "Gagal simpan observasi");
    } finally {
      setActionLoading(null);
    }
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-gray-100 text-gray-700" },
    dikirim_ke_wali_kelas: { label: "Dikirim WK", color: "bg-amber-100 text-amber-700" },
    dikonfirmasi: { label: "Dikonfirmasi", color: "bg-blue-100 text-blue-700" },
    difinalisasi: { label: "Difinalisasi", color: "bg-green-100 text-green-700" },
    siap_print: { label: "Siap Print", color: "bg-emerald-100 text-emerald-700" },
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Wakasek</h1>
          <p className="text-sm text-gray-500">Review raport &amp; input observasi kelas</p>
        </div>
        <div className="text-sm text-gray-400">
          {session?.user?.name || "Wakasek"}
        </div>
      </div>

      {/* Notif */}
      {notif && (
        <div className={`p-4 rounded-lg text-sm ${notif.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {notif.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("raport")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "raport" ? "bg-white shadow-sm text-violet-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          Review Raport
          {raportPending.length > 0 && (
            <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">{raportPending.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("observasi")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "observasi" ? "bg-white shadow-sm text-violet-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          Observasi Kelas
        </button>
        <button
          onClick={() => setActiveTab("kurikulum")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "kurikulum" ? "bg-white shadow-sm text-violet-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          Kurikulum
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : activeTab === "raport" ? (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statusLabels).map(([key, { label, color }]) => (
              <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className={`text-xs font-medium px-2 py-1 rounded-md w-fit mb-2 ${color}`}>{label}</div>
                <div className="text-2xl font-bold text-gray-900">{raportStats[key] || 0}</div>
              </div>
            ))}
          </div>

          {/* Pending Review */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                Raport Menunggu Review
                {raportPending.length > 0 && (
                  <span className="ml-2 text-amber-600 font-normal">({raportPending.length})</span>
                )}
              </h2>
            </div>
            {raportPending.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                Tidak ada raport yang menunggu review
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Siswa</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Kelas</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Periode</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-5 py-3 text-right font-medium text-gray-500">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {raportPending.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{r.siswa_nama || "-"}</td>
                      <td className="px-5 py-3 text-gray-600">{r.nama_kelas || "-"}</td>
                      <td className="px-5 py-3 text-gray-600">{r.periode || "-"}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-md ${statusLabels[r.status as string]?.color || "bg-gray-100 text-gray-600"}`}>
                          {statusLabels[r.status as string]?.label || r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApproveRaport(r.id)}
                            disabled={actionLoading === r.id}
                            className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === r.id ? "..." : "Finalisasi"}
                          </button>
                          <button
                            onClick={() => handleRejectRaport(r.id)}
                            disabled={actionLoading === r.id}
                            className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                          >
                            Tolak
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : activeTab === "observasi" ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Input Observasi Kelas</h2>
            <form onSubmit={handleSubmitObservasi} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Guru</label>
                <select
                  value={obsForm.guruId}
                  onChange={e => setObsForm(f => ({ ...f, guruId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  required
                >
                  <option value="">Pilih Guru</option>
                  {guruList.map(g => (
                    <option key={g.guru_id} value={g.guru_id}>{g.nama || g.guru_id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={obsForm.tanggal}
                  onChange={e => setObsForm(f => ({ ...f, tanggal: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Skor (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={obsForm.skor}
                  onChange={e => setObsForm(f => ({ ...f, skor: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="0-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Aspek</label>
                <select
                  value={obsForm.aspek}
                  onChange={e => setObsForm(f => ({ ...f, aspek: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="kelas">Kelas</option>
                  <option value="laboratorium">Laboratorium</option>
                  <option value="lapangan">Lapangan</option>
                  <option value="rapat">Rapat</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label>
                <textarea
                  value={obsForm.catatan}
                  onChange={e => setObsForm(f => ({ ...f, catatan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  rows={3}
                  placeholder="Catatan hasil observasi..."
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={actionLoading === "obs"}
                  className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  {actionLoading === "obs" ? "Menyimpan..." : "Simpan Observasi"}
                </button>
              </div>
            </form>
          </div>

          {/* Riwayat Observasi */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Riwayat Observasi</h2>
            </div>
            {observasiList.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                Belum ada observasi
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {observasiList.map(o => (
                  <div key={o.id} className="px-5 py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{o.guru_nama || o.guru_id}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {o.tanggal} · {o.observer} · {o.aspek}
                        </div>
                      </div>
                      {o.skor != null && (
                        <div className={`text-sm font-bold px-2 py-1 rounded-md ${
                          o.skor >= 85 ? "bg-green-100 text-green-700" :
                          o.skor >= 70 ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {o.skor}
                        </div>
                      )}
                    </div>
                    {o.catatan && (
                      <p className="mt-2 text-sm text-gray-600">{o.catatan}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {kurikulumPanel(kurikulum)}
        </div>
      )}
    </div>
  );
}
