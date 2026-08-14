"use client";
import { apiFetch } from "@/lib/api-client";
import { useCallback, useState } from "react";

// =====================================================
// Hook bersama "Persetujuan RPP/Modul Ajar" (Kepsek/Wakasek).
// Dipakai oleh dashboard app-level maupun dashboard institusi —
// menghindari duplikasi logika fetch + aksi approve/revisi.
// =====================================================

export interface PendingDoc {
  id: string;
  user_id: string | number;
  tipe_dokumen: "rpp" | "modul";
  judul_dokumen: string;
  approval_status: string;
  approval_note: string | null;
  guru_nama: string;
  created_at: string;
  institution_id: number;
  can_approve: boolean;
  my_roles: string[];
  approval_layer?: string;
  approval_stage?: "wakasek_layer" | "kepsek_final" | "full";
  wakasek_approved?: boolean;
}

export function usePendingApproval() {
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/administrasi/pending-approval", { cache: "no-store" });
      if (res.status === 403) {
        setError("Anda tidak punya akses.");
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
  }, []);

  const act = useCallback(
    async (id: string, aksi: "approve" | "revisi", catatan?: string | null) => {
      setProcessingId(id);
      try {
        const res = await apiFetch(`/api/administrasi/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksi, catatan: catatan || null }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false as const, error: data.error || "Gagal memproses." };
        }
        await load();
        return { ok: true as const, data };
      } catch {
        return { ok: false as const, error: "Terjadi kesalahan." };
      } finally {
        setProcessingId(null);
      }
    },
    [load]
  );

  return { docs, loading, error, processingId, load, act, setDocs };
}