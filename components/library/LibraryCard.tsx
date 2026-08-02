/**
 * LibraryCard — cover book card for catalog grid
 */

"use client";
import type { LibraryItem } from "@/lib/library/types";

interface Props {
  item: LibraryItem;
  onOpen: (item: LibraryItem) => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m} menit`;
}

export default function LibraryCard({ item, onOpen }: Props) {
  const coverUrl = `/api/library/cover?key=${encodeURIComponent(item.cover_image_key)}`;

  return (
    <button
      onClick={() => { void onOpen(item); }}
      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-violet-300 transition-all group text-left cursor-pointer"
    >
      <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
        <img
          src={coverUrl}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div class="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <svg class="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span class="text-[10px]">${item.type === "pdf" ? "PDF" : "Audio"}</span>
                </div>
              `;
            }
          }}
        />
        {/* Type badge */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
            item.type === "pdf"
              ? "bg-blue-100 text-blue-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {item.type === "pdf" ? "PDF" : "Audio"}
          </span>
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight">{item.title}</p>
        {item.author && (
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.author}</p>
        )}
        <p className="text-[10px] text-slate-400 mt-1">
          {item.type === "pdf"
            ? item.page_count ? `${item.page_count} halaman` : "PDF"
            : item.duration_seconds ? formatDuration(item.duration_seconds) : "Audiobook"}
        </p>
      </div>
    </button>
  );
}
