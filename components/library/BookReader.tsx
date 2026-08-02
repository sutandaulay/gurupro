/**
 * BookReader — Ebook reader dengan tampilan buku sungguhan
 * - Kertas cream dengan shadow
 * - Bookmark ribbon jelas
 * - Swipe + click navigation
 * - Progress persistent
 */

"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { apiFetch } from "@/lib/api-client";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  itemId: string;
  initialPage: number;
  pageCount: number;
  fallbackFileUrl?: string;
}

export default function BookReader({ itemId, initialPage, pageCount, fallbackFileUrl }: Props) {
  const [numPages, setNumPages] = useState(pageCount || 1);
  const [pageNumber, setPageNumber] = useState(initialPage || 1);
  const [scale, setScale] = useState(1.0);
  const [darkMode, setDarkMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [flipAnim, setFlipAnim] = useState<"left" | "right" | null>(null);
  const [showBookmark, setShowBookmark] = useState(false);
  const lastUpdateRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show bookmark pulse when page changes
  useEffect(() => {
    setShowBookmark(true);
    const t = setTimeout(() => setShowBookmark(false), 800);
    return () => clearTimeout(t);
  }, [pageNumber]);

  // Load PDF — try streaming API first, fallback to signed URL
  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      setLoadingPdf(true);
      setLoadError(null);

      // Try streaming API
      try {
        const res = await apiFetch(`/api/library/items/${itemId}/stream`);
        if (res.ok) {
          const blob = await res.arrayBuffer();
          if (!cancelled) { setPdfData(blob); setLoadError(null); setLoadingPdf(false); }
          return;
        }
        const text = await res.text();
        console.log("[BookReader] Stream failed:", text, "status:", res.status);
      } catch (e) {
        console.log("[BookReader] Stream error:", e);
      }

      if (fallbackFileUrl) {
        try {
          const res2 = await fetch(fallbackFileUrl);
          if (res2.ok) {
            const blob = await res2.arrayBuffer();
            if (!cancelled) { setPdfData(blob); setLoadError(null); setLoadingPdf(false); }
            return;
          }
        } catch (e2) {
          console.log("[BookReader] Fallback error:", e2);
        }
      }

      if (!cancelled) {
        const msg = "Buku tidak lagi tersedia atau file tidak ditemukan";
        setLoadError(msg);
      }
      setLoadingPdf(false);
    }
    loadPdf();
    return () => { cancelled = true; };
  }, [itemId, fallbackFileUrl]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => setNumPages(n);

  const reportProgress = useCallback(async (page: number, percent: number) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < 3000) return;
    lastUpdateRef.current = now;
    async function doReport(attempt = 1) {
      try {
        const res = await apiFetch("/api/library/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, progressPercent: percent, lastPage: page, deltaActiveSeconds: 0 }),
        });
        if (!res.ok && attempt < 3) {
          await new Promise(r => setTimeout(r, 500 * attempt));
          return doReport(attempt + 1);
        }
      } catch { /* silent */ }
    }
    doReport();
  }, [itemId]);

  useEffect(() => {
    const percent = Math.min(100, Math.round((pageNumber / numPages) * 100));
    reportProgress(pageNumber, percent);
  }, [pageNumber, numPages, reportProgress]);

  const goPage = useCallback((newPage: number) => {
    if (newPage < 1 || newPage > numPages) return;
    if (newPage === pageNumber) return;
    const dir = newPage > pageNumber ? "right" : "left";
    setFlipAnim(dir);
    setPageNumber(newPage);
    setTimeout(() => setFlipAnim(null), 300);
  }, [pageNumber, numPages]);

  const goNext = () => goPage(pageNumber + 1);
  const goPrev = () => goPage(pageNumber - 1);
  const goToPage = (p: number) => goPage(p);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) delta > 0 ? goNext() : goPrev();
    touchStartX.current = null;
  };

  // Click navigation zones
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const half = rect.width / 2;
    if (x < half) goPrev();
    else goNext();
  };

  // Colors
  const bg = darkMode ? "bg-neutral-900" : "bg-amber-50";
  const toolbarBg = darkMode ? "bg-neutral-800" : "bg-amber-100";
  const toolbarBorder = darkMode ? "border-neutral-700" : "border-amber-300";
  const textColor = darkMode ? "text-white" : "text-slate-800";
  const subColor = darkMode ? "text-slate-400" : "text-slate-500";

  const flipClass = flipAnim === "right"
    ? "animate-[slideLeft_300ms_ease-out]"
    : flipAnim === "left"
    ? "animate-[slideRight_300ms_ease-out]"
    : "";

  return (
    <style>{`
      @keyframes slideLeft {
        from { transform: translateX(8px); opacity: 0.6; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideRight {
        from { transform: translateX(-8px); opacity: 0.6; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes bookmarkPop {
        0% { transform: translateX(-50%) translateY(-4px) scaleY(1.1); }
        50% { transform: translateX(-50%) translateY(0) scaleY(1); }
        100% { transform: translateX(-50%) translateY(0) scaleY(1); }
      }
    `}</style>,
    <div className={`flex flex-col h-full ${bg}`}>
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-4 py-3 ${toolbarBg} border-b ${toolbarBorder}`}>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} disabled={pageNumber <= 1}
            className={`p-2 rounded-lg hover:bg-black/10 disabled:opacity-25 ${textColor} transition-colors`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className={`text-sm ${textColor}`}>
            <input
              type="number" min={1} max={numPages} value={pageNumber}
              onChange={e => {
                const p = parseInt(e.target.value);
                if (!isNaN(p)) goToPage(p);
              }}
              className={`w-14 text-center border rounded px-2 py-1 text-sm font-medium ${darkMode ? "bg-neutral-700 border-neutral-600 text-white" : "bg-white border-amber-300 text-slate-800"}`}
            />
            <span className="ml-1 text-slate-500">/ {numPages}</span>
          </span>
          <button onClick={goNext} disabled={pageNumber >= numPages}
            className={`p-2 rounded-lg hover:bg-black/10 disabled:opacity-25 ${textColor} transition-colors`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Bookmark indicator */}
        <div className={`flex flex-col items-center ${textColor}`}>
          <span className="text-xs font-medium">{pageNumber}</span>
          <span className={`text-[10px] ${subColor}`}>{Math.round((pageNumber / numPages) * 100)}%</span>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
            className={`p-1.5 rounded hover:bg-black/10 ${textColor}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs min-w-[40px] text-center font-medium">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.2))}
            className={`p-1.5 rounded hover:bg-black/10 ${textColor}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button onClick={() => setDarkMode(d => !d)}
            className={`p-1.5 rounded hover:bg-black/10 ml-1 ${textColor}`}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className={`h-1 ${darkMode ? "bg-neutral-700" : "bg-amber-200"}`}>
        <div className={`h-full ${darkMode ? "bg-violet-500" : "bg-amber-500"} transition-all duration-300`}
          style={{ width: `${(pageNumber / numPages) * 100}%` }} />
      </div>

      {/* Book */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden p-2 md:p-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={handlePageClick}
      >
        {loadingPdf ? (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full" />
            <span className="text-sm text-slate-500">Memuat halaman…</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-4 text-slate-500">
            <p>{loadError}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium">
              Coba Lagi
            </button>
          </div>
        ) : pdfData ? (
          <div className={`relative h-full w-full max-w-2xl mx-auto ${flipClass}`}>
            {/* Page curl shadow (top-right) */}
            <div className={`absolute -top-1 -right-1 w-12 h-12 ${darkMode ? "bg-neutral-700" : "bg-amber-200"} rounded-full blur-sm opacity-60`} />

            {/* Bookmark ribbon */}
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 ${
                showBookmark ? "animate-[bookmarkPop_300ms_ease-out]" : ""
              }`}
              style={{ animation: showBookmark ? "bookmarkPop 300ms ease-out" : "none" }}
            >
              <div className="relative">
                {/* Ribbon tail */}
                <div className={`w-5 h-10 rounded-b ${darkMode ? "bg-rose-600" : "bg-rose-500"} mx-auto`}
                  style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} />
                {/* Ribbon fork */}
                <div className={`absolute bottom-0 w-5 h-3 ${darkMode ? "bg-rose-700" : "bg-rose-600"}`} />
                <div className={`absolute bottom-0 left-[-4px] w-2.5 h-3 ${darkMode ? "bg-rose-700" : "bg-rose-600"}`} style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
                <div className={`absolute bottom-0 right-[-4px] w-2.5 h-3 ${darkMode ? "bg-rose-700" : "bg-rose-600"}`} style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
              </div>
            </div>

            {/* Page number badge */}
            <div className={`absolute bottom-2 right-3 z-10 text-xs font-medium px-2 py-0.5 rounded ${
              darkMode ? "bg-neutral-700 text-slate-300" : "bg-amber-100 text-slate-600"
            }`}>
              {pageNumber} / {numPages}
            </div>

            {/* The book page */}
            <div
              className={`relative h-full rounded-sm overflow-hidden ${
                darkMode
                  ? "bg-neutral-800 shadow-xl shadow-black/50"
                  : "bg-stone-50 shadow-[0_4px_20px_rgba(139,90,43,0.15),0_2px_6px_rgba(0,0,0,0.08)]"
              }`}
              style={{
                borderRadius: darkMode ? "2px" : "4px",
                boxShadow: darkMode
                  ? "0 8px 30px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,0,0,0.05)"
                  : "0 4px 20px rgba(139,90,43,0.15), 0 2px 6px rgba(0,0,0,0.08), inset 0 0 80px rgba(255,248,235,0.5)",
              }}
            >
              {/* Page edge (left) */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 z-10 ${
                darkMode
                  ? "bg-gradient-to-r from-neutral-700 to-neutral-800"
                  : "bg-gradient-to-r from-amber-100 via-stone-100 to-stone-50"
              }`} />

              {/* Page texture overlay */}
              {!darkMode && (
                <div className="absolute inset-0 opacity-5 pointer-events-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                    backgroundSize: "100px 100px",
                  }}
                />
              )}

              <Document file={pdfData} onLoadSuccess={onDocumentLoadSuccess} className="h-full">
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  className="h-full"
                />
              </Document>
            </div>

            {/* Navigation hints */}
            <div className={`absolute top-1/2 -translate-y-1/2 left-2 opacity-0 hover:opacity-100 transition-opacity ${darkMode ? "text-neutral-500" : "text-amber-300"}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <div className={`absolute top-1/2 -translate-y-1/2 right-2 opacity-0 hover:opacity-100 transition-opacity ${darkMode ? "text-neutral-500" : "text-amber-300"}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ) : null}
      </div>

      {/* Page slider */}
      <div className={`px-4 pb-3 ${toolbarBg}`}>
        <input
          type="range" min={1} max={numPages} value={pageNumber}
          onChange={e => goToPage(parseInt(e.target.value))}
          className={`w-full h-2 rounded-full appearance-none cursor-pointer ${
            darkMode ? "bg-neutral-600 accent-violet-500" : "bg-amber-200 accent-amber-500"
          }`}
          style={{
            background: darkMode
              ? `linear-gradient(to right, #8b5cf6 ${(pageNumber / numPages) * 100}%, #52525b ${(pageNumber / numPages) * 100}%)`
              : `linear-gradient(to right, #f59e0b ${(pageNumber / numPages) * 100}%, #fde68a ${(pageNumber / numPages) * 100}%)`,
          }}
        />
      </div>
    </div>
  );
}
