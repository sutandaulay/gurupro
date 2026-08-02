"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ApprovalStatusBadge, { SubmitApprovalButton } from "@/components/approval/ApprovalStatusBadge";

interface PendingDoc {
  id: string;
  tipe_dokumen: string;
  judul_dokumen: string;
  approval_status: string;
  approval_note: string | null;
  guru_nama: string;
  created_at: string;
  can_approve: boolean;
  my_roles: string[];
}

export default function ApprovalRppPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/administrasi/pending-approval", { cache: "no-store" });
      if (res.status === 403) {
        setError("Halaman ini hanya untuk Kepala Sekolah atau Wakasek.");
        setDocs([]);
        return;
      }
      if (!res.ok) throw new Error("Gagal memuat");
      const data = await res.json();
      setDocs(data.documents || []);
    } catch {
      setError("Gagal memuat daftar persetujuan. Coba sebentar lagi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (id: string, aksi: "approve" | "revisi") => {
    if (aksi === "revisi" && !note[id]?.trim()) {
      alert("Tulis catatan revisi untuk guru ya.");
      return;
    }
    setProcessingId(id);
    try {
      const res = await apiFetch(`/api/administrasi/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi, catatan: note[id] || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Gagal memproses");
        return;
      }
      load();
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700 text-sm">← Kembali</button>
      </div>
      <h1 className="text-xl font-bold text-slate-800">Persetujuan RPP & Modul Ajar</h1>
      <p className="text-sm text-slate-500 mt-1 mb-5">
        Dokumen yang diajukan guru akan muncul di sini. Persetujuan bersifat opsional — guru tetap bisa memakai RPP-nya langsung.
      </p>

      {loading && (
        <div className="text-center py-10">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Memuat dokumen...</p>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">{error}</div>
      )}

      {!loading && !error && docs.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <span className="text-3xl">📭</span>
          <p className="text-sm text-slate-500 mt-2">Belum ada dokumen yang menunggu persetujuan.</p>
        </div>
      )}

      <div className="space-y-3">
        {docs.map((d) => (
          <div key={d.id} className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate">{d.judul_dokumen}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {d.tipe_dokumen === "rpp" ? "RPP" : "Modul Ajar"} • {d.guru_nama}
                </p>
              </div>
              <ApprovalStatusBadge status={d.approval_status as any} />
            </div>

            <textarea
              value={note[d.id] || ""}
              onChange={(e) => setNote((n) => ({ ...n, [d.id]: e.target.value }))}
              placeholder="Catatan untuk guru (opsional, wajib untuk revisi)"
              rows={2}
              className="w-full mt-3 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
            />

            <div className="flex gap-2 mt-3">
              {d.can_approve ? (
                <>
                  <button
                    onClick={() => handleAction(d.id, "approve")}
                    disabled={processingId === d.id}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    {processingId === d.id ? "Memproses..." : "Setujui"}
                  </button>
                  <button
                    onClick={() => handleAction(d.id, "revisi")}
                    disabled={processingId === d.id}
                    className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    Minta Revisi
                  </button>
                </>
              ) : (
                <p className="text-xs text-slate-400 italic w-full text-center py-1">
                  Menunggu persetujuan Wakasek (double approval)
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
