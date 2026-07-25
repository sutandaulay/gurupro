'use client';
import { apiFetch } from "@/lib/api-client";

import { useEffect, useState, FormEvent } from 'react';

interface Institution {
  id: number;
  name: string;
  npsn: string | null;
  jenjang: 'SD' | 'MI' | 'SMP' | 'MTs' | 'SMA' | 'MA' | 'SMK' | 'Pesantren' | 'Lainnya';
  naungan: 'Kemendikbud' | 'Kemenag' | 'Swasta_Lainnya';
  subscription_tier: 'trial' | 'basic' | 'premium' | 'enterprise';
  academic_year_active: string | null;
  approval_layer_config: 'single' | 'double';
  status: 'active' | 'suspended' | 'trial';
  created_at: string;
  updated_at: string;
  _count?: {
    institution_members: number;
  };
}

const JENJANG_OPTIONS = ['SD', 'MI', 'SMP', 'MTs', 'SMA', 'MA', 'SMK', 'Pesantren', 'Lainnya'];
const NAUNGAN_OPTIONS = [
  { label: 'Kemendikbud', value: 'Kemendikbud' },
  { label: 'Kemenag', value: 'Kemenag' },
  { label: 'Swasta Lainnya', value: 'Swasta_Lainnya' },
];
const TIER_OPTIONS = [
  { label: 'Trial', value: 'trial' },
  { label: 'Basic', value: 'basic' },
  { label: 'Premium', value: 'premium' },
  { label: 'Enterprise', value: 'enterprise' },
];
const STATUS_OPTIONS = [
  { label: 'Trial', value: 'trial' },
  { label: 'Aktif', value: 'active' },
  { label: 'Ditangguhkan', value: 'suspended' },
];

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  trial: { label: 'Trial', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
  basic: { label: 'Basic', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  premium: { label: 'Premium', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  enterprise: { label: 'Enterprise', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  trial: { label: 'Trial', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  active: { label: 'Aktif', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  suspended: { label: 'Ditangguhkan', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
};

export default function InstitutionsManager() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    npsn: '',
    jenjang: 'SD',
    naungan: 'Kemendikbud',
    subscription_tier: 'trial',
    academic_year_active: '',
    approval_layer_config: 'single',
    status: 'trial',
  });
  const [saving, setSaving] = useState(false);

  // Members Management State
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberForm, setMemberForm] = useState({
    email: '',
    name: '',
    whatsapp: '',
    password: '',
    role: 'operator',
  });
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [memberSuccess, setMemberSuccess] = useState('');

  const [defaultAcademicYear, setDefaultAcademicYear] = useState('2025/2026');

  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/institutions');
      if (!res.ok) throw new Error('Gagal memuat data lembaga');
      const data = await res.json();
      setInstitutions(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal memuat data lembaga' });
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveAcademicYear = async () => {
    try {
      const res = await apiFetch('/api/admin/active-academic-year');
      if (res.ok) {
        const data = await res.json();
        if (data.active_academic_year) {
          setDefaultAcademicYear(data.active_academic_year);
        }
      }
    } catch (err) {
      console.error('Failed to fetch active academic year:', err);
    }
  };

  useEffect(() => {
    fetchInstitutions();
    fetchActiveAcademicYear();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      name: '',
      npsn: '',
      jenjang: 'SD',
      naungan: 'Kemendikbud',
      subscription_tier: 'trial',
      academic_year_active: defaultAcademicYear,
      approval_layer_config: 'single',
      status: 'trial',
    });
    setIsModalOpen(true);
  };

  const fetchMembers = async (instId: number) => {
    setMembersLoading(true);
    try {
      const res = await apiFetch(`/api/admin/institutions/${instId}/members`);
      if (!res.ok) throw new Error('Gagal memuat anggota');
      const data = await res.json();
      setMembers(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setMembersLoading(false);
    }
  };

  const openMembersModal = (inst: Institution) => {
    setSelectedInst(inst);
    const randomPassword = 'gurupro' + Math.random().toString(36).slice(2, 8) + '!';
    setMemberForm({
      email: '',
      name: '',
      whatsapp: '',
      password: randomPassword,
      role: 'operator',
    });
    setMemberError('');
    setMemberSuccess('');
    fetchMembers(inst.id);
    setIsMembersModalOpen(true);
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedInst) return;
    setMemberSaving(true);
    setMemberError('');
    setMemberSuccess('');

    try {
      const res = await apiFetch(`/api/admin/institutions/${selectedInst.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan akun');

      setMemberSuccess('Akun operator/kepsek berhasil dibuat dan dihubungkan!');
      setMemberForm({
        email: '',
        name: '',
        whatsapp: '',
        password: 'gurupro123@operator',
        role: 'operator',
      });
      fetchMembers(selectedInst.id);
    } catch (err: any) {
      setMemberError(err.message);
    } finally {
      setMemberSaving(false);
    }
  };

  const openEditModal = (inst: Institution) => {
    setEditingId(inst.id);
    setForm({
      name: inst.name,
      npsn: inst.npsn || '',
      jenjang: inst.jenjang,
      naungan: inst.naungan,
      subscription_tier: inst.subscription_tier,
      academic_year_active: inst.academic_year_active || '',
      approval_layer_config: inst.approval_layer_config,
      status: inst.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const isEdit = editingId !== null;
    const url = '/api/admin/institutions';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: editingId, ...form } : form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');

      setMessage({
        type: 'success',
        text: `Lembaga berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}!`,
      });
      setIsModalOpen(false);
      fetchInstitutions();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus lembaga "${name}"? Seluruh data anggota dan data terkait lembaga ini akan terpengaruh.`)) return;

    try {
      const res = await apiFetch('/api/admin/institutions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Gagal menghapus lembaga');
      setMessage({ type: 'success', text: 'Lembaga berhasil dihapus' });
      fetchInstitutions();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const filtered = institutions.filter((inst) => {
    const matchTier = filterTier === 'all' || inst.subscription_tier === filterTier;
    const matchStatus = filterStatus === 'all' || inst.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      inst.name.toLowerCase().includes(q) ||
      (inst.npsn && inst.npsn.toLowerCase().includes(q));

    return matchTier && matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari lembaga, NPSN..."
            className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-white font-medium text-slate-800 w-full sm:w-60"
          />

          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold outline-none bg-white text-slate-700 cursor-pointer"
          >
            <option value="all">Semua Tier</option>
            {TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold outline-none bg-white text-slate-700 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/10"
        >
          ➕ Tambah Lembaga Baru
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Memuat data lembaga...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">Tidak ada lembaga yang terdaftar.</div>
      ) : (
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Nama Lembaga</th>
                <th className="px-4 py-3">Identitas / NPSN</th>
                <th className="px-4 py-3">Subscription Tier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Anggota</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((inst) => {
                const tier = TIER_CONFIG[inst.subscription_tier] || TIER_CONFIG.trial;
                const status = STATUS_CONFIG[inst.status] || STATUS_CONFIG.trial;
                return (
                  <tr key={inst.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <div className="text-xs font-bold text-slate-800">{inst.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {inst.jenjang} • {inst.naungan === 'Swasta_Lainnya' ? 'Swasta' : inst.naungan}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-700 font-mono">{inst.npsn || 'Tidak ada NPSN'}</div>
                      <div className="text-[10px] text-slate-400">TA: {inst.academic_year_active || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${tier.bg} ${tier.color}`}>
                        {tier.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">
                      👥 {inst._count?.institution_members || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button
                          onClick={() => openMembersModal(inst)}
                          className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition cursor-pointer"
                        >
                          👥 Akun
                        </button>
                        <button
                          onClick={() => openEditModal(inst)}
                          className="px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition cursor-pointer"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(inst.id, inst.name)}
                          className="px-2.5 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 transition cursor-pointer"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800">
                {editingId ? 'Edit Data Lembaga' : 'Tambah Lembaga Baru'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Nama Lembaga</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="contoh: SD Negeri 1 Jakarta"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">NPSN</label>
                  <input
                    type="text"
                    value={form.npsn}
                    onChange={(e) => setForm({ ...form, npsn: e.target.value })}
                    placeholder="Nomor NPSN"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Tahun Ajaran Aktif</label>
                  <input
                    type="text"
                    value={form.academic_year_active}
                    onChange={(e) => setForm({ ...form, academic_year_active: e.target.value })}
                    placeholder="e.g. 2025/2026"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Jenjang</label>
                  <select
                    value={form.jenjang}
                    onChange={(e) => setForm({ ...form, jenjang: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none bg-white"
                  >
                    {JENJANG_OPTIONS.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Naungan</label>
                  <select
                    value={form.naungan}
                    onChange={(e) => setForm({ ...form, naungan: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none bg-white"
                  >
                    {NAUNGAN_OPTIONS.map((n) => (
                      <option key={n.value} value={n.value}>{n.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Subscription Tier</label>
                  <select
                    value={form.subscription_tier}
                    onChange={(e) => setForm({ ...form, subscription_tier: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none bg-white"
                  >
                    {TIER_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none bg-white"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Approval Layer Config</label>
                <select
                  value={form.approval_layer_config}
                  onChange={(e) => setForm({ ...form, approval_layer_config: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none bg-white"
                >
                  <option value="single">Single (Langsung ke Kepala Sekolah)</option>
                  <option value="double">Double (Melalui Wakasek terlebih dahulu)</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : '💾 Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kelola Akun & Anggota Modal */}
      {isMembersModalOpen && selectedInst && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-800">👤 Kelola Akun &amp; Anggota Lembaga</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedInst.name}</p>
              </div>
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Form Tambah Member */}
              <form onSubmit={handleAddMember} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">➕ Tambah Akun Baru (Operator / Kepsek)</h4>
                
                {memberError && (
                  <div className="p-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-semibold">
                    ⚠️ {memberError}
                  </div>
                )}
                {memberSuccess && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-semibold">
                    🎉 {memberSuccess}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Email Pengguna</label>
                    <input
                      type="email"
                      required
                      value={memberForm.email}
                      onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                      placeholder="e.g. operator@sekolah.sch.id"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      value={memberForm.name}
                      onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                      placeholder="e.g. Operator IT / Nama Lengkap"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Nomor WhatsApp</label>
                    <input
                      type="tel"
                      value={memberForm.whatsapp}
                      onChange={(e) => setMemberForm({ ...memberForm, whatsapp: e.target.value })}
                      placeholder="e.g. 08xxxxxxxx"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Password Default</label>
                    <input
                      type="text"
                      required
                      value={memberForm.password}
                      onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Peran di Lembaga</label>
                    <select
                      value={memberForm.role}
                      onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold outline-none bg-white"
                    >
                      <option value="operator">🛠️ Operator</option>
                      <option value="kepala_sekolah">🎓 Kepala Sekolah</option>
                      <option value="wakasek">👥 Wakasek</option>
                      <option value="guru">🧑‍🏫 Guru</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={memberSaving}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    {memberSaving ? 'Memproses...' : '💾 Buat Akun & Hubungkan'}
                  </button>
                </div>
              </form>

              {/* List Members */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">👥 Daftar Anggota / Akun Sekolah</h4>
                
                {membersLoading ? (
                  <div className="text-center py-6 text-slate-400 text-xs">Memuat daftar anggota...</div>
                ) : members.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">Belum ada akun terhubung untuk lembaga ini.</div>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[250px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2">Nama / Kontak</th>
                          <th className="px-4 py-2">Email</th>
                          <th className="px-4 py-2">WhatsApp</th>
                          <th className="px-4 py-2">Peran</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {members.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-bold text-slate-800">{m.name}</td>
                            <td className="px-4 py-2.5 text-slate-600 font-mono">{m.email}</td>
                            <td className="px-4 py-2.5 text-slate-600">{m.whatsapp || '-'}</td>
                            <td className="px-4 py-2.5">
                              {m.roles?.map((r: string) => (
                                <span key={r} className="inline-block bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] font-semibold mr-1 uppercase">
                                  {r.replace('_', ' ')}
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
