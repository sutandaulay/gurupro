"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/app/components/ui/toast";

// =====================================================
// Review Proses Mengajar Guru (spec §1.3)
// Ringkasan lintas guru + drill-down profil seorang guru
// (RPP, realisasi jurnal, riwayat observasi, feedback KS)
// =====================================================

interface GuruRow {
  guruId: string;
  guruNama: string;
  guruEmail: string | null;
  totalRpp: number;
  rppApproved: number;
  totalJurnal: number;
  totalObservasi: number;
  totalFeedback: number;
  realisasi: number;
}

interface ProfilGuru {
  guru: {
    guruId: string;
    guruNama: string;
    guruEmail: string | null;
    totalRpp: number;
    rppApproved: number;
    totalJurnal: number;
  };
  rpp: {
    id: string;
    judul_dokumen: string;
    tipe_dokumen: string;
    approval_status: string | null;
    tanggal_kegiatan: string | null;
  }[];
  jurnal: {
    tanggal: string | null;
    kelas: string | null;
    mapel: string | null;
    materi_pembelajaran: string | null;
    status: string | null;
  }[];
  observasi: {
    id: string;
    tanggal: string;
    skor: string | null;
    aspek: string;
    catatan: string | null;
    observer: string | null;
  }[];
  feedback: {
    id: string;
    tanggal: string;
    jenis: string;
    judul: string;
    isi: string;
    ks_nama: string | null;
    is_read: boolean;
  }[];
}

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  revisi: "bg-rose-100 text-rose-700",
};

function fmtTanggal(v: string | null | undefined): string {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function realisasiColor(v: number): string {
  if (v >= 80) return "bg-emerald-500";
  if (v >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

export default function ReviewProsesContent() {
  const params = useParams();
  const institutionId = params.institutionId as string;
  const toast = useToast();

  const [guru, setGuru] = useState<GuruRow[]>([]);
  const [profil, setProfil] = useState<ProfilGuru | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilLoading, setProfilLoading] = useState(false);
  const [error, setError] = useState("");

  const [fbGuru, setFbGuru] = useState("");
  const [fbForm, setFbForm] = useState({ judul: "", isi: "", jenis: "feedback" });
  const [saving, setSaving] = useState(false);

  const loadGuru = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/institution/${institutionId}/review-proses?institutionId=${institutionId}`);
      const data = await res.json();
      if (res.ok) setGuru(data.guru || []);
      else setError(data.error || "Gagal memuat data");
    } catch {
      setError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    loadGuru();
  }, [loadGuru]);

  const openProfil = async (guruId: string) => {
    setProfilLoading(true);
    setProfil(null);
    try {
      const res = await fetch(`/api/institution/${institutionId}/review-proses?institutionId=${institutionId}&guruId=${guruId}`);
      const data = await res.json();
      if (res.ok) setProfil(data);
      else toast.error(data.error || "Gagal memuat profil");
    } catch {
      toast.error("Gagal memuat profil");
    } finally {
      setProfilLoading(false);
    }
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbGuru || !fbForm.judul.trim() || !fbForm.isi.trim()) {
      toast.error("Guru, judul, dan isi feedback wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/review-proses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          guruId: fbGuru,
          judul: fbForm.judul,
          isi: fbForm.isi,
          jenis: fbForm.jenis,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim feedback");
      toast.success("Feedback terkirim");
      setFbForm({ judul: "", isi: "", jenis: "feedback" });
      if (guruIdToName(fbGuru)) await openProfil(fbGuru);
      else loadGuru();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim feedback");
    } finally {
      setSaving(false);
    }
  };

  const guruIdToName = (id: string) => guru.find((g) => g.guruId === id)?.guruNama;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Review Proses Mengajar</h1>
        <p className="text-sm text-gray-500">
          RPP, realisasi jurnal, observasi kelas, dan feedback Kepala Sekolah per guru
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
      )}

      {profil && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <div className="font-bold text-gray-900">{profil.guru.guruNama}</div>
              <div className="text-xs text-gray-400">
                {profil.guru.guruEmail} · {profil.guru.totalRpp} RPP ({profil.guru.rppApproved} disetujui) · {profil.guru.totalJurnal} jurnal mengajar
              </div>
            </div>
            <button onClick={() => setProfil(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer px-3 py-1 text-sm border border-gray-200 rounded-lg">
              ← Kembali
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5">
            {/* RPP */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-3">RPP / Modul Ajar</h3>
              {profil.rpp.length === 0 ? (
                <div className="text-sm text-gray-400">Belum ada RPP.</div>
              ) : (
                <div className="space-y-2">
                  {profil.rpp.map((r) => (
                    <div key={r.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-medium text-gray-800">{r.judul_dokumen}</span>
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGE[r.approval_status || ""] || "bg-gray-100 text-gray-500"}`}>
                          {r.approval_status || "—"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {r.tipe_dokumen} · {fmtTanggal(r.tanggal_kegiatan)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Jurnal / Realisasi */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-3">Jurnal Mengajar (Realisasi)</h3>
              {profil.jurnal.length === 0 ? (
                <div className="text-sm text-gray-400">Belum ada jurnal.</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {profil.jurnal.map((j, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{j.kelas || "—"} {j.mapel ? `· ${j.mapel}` : ""}</span>
                        <span>{fmtTanggal(j.tanggal)}</span>
                      </div>
                      {j.materi_pembelajaran && (
                        <div className="text-sm text-gray-800 mt-1 line-clamp-2">{j.materi_pembelajaran}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Observasi + Feedback */}
            <section className="space-y-5">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Riwayat Observasi</h3>
                {profil.observasi.length === 0 ? (
                  <div className="text-sm text-gray-400">Belum ada observasi.</div>
                ) : (
                  <div className="space-y-2">
                    {profil.observasi.map((o) => (
                      <div key={o.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">{fmtTanggal(o.tanggal)} {o.observer ? `· ${o.observer}` : ""}</span>
                          {o.skor != null && (
                            <span className="text-sm font-bold text-gray-900">Skor {o.skor}</span>
                          )}
                        </div>
                        {o.aspek && <div className="text-xs text-gray-400 mt-1">Aspek: {o.aspek}</div>}
                        {o.catatan && <div className="text-sm text-gray-700 mt-1">{o.catatan}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Feedback Kepala Sekolah</h3>
                {profil.feedback.length === 0 ? (
                  <div className="text-sm text-gray-400">Belum ada feedback.</div>
                ) : (
                  <div className="space-y-2">
                    {profil.feedback.map((f) => (
                      <div key={f.id} className="border border-violet-100 bg-violet-50/40 rounded-lg p-3">
                        <div className="text-xs text-gray-500">
                          {fmtTanggal(f.tanggal)} · {f.ks_nama || "KS"}
                        </div>
                        <div className="text-sm font-medium text-gray-800 mt-1">{f.judul}</div>
                        <div className="text-sm text-gray-600 mt-0.5">{f.isi}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Ringkasan semua guru */}
      {!profil && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-400">Memuat...</div>
          ) : guru.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">
              Belum ada guru aktif di institusi ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Guru</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">RPP</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Jurnal</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Realisasi</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Observasi</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Feedback</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {guru.map((g) => (
                    <tr key={g.guruId} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{g.guruNama}</div>
                        {g.guruEmail && <div className="text-xs text-gray-400">{g.guruEmail}</div>}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {g.totalRpp} <span className="text-gray-400 text-xs">({g.rppApproved} ✓)</span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{g.totalJurnal}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${realisasiColor(g.realisasi)}`} style={{ width: `${Math.min(100, g.realisasi)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-700">{g.realisasi}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{g.totalObservasi}</td>
                      <td className="px-5 py-3 text-gray-600">{g.totalFeedback}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openProfil(g.guruId)}
                          className="px-3 py-1 text-xs font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700 cursor-pointer"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Kirim feedback */}
      {!profil && guru.length > 0 && (
        <form onSubmit={handleSendFeedback} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Kirim Feedback ke Guru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Guru</label>
              <select
                value={fbGuru}
                onChange={(e) => setFbGuru(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-violet-400 focus:outline-none"
              >
                <option value="">Pilih guru...</option>
                {guru.map((g) => (
                  <option key={g.guruId} value={g.guruId}>{g.guruNama}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Judul</label>
              <input
                value={fbForm.judul}
                onChange={(e) => setFbForm({ ...fbForm, judul: e.target.value })}
                placeholder="Contoh: Perlu penguatan asesmen"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-violet-400 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Isi Feedback</label>
            <textarea
              value={fbForm.isi}
              onChange={(e) => setFbForm({ ...fbForm, isi: e.target.value })}
              rows={3}
              placeholder="Tuliskan catatan/apresiasi konkret untuk guru..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-violet-400 focus:outline-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Mengirim..." : "Kirim Feedback"}
            </button>
          </div>
        </form>
      )}

      {profilLoading && (
        <div className="text-center py-10 text-gray-400">Memuat profil guru...</div>
      )}
    </div>
  );
}