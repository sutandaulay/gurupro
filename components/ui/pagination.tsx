"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 500, 1000, "all"] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export const ALL_SIZE = 100000;

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  loading?: boolean;
  showSizeSelector?: boolean;
  showInfo?: boolean;
  className?: string;
}

export interface PagedItems<T> {
  pagedItems: T[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  reset: (next?: number) => void;
}

export function usePagedItems<T>(items: T[], initialPageSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedItems = items.slice(start, start + pageSize);

  const reset = (next: number = 1) => setPage(next);

  return { pagedItems, total, totalPages, page: safePage, pageSize, setPageSize, reset };
}

function getPageItems(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, 2, totalPages - 1, totalPages, current - 1, current, current + 1]);
  const sorted = Array.from(pages).filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const items: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) items.push("ellipsis");
    items.push(p);
    prev = p;
  }
  return items;
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  loading,
  showSizeSelector = true,
  showInfo = true,
  className,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const pageItems = useMemo(() => getPageItems(safePage, safeTotalPages), [safePage, safeTotalPages]);

  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  const btnBase =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const btnInactive = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700";
  const btnActive = "border-indigo-600 bg-indigo-600 text-white shadow-sm";

  const isAll = pageSize >= ALL_SIZE;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 pt-4", className)}>
      {showInfo && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Menampilkan <span className="font-semibold text-slate-700 dark:text-slate-200">{from.toLocaleString("id-ID")}</span>
          {" – "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{to.toLocaleString("id-ID")}</span> dari{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{total.toLocaleString("id-ID")}</span> data
        </p>
      )}

      {showSizeSelector && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Tampilkan</span>
          <select
            value={isAll ? "all" : String(pageSize)}
            onChange={e => {
              const v = e.target.value;
              onPageSizeChange(v === "all" ? ALL_SIZE : Number(v));
            }}
            disabled={loading}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={String(opt)} value={String(opt)}>
                {opt === "all" ? "Semua" : `${opt} / halaman`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={loading || safePage === 1}
          aria-label="Halaman pertama"
          className={cn(btnBase, btnInactive)}
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={loading || safePage === 1}
          aria-label="Halaman sebelumnya"
          className={cn(btnBase, btnInactive)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageItems.map((item, i) =>
          item === "ellipsis" ? (
            <span key={`e-${i}`} className="px-1 text-sm text-slate-400 dark:text-slate-500">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              disabled={loading}
              className={cn(btnBase, item === safePage ? btnActive : btnInactive)}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={loading || safePage === safeTotalPages}
          aria-label="Halaman berikutnya"
          className={cn(btnBase, btnInactive)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safeTotalPages)}
          disabled={loading || safePage === safeTotalPages}
          aria-label="Halaman terakhir"
          className={cn(btnBase, btnInactive)}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
