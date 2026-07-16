"use client";

import { useState, useEffect } from "react";

interface AdminManagerProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function AdminManager({ onSuccess, onError }: AdminManagerProps) {
  const [admins, setAdmins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    nama_lengkap: "",
    whatsapp: "",
    password: "",
    role: "manager" as "super_admin" | "manager",
    is_active: true,
  });

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/admins');
      if (res.ok) {
        const data = await res.json();
        setAdmins(data);
      } else {
        const err = await res.json();
        onError(err.error || "Gagal memuat daftar admin");
      }
    } catch (e: any) {
      onError(e.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingAdmin(null);
    setFormData({
      email: "",
      username: "",
      nama_lengkap: "",
      whatsapp: "",
      password: "",
      role: "manager",
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (admin: any) => {
    setModalMode("edit");
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      username: admin.username || "",
      nama_lengkap: admin.nama_lengkap || "",
      whatsapp: admin.whatsapp || "",
      password: "",
      role: admin.role === "super_admin" ? "super_admin" : "manager",
      is_active: admin.is_active !== false,
    });
    setShowModal(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));

    // Auto-format WhatsApp
    if (name === "whatsapp") {
      setFormData(prev => ({
        ...prev,
        [name]: value.replace(/\D/g, "")
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (modalMode === "create" && !formData.password) {
      onError("Password wajib diisi untuk admin baru!");
      return;
    }

    if (modalMode === "edit" && formData.password && formData.password.length < 6) {
      onError("Password minimal 6 karakter!");
      return;
    }

    setIsSaving(true);

    try {
      const action = modalMode === "create" ? "create" : "update";
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...formData,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess(data.message);
        setShowModal(false);
        fetchAdmins();
      } else {
        onError(data.error || "Gagal menyimpan admin");
      }
    } catch (e: any) {
      onError(e.message || "Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (admin: any) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus admin "${admin.nama_lengkap || admin.email}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "delete",
          email: admin.email,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess(data.message);
        fetchAdmins();
      } else {
        onError(data.error || "Gagal menghapus admin");
      }
    } catch (e: any) {
      onError(e.message || "Terjadi kesalahan");
    }
  };

  const handleToggleActive = async (admin: any) => {
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "update",
          email: admin.email,
          is_active: admin.is_active === false,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess(data.message);
        fetchAdmins();
      } else {
        onError(data.error || "Gagal mengupdate status admin");
      }
    } catch (e: any) {
      onError(e.message || "Terjadi kesalahan");
    }
  };

  const filteredAdmins = admins.filter(admin => {
    const query = searchQuery.toLowerCase();
    return (
      admin.email?.toLowerCase().includes(query) ||
      admin.username?.toLowerCase().includes(query) ||
      admin.nama_lengkap?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const formatWA = (phone: string) => {
    if (!phone) return "-";
    return `+62 ${phone.slice(1)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            👥 Manajemen Admin ({admins.length})
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Kelola akun administrator sistem
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari admin..."
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-violet-500 w-full sm:w-48"
          />
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition whitespace-nowrap"
          >
            + Tambah Admin
          </button>
        </div>
      </div>

      {/* Admin List */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">
          <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-sm">Memuat daftar admin...</p>
        </div>
      ) : filteredAdmins.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="text-4xl mb-3">👤</div>
          <p className="text-slate-500 font-medium">
            {searchQuery ? "Tidak ada admin yang cocok dengan pencarian" : "Belum ada admin lain"}
          </p>
          {!searchQuery && (
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition"
            >
              + Tambah Admin Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-slate-600 font-bold uppercase tracking-wide">Admin</th>
                <th className="px-4 py-3 text-center text-slate-600 font-bold uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-slate-600 font-bold uppercase tracking-wide">Kontak</th>
                <th className="px-4 py-3 text-center text-slate-600 font-bold uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-slate-600 font-bold uppercase tracking-wide">Terdaftar</th>
                <th className="px-4 py-3 text-right text-slate-600 font-bold uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdmins.map((admin) => (
                <tr key={admin.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white text-sm font-bold">
                        {admin.nama_lengkap ? admin.nama_lengkap.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "AD"}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{admin.nama_lengkap || "(Tanpa Nama)"}</p>
                        <p className="text-slate-500 font-mono text-[10px]">@{admin.username || "-"}</p>
                        <p className="text-slate-400 text-[10px]">{admin.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {admin.role === "super_admin" ? (
                      <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                        🛡️ Super Admin
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-600">
                        📋 Manager
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-600 font-mono">{admin.whatsapp ? formatWA(admin.whatsapp) : "-"}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(admin)}
                      className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                        admin.is_active === false
                          ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                          : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      {admin.is_active === false ? "🚫 Nonaktif" : "✓ Aktif"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">
                    {formatDate(admin.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(admin)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(admin)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold rounded-lg transition"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold">
                    {modalMode === "create" ? "➕ Tambah Admin Baru" : "✏️ Edit Admin"}
                  </h2>
                  <p className="text-slate-300 text-xs mt-1">
                    {modalMode === "create" ? "Tambah administrator baru" : `Edit admin: ${editingAdmin?.email}`}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/80 hover:text-white p-2 rounded-xl transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={modalMode === "edit"}
                  className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500 ${
                    modalMode === "edit" ? "bg-slate-50 cursor-not-allowed" : ""
                  }`}
                  placeholder="admin@contoh.com"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                  placeholder="admin_guru"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  name="nama_lengkap"
                  value={formData.nama_lengkap}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Nama Admin"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                  WhatsApp
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">+62</span>
                  <input
                    type="tel"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                    placeholder="8123456789"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                  Role <span className="text-rose-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
                >
                  <option value="manager">📋 Manager — Kelola Pembayaran, Approval, Komplain</option>
                  <option value="super_admin">🛡️ Super Admin — Akses Penuh ke Semua Fitur</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {formData.role === "super_admin"
                    ? "Super Admin dapat mengelola semua fitur termasuk pengaturan teknis sistem."
                    : "Manager hanya dapat mengelola pembayaran, approval, komplain, dan fitur non-teknis."}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                  Password {modalMode === "create" && <span className="text-rose-500">*</span>}
                  {modalMode === "edit" && <span className="text-slate-400 font-normal">(opsional)</span>}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={modalMode === "create"}
                  minLength={modalMode === "edit" ? 6 : undefined}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={modalMode === "create" ? "Minimal 6 karakter" : "Kosongkan jika tidak diubah"}
                />
              </div>

              {modalMode === "edit" && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-slate-300 text-violet-600"
                  />
                  <label htmlFor="is_active" className="text-xs font-semibold text-slate-600 cursor-pointer">
                    Admin aktif (dapat login)
                  </label>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <span>💾</span> {modalMode === "create" ? "Tambah Admin" : "Simpan Perubahan"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}