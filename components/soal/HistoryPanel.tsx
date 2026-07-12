"use client";

import { useState } from "react";
import {
  type HistoryEntry,
  actionLabels,
  actionIcons,
  actionColors,
  formatTimestamp,
} from "@/lib/schemas/history";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
}

export default function HistoryPanel({
  isOpen,
  onClose,
  history,
  onRestore,
  onClearHistory,
}: HistoryPanelProps) {
  const [filterAction, setFilterAction] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredHistory = filterAction === "all"
    ? history
    : history.filter(h => h.action === filterAction);

  const reversedHistory = [...filteredHistory].reverse();

  const handleRestore = (entry: HistoryEntry) => {
    if (confirm("Yakin ingin restore ke versi ini? Semua perubahan setelah ini akan hilang.")) {
      onRestore(entry);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-3xl">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              🕐 Riwayat Perubahan Soal
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {history.length} perubahan tercatat
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500">Filter:</span>
            {["all", "generate", "edit", "regenerate", "delete", "import"].map((action) => (
              <button
                key={action}
                onClick={() => setFilterAction(action)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition ${
                  filterAction === action
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {action === "all" ? "Semua" : actionLabels[action as keyof typeof actionLabels] || action}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {reversedHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3 opacity-50">📭</div>
              <p className="text-sm font-semibold text-slate-500">Belum ada riwayat perubahan</p>
              <p className="text-xs text-slate-400 mt-1">
                Perubahan akan tercatat setelah generate, edit, atau import soal
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

              <div className="space-y-4">
                {reversedHistory.map((entry, idx) => (
                  <div key={entry.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute left-2 top-1 w-4 h-4 rounded-full border-2 border-white shadow ${actionColors[entry.action].split(" ")[0]}`} />

                    {/* Entry card */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{actionIcons[entry.action]}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${actionColors[entry.action]}`}>
                              {actionLabels[entry.action]}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-700 line-clamp-2">
                            {entry.description}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {formatTimestamp(entry.timestamp)}
                          </p>
                        </div>

                        <div className="flex gap-1 shrink-0">
                          {entry.soalSnapshot && entry.action !== "generate" && entry.action !== "import" && (
                            <button
                              onClick={() => toggleExpand(entry.id)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition flex items-center justify-center"
                              title="Lihat detail"
                            >
                              {expandedId === entry.id ? "▲" : "▼"}
                            </button>
                          )}
                          {entry.action !== "generate" && entry.action !== "import" && entry.action !== "shuffle" && (
                            <button
                              onClick={() => handleRestore(entry)}
                              className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition"
                              title="Restore ke versi ini"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {expandedId === entry.id && entry.previousSoal && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Versi Sebelumnya:</p>
                          <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-xs">
                            <p className="text-rose-800 font-semibold line-clamp-2">
                              {entry.previousSoal.pertanyaan}
                            </p>
                            <div className="flex gap-2 mt-2 text-[10px] text-rose-600">
                              <span>Tipe: {entry.previousSoal.tipe}</span>
                              <span>•</span>
                              <span>Level: {entry.previousSoal.kognitif}</span>
                            </div>
                          </div>
                          {entry.newSoal && (
                            <>
                              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 mt-3">Versi Baru:</p>
                              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs">
                                <p className="text-emerald-800 font-semibold line-clamp-2">
                                  {entry.newSoal.pertanyaan}
                                </p>
                                <div className="flex gap-2 mt-2 text-[10px] text-emerald-600">
                                  <span>Tipe: {entry.newSoal.tipe}</span>
                                  <span>•</span>
                                  <span>Level: {entry.newSoal.kognitif}</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between bg-slate-50 rounded-b-3xl">
          <button
            onClick={onClearHistory}
            disabled={history.length === 0}
            className="px-4 py-2 border border-rose-300 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-50 disabled:bg-slate-100 disabled:text-slate-400 transition cursor-pointer"
          >
            🗑️ Hapus Riwayat
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
