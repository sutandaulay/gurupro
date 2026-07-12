/**
 * SlidePreview Component
 *
 * Visual preview untuk slide outline - menampilkan kartu slide yang rapi
 */

"use client";

import { IconRefresh, IconDownload, IconFileDescription } from "@tabler/icons-react";

interface SlidePoint {
  poin?: string;
  poin_utama?: string[];
}

interface SlideItem {
  pertemuan?: number;
  judul_slide?: string;
  judul?: string;
  poin_utama?: string[];
  poin?: string[];
  saran_visual?: string;
  catatan_pengajar?: string;
  alokasi_waktu?: string;
}

interface SlideOutline {
  slides?: SlideItem[];
}

interface SlidePreviewProps {
  slides?: SlideOutline | null;
  isLoading?: boolean;
  onRegenerate?: () => void;
  onExport?: () => void;
  isRegenerating?: boolean;
}

export default function SlidePreview({
  slides,
  isLoading = false,
  onRegenerate,
  onExport,
  isRegenerating = false,
}: SlidePreviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-gray-100 rounded-xl h-32"
          />
        ))}
      </div>
    );
  }

  if (!slides || !slides.slides || slides.slides.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconFileDescription size={32} className="text-gray-400" />
        </div>
        <p className="text-gray-500 text-sm">Slide belum tersedia</p>
        <p className="text-gray-400 text-xs mt-1">
          Hasilkan slide untuk melihat preview
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
            {slides.slides.length} Slide
          </p>
          <p className="text-xs text-gray-500">
            Outline slide untuk presentasi pembelajaran
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
              Export PPTX
            </button>
          )}
        </div>
      </div>

      {/* Slide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {slides.slides.map((slide, index) => (
          <SlideCard key={index} slide={slide} index={index} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// SlideCard Component
// ============================================

interface SlideCardProps {
  slide: SlideItem;
  index: number;
}

function SlideCard({ slide, index }: SlideCardProps) {
  const poinUtama = slide.poin_utama || slide.poin || [];
  const judul = slide.judul_slide || slide.judul || `Slide ${index + 1}`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Slide Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              {index + 1}
            </span>
            <span className="text-white/80 text-xs">
              {slide.pertemuan
                ? `Pertemuan ${slide.pertemuan}`
                : ""}
            </span>
          </div>
          {slide.alokasi_waktu && (
            <span className="text-white/80 text-xs">
              {slide.alokasi_waktu}
            </span>
          )}
        </div>
        <h3 className="text-white font-semibold text-sm mt-2 line-clamp-2">
          {judul}
        </h3>
      </div>

      {/* Slide Content */}
      <div className="p-4">
        {/* Poin Utama */}
        {poinUtama.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
              Poin Utama
            </p>
            <ul className="space-y-1">
              {poinUtama.slice(0, 4).map((poin: string, i: number) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                  <span className="text-xs text-gray-600 line-clamp-2">{poin}</span>
                </li>
              ))}
              {poinUtama.length > 4 && (
                <li className="text-xs text-gray-400">
                  +{poinUtama.length - 4} poin lainnya
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Saran Visual */}
        {slide.saran_visual && (
          <div className="mb-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
              Saran Visual
            </p>
            <p className="text-xs text-gray-600 italic">
              {slide.saran_visual}
            </p>
          </div>
        )}

        {/* Catatan Pengajar */}
        {slide.catatan_pengajar && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
              Catatan Pengajar
            </p>
            <p className="text-xs text-gray-500 line-clamp-2">
              {slide.catatan_pengajar}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
