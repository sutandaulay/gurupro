"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/app/components/ui/toast";

interface Task {
  id: string;
  title: string;
  description: string | null;
  column: "backlog" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  assignee_id: string | null;
  assignee_nama: string | null;
  created_at: string;
}

interface Assignee {
  user_id: string;
  nama: string;
  role: string;
}

const COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "Sedang Berjalan" },
  { key: "done", label: "Selesai" },
] as const;

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};

const COLUMN_HEAD: Record<string, string> = {
  backlog: "bg-gray-500",
  in_progress: "bg-amber-500",
  done: "bg-emerald-500",
};

function fmtDate(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function KanbanContent() {
  const params = useParams();
  const institutionId = params.institutionId as string;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
    due_date: "",
    assignee_id: "",
    column: "backlog" as "backlog" | "in_progress" | "done",
  });

  const loadKanban = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/kanban`);
      const data = await res.json();
      if (res.ok) {
        setFeatureEnabled(Boolean(data.featureEnabled));
        if (data.featureEnabled) {
          setTasks(data.tasks || []);
          setAssignees(data.assignees || []);
        }
      } else {
        setError(data.error || "Gagal memuat data");
      }
    } catch {
      setError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    loadKanban();
  }, [loadKanban]);

  const handleSubmit = async () => {
    if (!institutionId) return;
    if (!form.title.trim()) {
      toast.error("Judul wajib diisi");
      return;
    }
    try {
      const res = await fetch(`/api/institution/${institutionId}/kanban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          priority: form.priority,
          due_date: form.due_date || null,
          assignee_id: form.assignee_id || null,
          column: form.column,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat tugas");
      setTasks((prev) => [...prev, data.task]);
      setShowForm(false);
      setForm({
        title: "",
        description: "",
        priority: "medium",
        due_date: "",
        assignee_id: "",
        column: "backlog",
      });
      toast.success("Tugas dibuat");
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat tugas");
    }
  };

  const moveTask = async (id: string, column: string) => {
    try {
      const res = await fetch(`/api/institution/${institutionId}/kanban?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memindahkan tugas");
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, column: column as any } : t)));
    } catch (err: any) {
      toast.error(err.message || "Gagal memindahkan tugas");
    }
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm("Hapus tugas ini?")) return;
    try {
      const res = await fetch(`/api/institution/${institutionId}/kanban?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus tugas");
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Tugas dihapus");
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus tugas");
    }
  };

  const onDrop = (col: string) => {
    if (dragId) {
      moveTask(dragId, col);
      setDragId(null);
    }
  };

  const countByColumn = (col: string) => tasks.filter((t) => t.column === col).length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kanban Task</h1>
          <p className="text-sm text-gray-500">
            Manajemen tugas internal Kepala Sekolah &amp; Wakasek
          </p>
        </div>
        {featureEnabled === true && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
          >
            {showForm ? "Batal" : "+ Tambah Tugas"}
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : featureEnabled === false ? (
        <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
          Fitur Kanban Task belum aktif untuk institusi ini. Aktifkan lewat pengaturan institusi.
        </div>
      ) : (
        <>
          {showForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Tambah Tugas Baru</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Judul Tugas *
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="cth: Review RPP semester ini"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Prioritas
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="low">Rendah</option>
                    <option value="medium">Sedang</option>
                    <option value="high">Tinggi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Tenggat
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Kolom Awal
                  </label>
                  <select
                    value={form.column}
                    onChange={(e) => setForm((f) => ({ ...f, column: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Ditugaskan Ke
                  </label>
                  <select
                    value={form.assignee_id}
                    onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">— Tidak ada —</option>
                    {assignees.map((a) => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.nama} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
                >
                  Simpan Tugas
                </button>
              </div>
            </div>
          )}

          {/* Kanban board */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(col.key)}
                className={`bg-gray-50 rounded-xl p-4 min-h-[300px] ${
                  dragId ? "ring-2 ring-violet-300" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-2.5 h-2.5 rounded-full ${COLUMN_HEAD[col.key]}`} />
                  <span className="font-semibold text-sm text-gray-800">{col.label}</span>
                  <span className="ml-auto text-xs text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                    {countByColumn(col.key)}
                  </span>
                </div>
                <div className="space-y-3">
                  {tasks
                    .filter((t) => t.column === col.key)
                    .map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => setDragId(null)}
                        className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm text-gray-900">{t.title}</div>
                          <div className="flex gap-1 shrink-0">
                            <select
                              value={t.column}
                              onChange={(e) => moveTask(t.id, e.target.value)}
                              className="text-[11px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-500"
                              title="Pindah kolom"
                            >
                              {COLUMNS.map((c) => (
                                <option key={c.key} value={c.key}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => deleteTask(t.id)}
                              className="text-[11px] text-gray-400 hover:text-red-600"
                              title="Hapus"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        {t.description && (
                          <div className="text-xs text-gray-500 mt-1">{t.description}</div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${PRIORITY_BADGE[t.priority]}`}
                          >
                            {PRIORITY_LABEL[t.priority]}
                          </span>
                          {t.due_date && (
                            <span className="text-[10px] text-gray-400">
                              Tenggat {fmtDate(t.due_date)}
                            </span>
                          )}
                          {t.assignee_nama && (
                            <span className="text-[10px] text-violet-600 font-medium">
                              {t.assignee_nama}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  {countByColumn(col.key) === 0 && (
                    <div className="text-center text-xs text-gray-300 py-6 border border-dashed border-gray-200 rounded-lg">
                      Kosong
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
