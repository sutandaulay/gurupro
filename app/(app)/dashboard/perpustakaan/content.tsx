"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api-client";
import LibraryCard from "@/components/library/LibraryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import type { LibraryItem, LibraryCategory, ProgressItem } from "@/lib/library/types";

const BookReader = dynamic(() => import("@/components/library/BookReader"), { ssr: false });
const AudioPlayer = dynamic(() => import("@/components/library/AudioPlayer"), { ssr: false });

export default function PerpustakaanPage() {
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [continueReading, setContinueReading] = useState<ProgressItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [activeItemUrl, setActiveItemUrl] = useState<string | null>(null);
  const [activeItemCover, setActiveItemCover] = useState<string | null>(null);

  // Fetch categories
  useEffect(() => {
    apiFetch("/api/library/categories")
      .then(r => r.json())
      .then(d => { if (d.data) setCategories(d.data); })
      .catch(() => {});
  }, []);

  // Fetch continue reading
  useEffect(() => {
    apiFetch("/api/library/progress?status=sedang_berjalan")
      .then(r => r.json())
      .then(d => {
        // Only keep items that have a title (JOIN succeeded — item exists)
        if (d.data) setContinueReading(d.data.filter((i: any) => i.title).slice(0, 5));
      })
      .catch(() => {});
  }, []);

  // Fetch catalog
  const fetchItems = useCallback(async (cat = selectedCategory, q = search, pg = page, lim = pageSize) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (cat) params.set("category", cat);
      params.set("page", String(pg));
      params.set("limit", String(lim));
      const res = await apiFetch(`/api/library/items?${params}`);
      const d = await res.json();
      if (d.data) {
        setItems(d.data);
        setTotalPages(d.pagination?.totalPages ?? 1);
        setTotalItems(d.pagination?.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, page, pageSize]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchItems(selectedCategory, search, 1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleCategoryChange = (slug: string) => {
    setSelectedCategory(slug === selectedCategory ? "" : slug);
    setPage(1);
    fetchItems(slug === selectedCategory ? "" : slug, search, 1);
  };

  const handleOpenItem = async (item: any) => {
    const id = item.id || item.item_id;
    if (!id) { alert("ID item tidak ditemukan"); return; }
    try {
      const res = await apiFetch(`/api/library/items/${id}`);
      const d = await res.json();
      if (d.data) {
        setActiveItem(d.data);
        if (d.data.type === "audio") {
          setActiveItemUrl(d.data.file_signed_url);
          setActiveItemCover(d.data.cover_signed_url);
        }
      } else {
        // Item deleted/archived — open with progress data
        setActiveItem({
          id,
          title: item.title || "Buku",
          type: item.type || "pdf",
          last_page: item.last_page,
          progress_percent: item.progress_percent,
          page_count: item.page_count,
        });
      }
    } catch {
      alert("Gagal membuka item");
    }
  };

  const handleOpenItemVoid = (item: any) => { void handleOpenItem(item); };

  const handleCloseReader = () => {
    setActiveItem(null);
    setActiveItemUrl(null);
    setActiveItemCover(null);
    fetchItems();
    // Refresh continue reading
    apiFetch("/api/library/progress?status=sedang_berjalan")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setContinueReading(d.data.slice(0, 5)); });
  };

  const handleRefreshItemUrl = useCallback(async (): Promise<string | null> => {
    if (!activeItem?.id) return null;
    try {
      const res = await apiFetch(`/api/library/items/${activeItem.id}`);
      const d = await res.json();
      return d.data?.file_signed_url ?? null;
    } catch {
      return null;
    }
  }, [activeItem]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Perpustakaan Digital</h1>
              <p className="text-sm text-slate-500">Buku PDF &amp; Audiobook untuk pengembangan diri guru</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari judul buku atau penulis..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 pl-10 bg-slate-100 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Category filter */}
        <div className="max-w-7xl mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto thin-scrollbar pb-1">
            <button
              onClick={() => handleCategoryChange("")}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !selectedCategory
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Semua
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.slug)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat.slug
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Continue Reading */}
        {continueReading.length > 0 && !activeItem ? (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Lanjutkan</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {continueReading.map((item: any) => (
                <div
                  key={item.item_id}
                  onClick={() => handleOpenItem(item)}
                  onKeyDown={e => e.key === "Enter" && handleOpenItem(item)}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer shrink-0 w-40 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow text-left active:scale-95"
                >
                  <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                    {item.cover_image_key ? (
                      <img
                        src={`/api/library/cover?key=${encodeURIComponent(item.cover_image_key)}`}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
                      <div className="h-full bg-amber-500" style={{ width: `${item.progress_percent || 0}%` }} />
                    </div>
                    {item.last_page ? (
                      <div className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        h. {item.last_page}
                      </div>
                    ) : null}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-slate-800 truncate">{item.title}</p>
                    <p className="text-[10px] text-amber-600 font-medium">
                      Halaman {item.last_page || "?"} — {item.progress_percent || 0}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Catalog grid */}
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-3">
            {selectedCategory
              ? categories.find(c => c.slug === selectedCategory)?.name || "Kategori"
              : "Semua Buku"}
          </h2>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <Skeleton className="aspect-[3/4] rounded-none" />
                  <div className="p-2 space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-slate-500">Belum ada buku di kategori ini</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map(item => (
                <LibraryCard key={item.id} item={item} onOpen={handleOpenItemVoid} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalItems > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={totalItems}
              totalPages={totalPages}
              onPageChange={(p) => { setPage(p); }}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              loading={loading}
            />
          )}
        </section>
      </div>

      {/* Reader overlay */}
      {activeItem && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3">
            <div className="text-white">
              <p className="font-medium text-sm truncate max-w-md">{activeItem.title}</p>
              <p className="text-xs text-slate-400">{activeItem.author}</p>
            </div>
            <button
              onClick={handleCloseReader}
              className="text-white hover:text-slate-300 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {activeItem.type === "pdf" ? (
            <BookReader
              itemId={activeItem.id}
              initialPage={activeItem.last_page || activeItem.progress_percent ? Math.round((activeItem.progress_percent / 100) * (activeItem.page_count || 1)) : 1}
              pageCount={activeItem.page_count || 1}
              fallbackFileUrl={activeItem.file_signed_url || undefined}
            />
          ) : (
            <AudioPlayer
              fileUrl={activeItemUrl}
              itemId={activeItem.id}
              coverUrl={activeItemCover}
              initialPosition={activeItem.last_position_seconds || 0}
              duration={activeItem.duration_seconds || 0}
              onClose={handleCloseReader}
              onRefreshUrl={handleRefreshItemUrl}
            />
          )}
        </div>
      )}
    </div>
  );
}
