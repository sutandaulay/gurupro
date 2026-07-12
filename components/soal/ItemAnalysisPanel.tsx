"use client";

import { useState, useMemo } from "react";
import {
  analyzeQuestion,
  calculateAggregateStats,
  type ItemAnalysis,
  type AggregateStats,
} from "@/lib/utils/item-analysis";

interface ItemAnalysisPanelProps {
  soalList: any[];
}

export default function ItemAnalysisPanel({ soalList }: ItemAnalysisPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const aggregateStats = useMemo(() => calculateAggregateStats(soalList), [soalList]);

  const itemAnalyses = useMemo(() => {
    return soalList
      .map((soal, idx) => analyzeQuestion(soal, idx))
      .filter((item) => filterType === "all" || item.tipe === filterType);
  }, [soalList, filterType]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(soalList.map((s) => s.tipe));
    return Array.from(types);
  }, [soalList]);

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total Soal</p>
          <p className="text-3xl font-black text-indigo-600 mt-1">{aggregateStats.totalSoal}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500 font-semibold uppercase">Avg Kesukaran</p>
          <p className="text-xl font-black text-amber-600 mt-1">
            {(aggregateStats.avgDifficulty * 100).toFixed(0)}%
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500 font-semibold uppercase">Avg Diskriminasi</p>
          <p className="text-xl font-black text-emerald-600 mt-1">
            {(aggregateStats.avgDiscrimination * 100).toFixed(0)}%
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500 font-semibold uppercase">Butir Perlu Review</p>
          <p className="text-3xl font-black text-rose-600 mt-1">
            {aggregateStats.questionsNeedingReview}
          </p>
        </div>
      </div>

      {/* Bloom Taxonomy Distribution */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          📊 Distribusi Level Kognitif (Bloom's Taxonomy)
        </h4>
        <div className="flex items-end gap-1 h-24">
          {["C1", "C2", "C3", "C4", "C5", "C6"].map((level) => {
            const count = aggregateStats.bloomDistribution[level] || 0;
            const maxCount = Math.max(...Object.values(aggregateStats.bloomDistribution), 1);
            const height = (count / maxCount) * 100;
            const colors: Record<string, string> = {
              C1: "bg-emerald-400",
              C2: "bg-emerald-500",
              C3: "bg-amber-400",
              C4: "bg-amber-500",
              C5: "bg-rose-400",
              C6: "bg-rose-500",
            };
            return (
              <div key={level} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full ${colors[level]} rounded-t-lg transition-all`}
                  style={{ height: `${Math.max(height, 5)}%` }}
                />
                <span className="text-[10px] font-bold text-slate-600">{level}</span>
                <span className="text-[10px] text-slate-400">{count}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-400 rounded" /> LOTS (C1-C3)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-400 rounded" /> HOTS (C4-C6)</span>
        </div>
      </div>

      {/* Difficulty Distribution */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h4 className="text-sm font-bold text-slate-800 mb-4">📈 Distribusi Tingkat Kesukaran</h4>
        <div className="space-y-2">
          {["Mudah", "Sedang", "Sulit"].map((level) => {
            const count = aggregateStats.difficultyDistribution[level.toLowerCase()] || 0;
            const percentage = (count / aggregateStats.totalSoal) * 100;
            const colors: Record<string, string> = {
              Mudah: "bg-emerald-500",
              Sedang: "bg-amber-500",
              Sulit: "bg-rose-500",
            };
            return (
              <div key={level} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 w-16">{level}</span>
                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors[level]} rounded-full transition-all`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-600 w-12 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-500">Filter Tipe:</span>
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-1 rounded-full text-[10px] font-bold transition ${
            filterType === "all"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Semua
        </button>
        {uniqueTypes.map((tipe) => (
          <button
            key={tipe}
            onClick={() => setFilterType(tipe)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition capitalize ${
              filterType === tipe
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tipe}
          </button>
        ))}
      </div>

      {/* Individual Item Analysis */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-800">📋 Analisis Per Butir Soal</h4>
        {itemAnalyses.map((item) => (
          <div
            key={item.soalId}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition"
          >
            <div
              className="p-4 cursor-pointer"
              onClick={() => toggleExpand(item.index)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-bold text-slate-700">#{item.index + 1}</span>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full capitalize">
                    {item.tipe}
                  </span>
                  {item.hasVisual && (
                    <span className="text-xs">🎨</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.difficulty.color}`}>
                    {item.difficulty.label}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.discrimination.color}`}>
                    Disk: {item.discrimination.label}
                  </span>
                  <span className="text-slate-400">
                    {expandedIndex === item.index ? "▲" : "▼"}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">{item.pertanyaan}</p>
            </div>

            {/* Expanded Content */}
            {expandedIndex === item.index && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase">Tingkat Kesukaran</p>
                    <p className={`text-sm font-bold ${item.difficulty.label === "Mudah" ? "text-emerald-600" : item.difficulty.label === "Sedang" ? "text-amber-600" : "text-rose-600"}`}>
                      {item.difficulty.label} ({(item.difficulty.value * 100).toFixed(0)}%)
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">{item.difficulty.description}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase">Indeks Diskriminasi</p>
                    <p className={`text-sm font-bold ${item.discrimination.label === "Baik" ? "text-emerald-600" : item.discrimination.label === "Cukup" ? "text-amber-600" : "text-rose-600"}`}>
                      {item.discrimination.label} ({(item.discrimination.value * 100).toFixed(0)}%)
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">{item.discrimination.interpretation}</p>
                  </div>
                </div>

                {/* Distractor Analysis */}
                {item.distractors.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-slate-600 uppercase mb-2">Analisis Pengecoh</p>
                    <div className="space-y-2">
                      {item.distractors.map((d) => (
                        <div key={d.letter} className="bg-white rounded-lg p-2 border border-slate-200">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                d.isCorrect
                                  ? "bg-emerald-500 text-white"
                                  : "bg-slate-200 text-slate-600"
                              }`}>
                                {d.letter}
                              </span>
                              <span className="text-xs text-slate-600 truncate max-w-[200px]">{d.option}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-700">{d.selectedCount} siswa</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                d.effectiveness === "good"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : d.effectiveness === "weak"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}>
                                {d.effectiveness === "good" ? "Efektif" : d.effectiveness === "weak" ? "Lemah" : "Buruk"}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${d.isCorrect ? "bg-emerald-500" : "bg-slate-400"} rounded-full`}
                              style={{ width: `${d.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendation */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">💡 Saran</p>
                  <p className="text-xs text-amber-800">{item.recommendation}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
