'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  dikirim_ke_wali_kelas: 'Dikirim ke Wali Kelas',
  dikonfirmasi: 'Dikonfirmasi',
  difinalisasi: 'Difinalisasi',
  siap_print: 'Siap Print',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  dikirim_ke_wali_kelas: 'bg-blue-100 text-blue-700',
  dikonfirmasi: 'bg-yellow-100 text-yellow-700',
  difinalisasi: 'bg-green-100 text-green-700',
  siap_print: 'bg-emerald-100 text-emerald-700',
};

const NEXT_STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  draft: [{ value: 'dikirim_ke_wali_kelas', label: 'Kirim ke Wali Kelas' }],
  dikirim_ke_wali_kelas: [
    { value: 'dikonfirmasi', label: 'Konfirmasi' },
    { value: 'draft', label: 'Kembalikan ke Draft' },
  ],
  dikonfirmasi: [
    { value: 'difinalisasi', label: 'Finalisasi' },
    { value: 'dikirim_ke_wali_kelas', label: 'Kembalikan' },
  ],
  difinalisasi: [{ value: 'siap_print', label: 'Tandai Siap Print' }],
  siap_print: [],
};

interface RaportStatus {
  id: string;
  siswa_id: string;
  nama_siswa: string;
  nisn: string;
  kelas_id: string;
  nama_kelas: string;
  periode: string;
  jenis_laporan: string;
  status: string;
  sikap_id: string | null;
  catatan_wali_kelas: string | null;
  presensi_snapshot: any;
  nama_template: string;
  mode_nilai_akademik: string;
  created_at: string;
  updated_at: string;
  status_history?: Array<{
    status: string;
    changed_at: string;
    changed_by: string;
    changed_by_role: string;
    changed_by_nama: string;
  }>;
}

interface ClassOption {
  id: string;
  nama_kelas: string;
}

export default function RaportStatusPage() {
  const router = useRouter();

  const [raports, setRaports] = useState<RaportStatus[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [selectedPeriode, setSelectedPeriode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [schoolId, setSchoolId] = useState<string>('');
  const [showSchoolSelector, setShowSchoolSelector] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check authentication and initialize
  useEffect(() => {
    async function initialize() {
      // First, try to use cached schools data for fast initial render
      const cachedSchools = sessionStorage.getItem('gurupro_schools_cache');
      if (cachedSchools) {
        try {
          const parsed = JSON.parse(cachedSchools);
          setSchools(parsed);
          const savedSchoolId = sessionStorage.getItem('gurupro_school_selected');
          if (savedSchoolId && parsed.some((s: any) => s.id === savedSchoolId)) {
            setSchoolId(savedSchoolId);
          } else if (parsed.length === 1) {
            setSchoolId(parsed[0].id);
            sessionStorage.setItem('gurupro_school_selected', parsed[0].id);
          } else if (parsed.length > 1) {
            setShowSchoolSelector(true);
          }
        } catch {
          // Invalid cache, continue with API fetch
        }
      }

      try {
        const res = await fetch('/api/schools');
        const data = await res.json();

        if (!res.ok || !Array.isArray(data)) {
          router.push('/login');
          return;
        }

        // Update cache
        sessionStorage.setItem('gurupro_schools_cache', JSON.stringify(data));
        setSchools(data);

        const savedSchoolId = sessionStorage.getItem('gurupro_school_selected');

        if (savedSchoolId && data.some((s: any) => s.id === savedSchoolId)) {
          setSchoolId(savedSchoolId);
          setShowSchoolSelector(false);
        } else if (data.length === 1) {
          setSchoolId(data[0].id);
          sessionStorage.setItem('gurupro_school_selected', data[0].id);
          setShowSchoolSelector(false);
        } else if (data.length > 1) {
          setShowSchoolSelector(true);
        } else {
          setShowSchoolSelector(true);
        }

        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize:', err);
        // If we have cached data, show it
        if (cachedSchools) {
          setIsInitialized(true);
        } else {
          router.push('/login');
        }
      }
    }

    initialize();
  }, [isInitialized, router]);

  // Fetch user's classes when schoolId changes (only after initialization complete)
  useEffect(() => {
    if (schoolId && isInitialized) {
      fetchClasses();
    }
  }, [schoolId, isInitialized]);

  const handleSelectSchool = (newSchoolId: string) => {
    setSchoolId(newSchoolId);
    sessionStorage.setItem('gurupro_school_selected', newSchoolId);
    setShowSchoolSelector(false);
  };

  const fetchClasses = async () => {
    if (!schoolId) return;

    try {
      const res = await fetch(`/api/classes?school_id=${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
        if (data.length > 0 && !selectedKelas) {
          setSelectedKelas(data[0].id);
        }
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal memuat daftar kelas');
      }
    } catch (err) {
      console.error('Failed to fetch classes:', err);
      setError('Gagal memuat daftar kelas');
    }
  };

  // Fetch raport status when kelas/periode changes
  useEffect(() => {
    if (selectedKelas) {
      fetchRaportStatus();
    }
  }, [selectedKelas, selectedPeriode]);

  const fetchRaportStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ kelas_id: selectedKelas, include_history: 'true' });
      if (selectedPeriode) {
        params.append('periode', selectedPeriode);
      }

      const res = await fetch(`/api/raport/status?${params}`);
      if (!res.ok) {
        throw new Error('Failed to fetch raport status');
      }
      const data = await res.json();
      setRaports(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (raportId: string, newStatus: string) => {
    if (!confirm(`Yakin ingin mengubah status raport ini ke "${STATUS_LABELS[newStatus]}"?`)) {
      return;
    }

    setUpdating(raportId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/raport/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_raport_id: raportId,
          new_status: newStatus,
          changed_by_role: 'wali_kelas',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengubah status');
      }

      setSuccess(`Status raport berhasil diubah ke "${STATUS_LABELS[newStatus]}"`);
      fetchRaportStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const toggleHistory = (raportId: string) => {
    const newExpanded = new Set(expandedHistory);
    if (newExpanded.has(raportId)) {
      newExpanded.delete(raportId);
    } else {
      newExpanded.add(raportId);
    }
    setExpandedHistory(newExpanded);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  // School Selector Modal - only show after initialization
  if (showSchoolSelector && schools.length > 0 && isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full mx-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Pilih Sekolah</h2>
          <p className="text-gray-600 text-center mb-6">Anda memiliki akses ke {schools.length} sekolah. Silakan pilih salah satu.</p>
          <div className="space-y-3">
            {schools.map((school) => (
              <button
                key={school.id}
                onClick={() => handleSelectSchool(school.id)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  school.id === schoolId
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-semibold text-gray-900">{school.nama_sekolah}</div>
                <div className="text-sm text-gray-500">{school.jenjang} - {school.npsn}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Status Raport Siswa</h1>
        <p className="text-gray-600 mt-1">Pantau dan kelola status raport per siswa</p>
      </div>

      {/* Header with school info */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Status Raport Siswa</h1>
            <p className="text-gray-600 mt-1">Pantau dan kelola status raport per siswa</p>
          </div>
          {schools.length > 1 && (
            <button
              onClick={() => setShowSchoolSelector(true)}
              className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium flex items-center gap-2"
            >
              <span>{schools.find(s => s.id === schoolId)?.nama_sekolah || 'Pilih Sekolah'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pilih Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nama_kelas}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Periode</label>
            <select
              value={selectedPeriode}
              onChange={(e) => setSelectedPeriode(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Periode</option>
              <option value="TS-2025/2026-Ganjil">TS - 2025/2026 Ganjil</option>
              <option value="AS-2025/2026-Ganjil">AS - 2025/2026 Ganjil</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchRaportStatus}
              disabled={loading || !selectedKelas}
              className="w-full bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memuat...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      {/* Raport List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data raport...</p>
        </div>
      ) : raports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">Tidak ada raport untuk kelas dan periode yang dipilih.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {raports.map((raport) => {
            const nextOptions = NEXT_STATUS_OPTIONS[raport.status] || [];
            const isExpanded = expandedHistory.has(raport.id);

            return (
              <div key={raport.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">{raport.nama_siswa}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[raport.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[raport.status] || raport.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {raport.nisn} • {raport.nama_kelas} • {raport.nama_template}
                      </p>
                      <p className="text-sm text-gray-500">
                        {raport.periode} • {(raport.jenis_laporan || '').replace(/_/g, ' ')}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {nextOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleStatusChange(raport.id, opt.value)}
                          disabled={updating === raport.id}
                          className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updating === raport.id ? 'Memproses...' : opt.label}
                        </button>
                      ))}

                      {raport.status_history && raport.status_history.length > 0 && (
                        <button
                          onClick={() => toggleHistory(raport.id)}
                          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          {isExpanded ? 'Sembunyikan' : 'Riwayat'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Validation Status */}
                <div className="px-4 py-3 bg-gray-50">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${raport.sikap_id ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span>Sikap: {raport.sikap_id ? 'Terisi' : 'Belum'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${raport.catatan_wali_kelas ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span>Catatan WK: {raport.catatan_wali_kelas ? 'Terisi' : 'Belum'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${raport.presensi_snapshot ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      <span>Presensi: {raport.presensi_snapshot ? `S${raport.presensi_snapshot.sakit ?? 0} I${raport.presensi_snapshot.izin ?? 0} A${raport.presensi_snapshot.alpa ?? 0}` : 'Auto saat finalisasi'}</span>
                    </div>
                  </div>
                </div>

                {/* Status History */}
                {isExpanded && raport.status_history && raport.status_history.length > 0 && (
                  <div className="px-4 py-3 bg-gray-100 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Riwayat Status</h4>
                    <div className="space-y-2">
                      {raport.status_history.map((h, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[h.status] || 'bg-gray-100 text-gray-700'}`}>
                            {STATUS_LABELS[h.status] || h.status}
                          </span>
                          <span className="text-gray-500">{formatDate(h.changed_at)}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-600">{h.changed_by_nama || h.changed_by || 'System'}</span>
                          {h.changed_by_role && (
                            <span className="text-gray-400">({h.changed_by_role.replace('_', ' ')})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Alur Status Raport</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">Draft</span>
          <span className="text-gray-400">→</span>
          <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">Dikirim ke WK</span>
          <span className="text-gray-400">→</span>
          <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700">Dikonfirmasi</span>
          <span className="text-gray-400">→</span>
          <span className="px-2 py-1 rounded bg-green-100 text-green-700">Difinalisasi</span>
          <span className="text-gray-400">→</span>
          <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700">Siap Print</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          * Status tidak bisa dilompati atau mundur tanpa alasan valid.
          ** Perubahan nilai setelah dikonfirmasi/difinalisasi akan memicu notifikasi ke Wali Kelas.
        </p>
      </div>
    </div>
  );
}
