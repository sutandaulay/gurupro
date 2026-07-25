"use client";
import { apiFetch } from "@/lib/api-client";

import { useEffect, useState } from "react";

type AddonPkg = { id: string; name: string; poinAmount: number; price: number };

export default function PoinTopUpModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId?: string | null }) {
  const [packages, setPackages] = useState<AddonPkg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch("/api/token-packages")
      .then((r) => r.json())
      .then((data) => {
        setPackages(data.packages || []);
      })
      .catch((e) => setError("Gagal memuat paket"))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleBuy(pkgId: string) {
    setLoading(true);
    try {
      const res = await apiFetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "addon", userId: userId || null, packageId: pkgId }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.error || "Gagal memulai checkout");
      }
    } catch (e: any) {
      setError(e?.message || "Gagal memulai checkout");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Beli Poin Ekstra</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Tutup</button>
        </div>
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
        {loading && <div className="text-sm text-gray-500">Memuat...</div>}
        {!loading && packages.length === 0 && <div className="text-sm text-gray-500">Tidak ada paket tersedia.</div>}
        <div className="grid grid-cols-1 gap-3">
          {packages.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-gray-500">{p.poinAmount} poin</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold">Rp{Number(p.price).toLocaleString()}</div>
                <button onClick={() => handleBuy(p.id)} className="px-3 py-1 rounded bg-violet-600 text-white text-sm">Beli</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
