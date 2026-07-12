'use client';

import { useEffect, useState } from 'react';

interface Registration {
  id: string;
  nama_lembaga: string;
  npsn: string | null;
  jenjang: string;
  naungan: string;
  alamat: string | null;
  nama_kepala_sekolah: string | null;
  email_kontak: string;
  whatsapp: string | null;
  status: string;
  catatan_admin: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Menunggu', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  approved: { label: 'Disetujui', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  rejected: { label: 'Ditolak', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  contacted: { label: 'Dihubungi', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
};

export default function SchoolRegistrationsManager() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [catatanAdmin, setCatatanAdmin] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/school-registrations');
      if (!res.ok) throw new Error('Gagal memuat data');
      const data = await res.json();
      setRegistrations(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal memuat data pendaftaran' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const handleUpdate = async () => {
    if (!selectedReg) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/school-registrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedReg.id,
          status: newStatus,
          catatan_admin: catatanAdmin,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memperbarui');
      }
      setMessage({ type: 'success', text: 'Status pendaftaran berhasil diperbarui!' });
      setSelectedReg(null);
      fetchRegistrations();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus pendaftaran ini?')) return;
    try {
      const res = await fetch('/api/admin/school-registrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      setMessage({ type: 'success', text: 'Pendaftaran berhasil dihapus' });
      fetchRegistrations();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const filtered = registrations.filter((r) => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.nama_lembaga.toLowerCase().includes(q) ||
      r.email_kontak.toLowerCase().includes(q) ||
      (r.npsn && r.npsn.toLowerCase().includes(q)) ||
      (r.whatsapp && r.whatsapp.includes(q));
    return matchStatus && matchSearch;
  });

  const pendingCount = registrations.filter((r) => r.status === 'pending').length;

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/30 border border-indigo-100 rounded-2xl p-5">
          <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Total Pendaftaran</span>
          <span className="text-2xl font-black text-slate-800 block mt-1">{registrations.length}</span>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/30 border border-amber-100 rounded-2xl p-5">
          <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Menunggu Review</span>
          <span className="text-2xl font-black text-slate-800 block mt-1">{pendingCount}</span>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 border border-emerald-100 rounded-2xl p-5">
          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Disetujui</span>
          <span className="text-2xl font-black text-slate-800 block mt-1">
            {registrations.filter((r) => r.status === 'approved').length}
          </span>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/30 border border-blue-100 rounded-2xl p-5">
          <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Dihubungi</span>
          <span className="text-2xl font-black text-slate-800 block mt-1">
            {registrations.filter((r) => r.status === 'contacted').length}
          </span>
        </div>
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

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {['all', 'pending', 'contacted', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                filterStatus === s
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s === 'all' ? 'Semua' : STATUS_CONFIG[s]?.label || s}
              {s === 'pending' && pendingCount > 0 && (
                <span className="ml-1 bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[9px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama lembaga, email, NPSN..."
          className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-white font-medium text-slate-800 flex-1 sm:max-w-xs"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Memuat data...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          {search || filterStatus !== 'all' ? 'Tidak ada data yang cocok' : 'Belum ada pendaftaran masuk'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Lembaga</th>
                <th className="px-4 py-3">Jenjang</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((reg) => {
                const sc = STATUS_CONFIG[reg.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={reg.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <div className="text-xs font-bold text-slate-800">{reg.nama_lembaga}</div>
                      {reg.npsn && <div className="text-[10px] text-slate-400 mt-0.5">NPSN: {reg.npsn}</div>}
                      {reg.alamat && (
                        <div className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate">{reg.alamat}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-600">{reg.jenjang}</div>
                      <div className="text-[10px] text-slate-400">{reg.naungan}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-700">{reg.email_kontak}</div>
                      {reg.whatsapp && <div className="text-[10px] text-slate-400">{reg.whatsapp}</div>}
                      {reg.nama_kepala_sekolah && (
                        <div className="text-[10px] text-slate-400">KS: {reg.nama_kepala_sekolah}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border ${sc.bg} ${sc.color}`}>
                        {sc.label}
                      </span>
                      {reg.catatan_admin && (
                        <div className="text-[10px] text-slate-400 mt-1 max-w-[150px] truncate" title={reg.catatan_admin}>
                          📝 {reg.catatan_admin}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDate(reg.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button
                          onClick={() => {
                            setSelectedReg(reg);
                            setNewStatus(reg.status);
                            setCatatanAdmin(reg.catatan_admin || '');
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition cursor-pointer"
                        >
                          ✏️ Review
                        </button>
                        <button
                          onClick={() => handleDelete(reg.id)}
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

      {/* Detail / Review Modal */}
      {selectedReg && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800">Review Pendaftaran</h3>
              <p className="text-xs text-slate-400 mt-0.5">{selectedReg.nama_lembaga}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Nama Lembaga</span>
                  <span className="text-slate-800 font-bold">{selectedReg.nama_lembaga}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">NPSN</span>
                  <span className="text-slate-800 font-bold">{selectedReg.npsn || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Jenjang</span>
                  <span className="text-slate-800 font-bold">{selectedReg.jenjang}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Naungan</span>
                  <span className="text-slate-800 font-bold">{selectedReg.naungan}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Alamat</span>
                  <span className="text-slate-800 font-bold">{selectedReg.alamat || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Kepala Sekolah</span>
                  <span className="text-slate-800 font-bold">{selectedReg.nama_kepala_sekolah || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Email</span>
                  <span className="text-slate-800 font-bold">{selectedReg.email_kontak}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">WhatsApp</span>
                  <span className="text-slate-800 font-bold">{selectedReg.whatsapp || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Tanggal Daftar</span>
                  <span className="text-slate-800 font-bold">{formatDate(selectedReg.created_at)}</span>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Update Status */}
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5">Ubah Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                >
                  <option value="pending">⏳ Menunggu</option>
                  <option value="contacted">📞 Dihubungi</option>
                  <option value="approved">✅ Disetujui</option>
                  <option value="rejected">❌ Ditolak</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5">Catatan Admin</label>
                <textarea
                  value={catatanAdmin}
                  onChange={(e) => setCatatanAdmin(e.target.value)}
                  placeholder="Tambahkan catatan internal..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-2 justify-end">
              <button
                onClick={() => setSelectedReg(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
