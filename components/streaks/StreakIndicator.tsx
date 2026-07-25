"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastJournalDate: string | null;
  updatedAt: string;
}

function formatTanggal(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function StreakIndicator() {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchStreak = async () => {
      try {
        const res = await apiFetch("/api/streaks", { cache: "no-store" });
        if (!res.ok) throw new Error("Gagal memuat streak");
        const data = await res.json();
        if (!cancelled) setStreak(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStreak();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white/70 border border-slate-200/60 rounded-2xl px-4 py-3 flex items-center gap-2 animate-pulse">
        <span className="text-lg">🔥</span>
        <span className="text-xs text-slate-400 font-medium">Memuat progres harian...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2">
        <span className="text-lg">🔥</span>
        <span className="text-xs text-amber-700 font-medium">
          Progres harian belum bisa dimuat. Coba sebentar lagi ya.
        </span>
      </div>
    );
  }

  if (!streak) return null;

  const hariIniAtauKemarin =
    streak.lastJournalDate &&
    (() => {
      const last = new Date(streak.lastJournalDate);
      const now = new Date();
      const diffHari = Math.floor(
        (now.setHours(0, 0, 0, 0) - last.setHours(0, 0, 0, 0)) / 86400000
      );
      return diffHari <= 1;
    })();

  if (streak.currentStreak <= 0) {
    return (
      <div className="bg-white/70 border border-slate-200/60 rounded-2xl px-4 py-3 flex items-center gap-2">
        <span className="text-lg">🌱</span>
        <span className="text-xs text-slate-600 font-medium">
          Yuk mulai update jurnal hari ini — langkah kecil untuk konsisten!
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2.5">
      <span className="text-xl">🔥</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-amber-800 leading-tight">
          {streak.currentStreak} hari berturut-turut update jurnal
        </p>
        <p className="text-[11px] text-amber-600/80 leading-tight">
          {hariIniAtauKemarin
            ? "Keren, terus pertahankan ya!"
            : `Rekor terbaik Anda: ${streak.longestStreak} hari`}
        </p>
      </div>
    </div>
  );
}
