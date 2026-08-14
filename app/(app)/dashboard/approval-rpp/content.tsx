"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ApprovalStatusBadge from "@/components/approval/ApprovalStatusBadge";
import { usePendingApproval } from "@/components/approval/usePendingApproval";

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
  approval_layer?: string;
  approval_stage?: "wakasek_layer" | "kepsek_final" | "full";
  wakasek_approved?: boolean;
}

export default function ApprovalRppPage() {
  const router = useRouter();
  const { docs, loading, error, processingId, load, act } = usePendingApproval();
  const [note, setNote] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, aksi: "approve" | "revisi") => {
    if (aksi === "revisi" && !note[id]?.trim()) {
      alert("Tulis catatan revisi untuk guru ya.");
      return;
    }
    const res = await act(id, aksi, note[id] || null);
    if (res.ok) {
      setNote((n) => ({ ...n, [id]: "" }));
    } else {
      alert(res.error);
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
              <div className="flex flex-col items-end gap-1">
                <ApprovalStatusBadge status={d.approval_status as any} />
                {d.approval_layer === "double" && (
                  <span className="text-[10px] text-slate-400 font-medium">
                    Double approval{" "}
                    {d.wakasek_approved
                      ? "• Wakasek ✓, menunggu Kepsek"
                      : "• Menunggu Wakasek"}
                  </span>
                )}
              </div>
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
                    className={`flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50`}
                  >
                    {processingId === d.id
                      ? "Memproses..."
                      : d.approval_stage === "wakasek_layer"
                        ? "Setujui (Layer Wakasek)"
                        : d.approval_stage === "kepsek_final"
                          ? "Setujui (Final Kepsek)"
                          : "Setujui"}
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
                  {d.approval_layer === "double" && d.approval_stage === "wakasek_layer"
                    ? "Menunggu persetujuan Wakasek (layer 1/2 double approval)"
                    : "Menunggu persetujuan final Kepsek (layer 2/2 double approval)"}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
