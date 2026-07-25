"use client";
import { apiFetch } from "@/lib/api-client";

import { useState } from "react";

export type ApprovalStatus = "draft" | "pending" | "approved" | "revisi";

const CONFIG: Record<ApprovalStatus, { label: string; className: string; icon: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200", icon: "📝" },
  pending: { label: "Menunggu Persetujuan", className: "bg-amber-100 text-amber-700 border-amber-200", icon: "⏳" },
  approved: { label: "Disetujui", className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "✅" },
  revisi: { label: "Perlu Revisi", className: "bg-rose-100 text-rose-700 border-rose-200", icon: "✏️" },
};

export default function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const cfg = CONFIG[status] || CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.className}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// Tombol ajukan ke Kepsek (hanya untuk dokumen milik sendiri, status draft/revisi)
export function SubmitApprovalButton({ docId, status, onSubmitted }: {
  docId: string;
  status: ApprovalStatus;
  onSubmitted?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  if (status === "pending" || status === "approved") return null;

  const handleSubmit = async () => {
    if (!confirm("Ajukan dokumen ini ke Kepsek untuk disetujui?")) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/administrasi/${docId}/submit-approval`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Gagal mengajukan dokumen");
        return;
      }
      onSubmitted?.();
    } catch {
      alert("Terjadi kesalahan saat mengajukan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSubmit}
      disabled={loading}
      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
    >
      {loading ? "Mengajukan..." : "Ajukan ke Kepsek"}
    </button>
  );
}
