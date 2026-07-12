/**
 * LKPDPreview Component
 *
 * Visual preview untuk LKPD - menampilkan aktivitas dengan kartu-kartu yang rapi
 */

"use client";

import { IconRefresh, IconDownload, IconClock, IconTarget, IconUser } from "@tabler/icons-react";

interface Aktivitas {
  tipe?: string;
  instruksi?: string;
  pertanyaan_pemandu?: string[];
  ruang_jawaban?: string;
  rubrik_singkat?: string;
}

interface PertemuanLKPD {
  pertemuan?: number;
  judul?: string;
  tujuan?: string[];
  keseimbangan?: {
    olah_pikir?: string;
    olah_hati?: string;
    olah_rasa?: string;
    olah_raga?: string;
  };
  aktivitas?: Aktivitas[];
  waktu_estimasi?: string;
}

interface LKPDContent {
  lkpd?: PertemuanLKPD[];
}

interface LKPDPreviewProps {
  lkpd?: LKPDContent | null;
  isLoading?: boolean;
  onRegenerate?: () => void;
  onExport?: () => void;
  isRegenerating?: boolean;
}

export default function LKPDPreview({
  lkpd,
  isLoading = false,
  onRegenerate,
  onExport,
  isRegenerating = false,
}: LKPDPreviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-48" />
        ))}
      </div>
    );
  }

  if (!lkpd || !lkpd.lkpd || lkpd.lkpd.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconUser size={32} className="text-gray-400" />
        </div>
        <p className="text-gray-500 text-sm">LKPD belum tersedia</p>
        <p className="text-gray-400 text-xs mt-1">
          Hasilkan LKPD untuk melihat preview
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">
            {lkpd.lkpd.length} Pertemuan
          </p>
          <p className="text-xs text-gray-500">
            Lembar Kerja Peserta Didik
          </p>
        </div>
        <div className="flex gap-2">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isRegenerating ? (
                <>
                  <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                  Regenerate...
                </>
              ) : (
                <>
                  <IconRefresh size={14} />
                  Regenerate
                </>
              )}
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <IconDownload size={14} />
              Export PDF
            </button>
          )}
        </div>
      </div>

      {/* LKPD Pertemuan */}
      {lkpd.lkpd.map((pertemuan, index) => (
        <PertemuanCard key={index} pertemuan={pertemuan} index={index} />
      ))}
    </div>
  );
}

// ============================================
// PertemuanCard Component
// ============================================

interface PertemuanCardProps {
  pertemuan: PertemuanLKPD;
  index: number;
}

function PertemuanCard({ pertemuan, index }: PertemuanCardProps) {
  const judul = pertemuan.judul || `Pertemuan ${pertemuan.pertemuan || index + 1}`;
  const keseimbangan = pertemuan.keseimbangan;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              {pertemuan.pertemuan || index + 1}
            </span>
            <span className="text-white font-semibold text-sm">{judul}</span>
          </div>
          {pertemuan.waktu_estimasi && (
            <div className="flex items-center gap-1 text-white/80 text-xs">
              <IconClock size={12} />
              {pertemuan.waktu_estimasi}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Tujuan Pembelajaran */}
        {pertemuan.tujuan && pertemuan.tujuan.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <IconTarget size={14} className="text-emerald-600" />
              <p className="text-xs font-semibold text-gray-700">
                Tujuan Pembelajaran
              </p>
            </div>
            <ul className="space-y-1 pl-5">
              {pertemuan.tujuan.map((tujuan, i) => (
                <li key={i} className="text-xs text-gray-600 list-disc">
                  {tujuan}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Keseimbangan Aktivitas */}
        {keseimbangan && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Keseimbangan Aktivitas
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { key: "olah_pikir", label: "Olah Pikir", emoji: "🧠" },
                { key: "olah_hati", label: "Olah Hati", emoji: "❤️" },
                { key: "olah_rasa", label: "Olah Rasa", emoji: "✨" },
                { key: "olah_raga", label: "Olah Raga", emoji: "🏃" },
              ].map(({ key, label, emoji }) => {
                const value = keseimbangan[key as keyof typeof keseimbangan];
                if (!value) return null;
                return (
                  <div key={key} className="bg-white rounded-lg p-2">
                    <span className="text-lg">{emoji}</span>
                    <p className="text-[10px] font-medium text-gray-600 mt-1">
                      {value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Aktivitas */}
        {pertemuan.aktivitas && pertemuan.aktivitas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Aktivitas
            </p>
            <div className="space-y-3">
              {pertemuan.aktivitas.map((akt, i) => (
                <AktivitasCard key={i} aktivitas={akt} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// AktivitasCard Component
// ============================================

interface AktivitasCardProps {
  aktivitas: Aktivitas;
  index: number;
}

function AktivitasCard({ aktivitas, index }: AktivitasCardProps) {
  const tipeIcon = getTipeIcon(aktivitas.tipe);
  const tipeColor = getTipeColor(aktivitas.tipe);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Aktivitas Header */}
      <div className={`px-3 py-2 ${tipeColor.bg}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{tipeIcon}</span>
          <span className={`text-xs font-semibold ${tipeColor.text}`}>
            {aktivitas.tipe?.toUpperCase() || "AKTIVITAS"} #{index + 1}
          </span>
        </div>
      </div>

      {/* Aktivitas Content */}
      <div className="p-3 space-y-3">
        {/* Instruksi */}
        {aktivitas.instruksi && (
          <p className="text-xs text-gray-700">{aktivitas.instruksi}</p>
        )}

        {/* Pertanyaan Pemandu */}
        {aktivitas.pertanyaan_pemandu &&
          aktivitas.pertanyaan_pemandu.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
                Pertanyaan:
              </p>
              <ol className="space-y-1 list-decimal list-inside">
                {aktivitas.pertanyaan_pemandu.map((q, i) => (
                  <li key={i} className="text-xs text-gray-600">
                    {q}
                  </li>
                ))}
              </ol>
            </div>
          )}

        {/* Ruang Jawaban */}
        {aktivitas.ruang_jawaban && (
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
              Ruang Jawaban:
            </p>
            <p className="text-xs text-gray-600 italic">
              {aktivitas.ruang_jawaban}
            </p>
          </div>
        )}

        {/* Rubrik */}
        {aktivitas.rubrik_singkat && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
            <p className="text-[10px] font-semibold text-amber-700 uppercase mb-1">
              Rubrik Penilaian:
            </p>
            <p className="text-xs text-amber-800">{aktivitas.rubrik_singkat}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function getTipeIcon(tipe?: string): string {
  if (!tipe) return "📋";
  const t = tipe.toLowerCase();
  if (t.includes("diskusi")) return "💬";
  if (t.includes("presentasi")) return "🎤";
  if (t.includes("tugas")) return "✏️";
  if (t.includes("praktik")) return "🛠️";
  if (t.includes("refleksi")) return "🤔";
  if (t.includes("apersepsi")) return "💡";
  if (t.includes("motivasi")) return "🚀";
  return "📋";
}

function getTipeColor(
  tipe?: string
): { bg: string; text: string } {
  if (!tipe) return { bg: "bg-gray-100", text: "text-gray-700" };
  const t = tipe.toLowerCase();
  if (t.includes("diskusi"))
    return { bg: "bg-blue-100", text: "text-blue-700" };
  if (t.includes("presentasi"))
    return { bg: "bg-purple-100", text: "text-purple-700" };
  if (t.includes("tugas"))
    return { bg: "bg-green-100", text: "text-green-700" };
  if (t.includes("praktik"))
    return { bg: "bg-orange-100", text: "text-orange-700" };
  if (t.includes("refleksi"))
    return { bg: "bg-pink-100", text: "text-pink-700" };
  if (t.includes("apersepsi"))
    return { bg: "bg-cyan-100", text: "text-cyan-700" };
  if (t.includes("motivasi"))
    return { bg: "bg-indigo-100", text: "text-indigo-700" };
  return { bg: "bg-gray-100", text: "text-gray-700" };
}
