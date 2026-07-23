"use client";

import { useState, useEffect } from "react";

interface Briefing {
  jadwal: { className: string; subject: string; startTime: string; endTime: string }[];
  materiTertinggal: { mapel: string; progress: number; total: number }[];
  tugasBelumDikoreksi: number;
  siswaPerhatian: { nama: string; alasan: string }[];
}

export default function MorningBriefingCard() {
  const [enabled, setEnabled] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchBriefing = async () => {
      try {
        const res = await fetch("/api/morning-briefing", { cache: "no-store" });
        if (!res.ok) throw new Error("Gagal memuat briefing");
        const data = await res.json();
        if (cancelled) return;
        setEnabled(data.enabled);
        setDismissed(!!data.dismissed);
        setBriefing(data.briefing);
      } catch {
        // Diam saja — jangan crash dashboard jika briefing gagal
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBriefing();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await fetch("/api/morning-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
    } catch {
      /* abaikan */
    }
  };

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await fetch("/api/morning-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_preference", enabled: next }),
      });
    } catch {
      /* abaikan */
    }
  };

  if (loading) {
    return (
      <div className="bg-white/70 border border-slate-200/60 rounded-2xl px-4 py-3 flex items-center gap-2 animate-pulse">
        <span className="text-lg">☀️</span>
        <span className="text-xs text-slate-400 font-medium">Menyiapkan briefing pagi...</span>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="bg-white/70 border border-slate-200/60 rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔕</span>
          <span className="text-xs text-slate-500 font-medium">
            Briefing pagi dinonaktifkan.
          </span>
        </div>
        <button
          onClick={handleToggle}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          Aktifkan
        </button>
      </div>
    );
  }

  if (dismissed || !briefing) return null;

  const kosong =
    !briefing.jadwal.length &&
    !briefing.materiTertinggal.length &&
    !briefing.tugasBelumDikoreksi &&
    !briefing.siswaPerhatian.length;

  if (kosong) {
    return (
      <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">☀️</span>
          <p className="text-sm font-bold text-indigo-800 leading-tight">
            Semangat pagi! Tidak ada hal mendesak hari ini.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 whitespace-nowrap"
        >
          Tutup
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">☀️</span>
          <p className="text-sm font-bold text-indigo-800 leading-tight">Briefing Pagi</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 whitespace-nowrap"
        >
          Tutup
        </button>
      </div>

      <div className="space-y-2.5 text-xs text-indigo-900/90">
        {briefing.jadwal.length > 0 && (
          <div>
            <p className="font-semibold text-indigo-700 mb-1">📚 Jadwal mengajar</p>
            <ul className="space-y-0.5">
              {briefing.jadwal.slice(0, 4).map((j, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{j.subject} · {j.className}</span>
                  <span className="text-indigo-600 font-medium whitespace-nowrap">{j.startTime}–{j.endTime}</span>
                </li>
              ))}
              {briefing.jadwal.length > 4 && (
                <li className="text-indigo-500">+{briefing.jadwal.length - 4} sesi lainnya</li>
              )}
            </ul>
          </div>
        )}

        {briefing.materiTertinggal.length > 0 && (
          <div>
            <p className="font-semibold text-indigo-700 mb-1">📌 Lanjut materi</p>
            <ul className="space-y-0.5">
              {briefing.materiTertinggal.slice(0, 3).map((m, i) => (
                <li key={i}>• {m.mapel}: minggu ke-{m.progress} dari {m.total}</li>
              ))}
            </ul>
          </div>
        )}

        {briefing.tugasBelumDikoreksi > 0 && (
          <div className="flex items-center gap-1.5">
            <span>✍️</span>
            <span>
              <strong>{briefing.tugasBelumDikoreksi}</strong> tugas sumatif menunggu koreksi
            </span>
          </div>
        )}

        {briefing.siswaPerhatian.length > 0 && (
          <div>
            <p className="font-semibold text-indigo-700 mb-1">💡 Siswa butuh perhatian</p>
            <ul className="space-y-0.5">
              {briefing.siswaPerhatian.slice(0, 3).map((s, i) => (
                <li key={i}>• {s.nama} — {s.alasan}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-2.5 pt-2 border-t border-indigo-200/60 flex items-center justify-between">
        <span className="text-[11px] text-indigo-500/80">Pesan otomatis setiap pagi</span>
        <button
          onClick={handleToggle}
          className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700"
        >
          Matikan briefing
        </button>
      </div>
    </div>
  );
}
