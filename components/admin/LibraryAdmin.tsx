"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  BookOpen, GraduationCap, Brain, Code, FlaskConical, Globe,
  Lightbulb, Mic, Newspaper, PenTool, PieChart, Play,
  ScrollText, Sparkles, Star, Telescope, TestTube, BookMarked,
  Headphones, FileText, Layers, Microscope, User
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  display_order: number;
}

interface LibraryItem {
  id: string;
  title: string;
  author: string | null;
  type: string;
  category_id: string;
  synopsis: string | null;
  cover_image_key: string;
  file_key: string;
  page_count: number | null;
  duration_seconds: number | null;
  status: string;
  created_at: string;
  category_name: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const ICON_MAP: Record<string, any> = {
  BookOpen, GraduationCap, Brain, Code, FlaskConical, Globe,
  Lightbulb, Mic, Newspaper, PenTool, PieChart, Play,
  ScrollText, Sparkles, Star, Telescope, TestTube, BookMarked,
  Headphones, FileText, Layers, Microscope, User,
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function LibraryAdmin() {
  const [tab, setTab] = useState<"items" | "categories">("items");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  // Upload state
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");

  // Form state
  const [form, setForm] = useState({
    title: "", author: "", type: "pdf", categoryId: "",
    synopsis: "", pageCount: "", durationSeconds: "", coverImageKey: "", fileKey: "",
    status: "draft",
  });

  // Category form
  const [catForm, setCatForm] = useState({ name: "", slug: "", icon: "" });
  const [showCatForm, setShowCatForm] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await apiFetch(`/api/admin/library/items?${params}`);
      const d = await res.json();
      if (d.data) {
        setItems(d.data);
        setTotalPages(d.pagination?.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const fetchCategories = useCallback(async () => {
    const res = await apiFetch("/api/admin/library/categories");
    const d = await res.json();
    if (d.data) setCategories(d.data);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const resetForm = () => {
    setForm({ title: "", author: "", type: "pdf", categoryId: "", synopsis: "",
      pageCount: "", durationSeconds: "", coverImageKey: "", fileKey: "", status: "draft" });
    setEditingId(null);
    setCoverFile(null);
    setContentFile(null);
    setFormError("");
  };

  const handleEdit = (item: LibraryItem) => {
    setForm({
      title: item.title, author: item.author || "", type: item.type,
      categoryId: item.category_id, synopsis: item.synopsis || "",
      pageCount: item.page_count?.toString() || "",
      durationSeconds: item.duration_seconds?.toString() || "",
      coverImageKey: item.cover_image_key, fileKey: item.file_key,
      status: item.status,
    });
    setEditingId(item.id);
    setCoverFile(null);
    setContentFile(null);
    setFormError("");
    setShowForm(true);
  };

  const uploadFile = async (itemId: string, fileType: "pdf" | "audiobook" | "cover", file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Ukuran file maksimal 10 MB (${formatMB(file.size)})`);
    }
    const fd = new FormData();
    fd.append("itemId", itemId);
    fd.append("fileType", fileType);
    fd.append("file", file);
    const res = await apiFetch("/api/admin/library/upload", { method: "POST", body: fd });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Upload file gagal");
    return d;
  };

  const handleSaveItem = async () => {
    setFormError("");
    if (coverFile && coverFile.size > MAX_FILE_SIZE) {
      setFormError(`Sampul maksimal 10 MB (file ini ${formatMB(coverFile.size)})`);
      return;
    }
    if (contentFile && contentFile.size > MAX_FILE_SIZE) {
      setFormError(`File konten maksimal 10 MB (file ini ${formatMB(contentFile.size)})`);
      return;
    }

    setUploading(true);
    try {
      let itemId: string | null = editingId;
      const payload = {
        title: form.title,
        author: form.author || undefined,
        type: form.type,
        categoryId: form.categoryId,
        synopsis: form.synopsis || undefined,
        coverImageKey: form.coverImageKey || undefined,
        fileKey: form.fileKey || undefined,
        pageCount: form.type === "pdf" && form.pageCount ? parseInt(form.pageCount) : undefined,
        durationSeconds: form.type === "audiobook" && form.durationSeconds ? parseInt(form.durationSeconds) : undefined,
        status: form.status,
      };

      if (editingId) {
        await apiFetch(`/api/admin/library/items/${editingId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        const res = await apiFetch("/api/admin/library/items", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const d = await res.json();
        if (!res.ok) {
          const details = Array.isArray(d?.details) && d.details.length > 0
            ? d.details.map((i: any) => i.message || `Field ${(i.path || []).join(".")} tidak valid`).join("; ")
            : d?.error;
          throw new Error(details || "Gagal menyimpan item");
        }
        itemId = d.data?.id ?? null;
      }

      // Upload files (server compresses covers, enforces 10 MB limit)
      if (itemId) {
        if (coverFile) await uploadFile(itemId, "cover", coverFile);
        if (contentFile) await uploadFile(itemId, form.type === "pdf" ? "pdf" : "audiobook", contentFile);
      }

      setShowForm(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      setFormError(err?.message || "Terjadi kesalahan saat menyimpan");
    } finally {
      setUploading(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Arsipkan item ini?")) return;
    await apiFetch(`/api/admin/library/items/${id}`, { method: "DELETE" });
    fetchItems();
  };

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) { alert("Nama kategori wajib diisi"); return; }
    if (!catForm.slug.trim()) { alert("Slug wajib diisi"); return; }
    const res = await apiFetch("/api/admin/library/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catForm),
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error || "Gagal menyimpan kategori"); return; }
    setShowCatForm(false);
    setCatForm({ name: "", slug: "", icon: "" });
    fetchCategories();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Perpustakaan Digital</h2>
        <div className="flex gap-2">
          <button onClick={() => { setTab("categories"); setShowCatForm(false); setShowForm(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "categories" ? "bg-violet-600 text-white" : "bg-white border border-slate-200"}`}>
            Kategori
          </button>
          <button onClick={() => { setTab("items"); setShowForm(false); setShowCatForm(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "items" ? "bg-violet-600 text-white" : "bg-white border border-slate-200"}`}>
            Item
          </button>
        </div>
      </div>

      {tab === "categories" && (
        <div>
          {!showCatForm && (
            <button onClick={() => setShowCatForm(true)}
              className="mb-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
              + Tambah Kategori
            </button>
          )}
          {showCatForm && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4 space-y-3 max-w-md">
              <input placeholder="Nama kategori" value={catForm.name}
                onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <input placeholder="Slug (huruf kecil, strip)" value={catForm.slug}
                onChange={e => setCatForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Pilih Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { name: "BookOpen", Icon: BookOpen },
                    { name: "GraduationCap", Icon: GraduationCap },
                    { name: "Brain", Icon: Brain },
                    { name: "Code", Icon: Code },
                    { name: "FlaskConical", Icon: FlaskConical },
                    { name: "Globe", Icon: Globe },
                    { name: "Lightbulb", Icon: Lightbulb },
                    { name: "Mic", Icon: Mic },
                    { name: "Newspaper", Icon: Newspaper },
                    { name: "PenTool", Icon: PenTool },
                    { name: "PieChart", Icon: PieChart },
                    { name: "Play", Icon: Play },
                    { name: "ScrollText", Icon: ScrollText },
                    { name: "Sparkles", Icon: Sparkles },
                    { name: "Star", Icon: Star },
                    { name: "Telescope", Icon: Telescope },
                    { name: "TestTube", Icon: TestTube },
                    { name: "BookMarked", Icon: BookMarked },
                    { name: "Headphones", Icon: Headphones },
                    { name: "FileText", Icon: FileText },
                    { name: "Layers", Icon: Layers },
                    { name: "Microscope", Icon: Microscope },
                    { name: "User", Icon: User },
                  ].map(({ name, Icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setCatForm(f => ({ ...f, icon: name }))}
                      className={`p-2 rounded-lg border text-center transition cursor-pointer hover:border-violet-400 ${
                        catForm.icon === name
                          ? "border-violet-500 bg-violet-50 text-violet-700"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <Icon className="w-5 h-5 mx-auto" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveCategory}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium">Simpan</button>
                <button onClick={() => { setShowCatForm(false); setCatForm({ name: "", slug: "", icon: "" }); }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm">Batal</button>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nama</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Slug</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Icon</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{cat.slug}</td>
                    <td className="px-4 py-3">
                      {cat.icon && ICON_MAP[cat.icon] ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 text-violet-600">
                          {(() => { const Icon = ICON_MAP[cat.icon]; return <Icon className="w-4 h-4" />; })()}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Belum ada kategori</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "items" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <input placeholder="Cari judul..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm max-w-xs" />
            {!showForm && (
              <button onClick={() => { resetForm(); setShowForm(true); }}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
                + Tambah Item
              </button>
            )}
          </div>

          {showForm && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Judul" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <input placeholder="Penulis" value={form.author}
                  onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <select value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="pdf">PDF</option>
                  <option value="audiobook">Audiobook</option>
                </select>
                <select value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">Pilih Kategori</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {form.type === "pdf" && (
                  <input placeholder="Jumlah halaman" type="number" value={form.pageCount}
                    onChange={e => setForm(f => ({ ...f, pageCount: e.target.value }))}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                )}
                {form.type === "audiobook" && (
                  <input placeholder="Durasi (detik)" type="number" value={form.durationSeconds}
                    onChange={e => setForm(f => ({ ...f, durationSeconds: e.target.value }))}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                )}
                <select value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="draft">Draft</option>
                  <option value="published">Terbit</option>
                  <option value="archived">Diarsipkan</option>
                </select>
              </div>
              <textarea placeholder="Sinopsis" value={form.synopsis} rows={2}
                onChange={e => setForm(f => ({ ...f, synopsis: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Sampul (dikompres otomatis) · maks 10 MB
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setCoverFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-violet-50 file:text-violet-700 file:text-xs file:font-medium cursor-pointer"
                  />
                  {coverFile && (
                    <span className="text-xs text-emerald-600">{coverFile.name} ({formatMB(coverFile.size)})</span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    File {form.type === "pdf" ? "PDF" : "Audio (MP3)"} · maks 10 MB
                  </label>
                  <input
                    type="file"
                    accept={form.type === "pdf" ? "application/pdf,.pdf" : "audio/*"}
                    onChange={e => setContentFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-violet-50 file:text-violet-700 file:text-xs file:font-medium cursor-pointer"
                  />
                  {contentFile && (
                    <span className="text-xs text-emerald-600">{contentFile.name} ({formatMB(contentFile.size)})</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input placeholder="R2 Key Cover (opsional, contoh: covers/{'{id}'}/cover.webp)" value={form.coverImageKey}
                  onChange={e => setForm(f => ({ ...f, coverImageKey: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <input placeholder="R2 Key File (opsional, contoh: pdf/{'{id}'}/file.pdf)" value={form.fileKey}
                  onChange={e => setForm(f => ({ ...f, fileKey: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <p className="text-xs text-slate-400">
                Key R2 otomatis dibuat jika dikosongkan. Unggah file akan mengompres sampul ke WebP (maks 800px, kualitas 80%).
              </p>
              {formError && (
                <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
              )}
              <div className="flex gap-2">
                <button onClick={handleSaveItem} disabled={uploading}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {uploading ? "Menyimpan..." : (editingId ? "Update" : "Simpan")}
                </button>
                <button onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm">Batal</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-400">Memuat...</div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Judul</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Tipe</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Kategori</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-slate-400">{item.author || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.type === "pdf" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                          }`}>{item.type === "pdf" ? "PDF" : "Audio"}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{item.category_name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "published" ? "bg-green-100 text-green-700" :
                            item.status === "archived" ? "bg-slate-100 text-slate-500" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>{item.status === "published" ? "Terbit" : item.status === "archived" ? "Arsip" : "Draft"}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleEdit(item)}
                            className="text-violet-600 hover:text-violet-800 text-xs font-medium mr-3">Edit</button>
                          <button onClick={() => handleArchive(item.id)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium">Arsipkan</button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Belum ada item</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50">Prev</button>
                  <span className="text-sm text-slate-500">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
