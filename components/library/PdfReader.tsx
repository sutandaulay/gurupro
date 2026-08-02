/**
 * PDF Reader using react-pdf
 * Progress tracked per-page via debounced API call
 */

"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { apiFetch } from "@/lib/api-client";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  itemId: string;
  initialPage: number;
  pageCount: number;
}

export default function PdfReader({ itemId, initialPage, pageCount }: Props) {
  const [numPages, setNumPages] = useState(pageCount || 1);
  const [pageNumber, setPageNumber] = useState(initialPage || 1);
  const [scale, setScale] = useState(1.2);
  const [darkMode, setDarkMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef(0);

  // Load PDF via streaming API on mount
  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      setLoadingPdf(true);
      setLoadError(null);
      try {
        const res = await apiFetch(`/api/library/items/${itemId}/stream`);
        if (!res.ok) {
          if (!cancelled) setLoadError("Gagal memuat dokumen PDF");
          return;
        }
        const blob = await res.arrayBuffer();
        if (!cancelled) {
          setPdfData(blob);
          setLoadError(null);
        }
      } catch {
        if (!cancelled) setLoadError("Gagal memuat dokumen PDF");
      } finally {
        if (!cancelled) setLoadingPdf(false);
      }
    }
    loadPdf();
    return () => { cancelled = true; };
  }, [itemId]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const goToPrev = () => setPageNumber(p => Math.max(1, p - 1));
  const goToNext = () => setPageNumber(p => Math.min(numPages, p + 1));

  const reportProgress = useCallback(async (page: number, percent: number) => {
    const now = Date.now();
    // Debounce: don't fire more than once per 3 seconds
    if (now - lastUpdateRef.current < 3000) return;
    lastUpdateRef.current = now;

    try {
      await apiFetch("/api/library/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          progressPercent: percent,
          lastPage: page,
          deltaActiveSeconds: 0,
        }),
      });
    } catch {
      // Silent fail — progress tracking shouldn't interrupt reading
    }
  }, [itemId]);

  // Report progress when page changes
  useEffect(() => {
    const percent = Math.round((pageNumber / numPages) * 100);
    reportProgress(pageNumber, percent);
  }, [pageNumber, numPages, reportProgress]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") goToPrev();
    if (e.key === "ArrowRight" || e.key === "ArrowDown") goToNext();
  }, [pageNumber, numPages]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleRetry = () => {
    // Re-trigger PDF load by updating itemId key or re-fetching
    const newId = `${itemId}?t=${Date.now()}`;
    setLoadingPdf(true);
    setLoadError(null);
    fetch(`/api/library/items/${newId}/stream`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.arrayBuffer();
      })
      .then(blob => {
        setPdfData(blob);
        setLoadingPdf(false);
      })
      .catch(() => {
        setLoadError("Gagal memuat dokumen PDF");
        setLoadingPdf(false);
      });
  };

  return (
    <div className={`flex-1 flex flex-col ${darkMode ? "bg-neutral-900" : "bg-neutral-100"}`}>
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${darkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-slate-200 text-slate-700"}`}>
        <div className="flex items-center gap-2">
          <button onClick={goToPrev} disabled={pageNumber <= 1}
            className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm">
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={e => {
                const p = parseInt(e.target.value);
                if (p >= 1 && p <= numPages) setPageNumber(p);
              }}
              className={`w-12 text-center border rounded px-1 py-0.5 text-sm ${
                darkMode ? "bg-neutral-700 border-neutral-600 text-white" : "bg-white border-slate-300"
              }`}
            />
            / {numPages}
          </span>
          <button onClick={goToNext} disabled={pageNumber >= numPages}
            className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className="p-1.5 rounded-lg hover:bg-slate-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.1))}
            className="p-1.5 rounded-lg hover:bg-slate-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button onClick={() => setDarkMode(d => !d)}
            className="p-1.5 rounded-lg hover:bg-slate-200 ml-2">
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-200">
        <div
          className="h-full bg-violet-500 transition-all duration-300"
          style={{ width: `${(pageNumber / numPages) * 100}%` }}
        />
      </div>

      {/* PDF viewport */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4">
        {loadingPdf ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
            <p className="mb-2">{loadError}</p>
            <button onClick={handleRetry} className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600">
              Coba Lagi
            </button>
          </div>
        ) : (
        <Document
          file={pdfData}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
              <p className="mb-2">Gagal memuat dokumen PDF</p>
              <button onClick={handleRetry} className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600">
                Coba Lagi
              </button>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            className="shadow-xl"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
        )}
      </div>
    </div>
  );
}
