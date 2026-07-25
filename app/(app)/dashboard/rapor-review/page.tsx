'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback, startTransition, Suspense } from 'react';
import { useRouter } from 'next/navigation';

interface RaportNilaiMapel {
  id: string;
  data_raport_id: string;
  mapel_id: string;
  guru_mapel_member_id: string;
  nilai_akhir: number | null;
  kkm: number | null;
  deskripsi_capaian: string;
  deskripsi_sumber_ai: boolean;
  deskripsi_dibuka_untuk_review: boolean;
  dikonfirmasi_guru: boolean;
  nama_mapel: string;
  guru_user_id?: string;
  guru_nama?: string;
}

interface RaportData {
  id: string;
  siswa_id: string;
  nama_siswa: string;
  nisn: string;
  kelas_id: string;
  nama_kelas: string;
  periode: string;
  jenis_laporan: string;
  status: string;
  nama_template: string;
  mode_nilai_akademik: string;
  basis_deskripsi: string;
  kurikulum: string;
  nilai_mapel: RaportNilaiMapel[];
}

interface ClassOption {
  id: string;
  nama_kelas: string;
}

interface SchoolOption {
  id: string;
  nama_sekolah: string;
  jenjang: string;
  npsn: string;
}

function RapotReviewContent() {
  const router = useRouter();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [raports, setRaports] = useState<RaportData[]>([]);
  const [selectedRaport, setSelectedRaport] = useState<RaportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatingMapelId, setGeneratingMapelId] = useState<string | null>(null);
  const [generatingSiswaId, setGeneratingSiswaId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [guruMapelMemberId, setGuruMapelMemberId] = useState<string>('');
  const [kurikulum, setKurikulum] = useState('kurikulum_merdeka');
  const [capaianPembelajaranText, setCapaianPembelajaranText] = useState('');
  const [basisDeskripsi, setBasisDeskripsi] = useState<'capaian_pembelajaran' | 'alur_tujuan_pembelajaran' | 'poin_materi'>('capaian_pembelajaran');
  const [catatanTambahan, setCatatanTambahan] = useState('');
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTargetMapelId, setAiTargetMapelId] = useState<string>('');
  const [aiTargetSiswaId, setAiTargetSiswaId] = useState<string>('');
  const [aiTargetNilai, setAiTargetNilai] = useState<number | null>(null);

  // Multi-school support
  const [schoolId, setSchoolId] = useState<string>('');
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [showSchoolSelector, setShowSchoolSelector] = useState(false);
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
        const res = await apiFetch('/api/schools');
        const data = await res.json();

        if (!res.ok || !Array.isArray(data)) {
          startTransition(() => router.push('/login'));
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
        if (cachedSchools) {
          setIsInitialized(true);
        } else {
          router.push('/login');
        }
      }
    }

    initialize();
  }, [isInitialized, router]);

  const handleSelectSchool = (newSchoolId: string) => {
    setSchoolId(newSchoolId);
    sessionStorage.setItem('gurupro_school_selected', newSchoolId);
    setShowSchoolSelector(false);
    setSelectedKelas('');
    setClasses([]);
  };

  // Fetch data when schoolId changes
  useEffect(() => {
    if (schoolId && isInitialized) {
      fetchClasses();
      fetchGuruMemberId();
    }
  }, [schoolId, isInitialized]);

  const fetchClasses = async () => {
    if (!schoolId) return;

    try {
      const res = await apiFetch(`/api/classes?school_id=${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
        if (data.length > 0 && !selectedKelas) {
          setSelectedKelas(data[0].id);
        } else if (data.length === 0) {
          setSelectedKelas('');
        }
      }
    } catch (err) {
      console.error('Failed to fetch classes:', err);
    }
  };

  const fetchGuruMemberId = async () => {
    try {
      const res = await apiFetch('/api/raport/guru-member-id');
      if (res.ok) {
        const data = await res.json();
        if (data.guru_mapel_member_id) {
          setGuruMapelMemberId(data.guru_mapel_member_id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch guru member id:', err);
    }
  };

  const fetchRaports = useCallback(async () => {
    if (!selectedKelas) return;
    setLoading(true);
    setError(null);
    setSelectedRaport(null);

    try {
      const res = await apiFetch(`/api/raport/review?kelas_id=${selectedKelas}`);
      if (!res.ok) throw new Error('Gagal memuat data raport');
      const data = await res.json();
      setRaports(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedKelas]);

  useEffect(() => {
    fetchRaports();
  }, [fetchRaports]);

  const handleOpenReview = async (raport: RaportData) => {
    setSelectedRaport(raport);
    setSuccess(null);
    setError(null);

    const mapelToOpen = raport.nilai_mapel.filter(nm => !nm.deskripsi_dibuka_untuk_review);
    if (mapelToOpen.length > 0) {
      try {
        const promises = mapelToOpen.map(nm =>
          apiFetch('/api/raport/nilai-mapel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data_raport_id: raport.id,
              mapel_id: nm.mapel_id,
              guru_mapel_member_id: nm.guru_mapel_member_id || guruMapelMemberId,
              deskripsi_dibuka_untuk_review: true,
            }),
          })
        );
        await Promise.all(promises);
        await fetchRaports();
      } catch (err) {
        console.error('Failed to open review:', err);
      }
    }
  };

  const handleGenerateAI = async (mapelId: string, siswaId: string, nilaiAkhir: number | null) => {
    if (!guruMapelMemberId) {
      setError('Data guru belum tersedia. Silakan refresh halaman.');
      return;
    }

    setGeneratingMapelId(mapelId);
    setGeneratingSiswaId(siswaId);
    setError(null);

    try {
      const res = await apiFetch('/api/raport/generate-deskripsi-capaian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswaId,
          mapelId,
          kelasId: selectedKelas,
          guruMapelMemberId,
          kurikulum: selectedRaport?.kurikulum || kurikulum,
          basisDeskripsi,
          capaianPembelajaranText,
          nilaiAkhir,
          catatanTambahanGuru: catatanTambahan || undefined,
          modeNaratif: selectedRaport?.mode_nilai_akademik === 'naratif_saja',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal generate AI');

      if (selectedRaport) {
        const updatedMapel = selectedRaport.nilai_mapel.map(nm =>
          nm.mapel_id === mapelId
            ? { ...nm, deskripsi_capaian: data.deskripsi, deskripsi_sumber_ai: true }
            : nm
        );
        setSelectedRaport({ ...selectedRaport, nilai_mapel: updatedMapel });

        await apiFetch('/api/raport/nilai-mapel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data_raport_id: selectedRaport.id,
            mapel_id: mapelId,
            guru_mapel_member_id: guruMapelMemberId,
            deskripsi_capaian: data.deskripsi,
            deskripsi_sumber_ai: true,
          }),
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingMapelId(null);
      setGeneratingSiswaId(null);
      setShowAIModal(false);
    }
  };

  const handleSaveDeskripsi = async (mapelId: string, deskripsi: string) => {
    if (!selectedRaport) return;
    setSaving(mapelId);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch('/api/raport/nilai-mapel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_raport_id: selectedRaport.id,
          mapel_id: mapelId,
          guru_mapel_member_id: guruMapelMemberId,
          deskripsi_capaian: deskripsi,
        }),
      });

      if (!res.ok) throw new Error('Gagal menyimpan deskripsi');
      setSuccess('Deskripsi berhasil disimpan');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleToggleKonfirmasi = async (mapelId: string, current: boolean) => {
    if (!selectedRaport) return;
    setSaving(mapelId);
    setError(null);

    try {
      const res = await apiFetch('/api/raport/nilai-mapel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_raport_id: selectedRaport.id,
          mapel_id: mapelId,
          guru_mapel_member_id: guruMapelMemberId,
          dikonfirmasi_guru: !current,
        }),
      });

      if (!res.ok) throw new Error('Gagal mengubah status konfirmasi');

      const updatedMapel = selectedRaport.nilai_mapel.map(nm =>
        nm.mapel_id === mapelId ? { ...nm, dikonfirmasi_guru: !current } : nm
      );
      setSelectedRaport({ ...selectedRaport, nilai_mapel: updatedMapel });
      setSuccess(!current ? 'Nilai mapel dikonfirmasi' : 'Konfirmasi dibatalkan');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDeskripsiChange = (mapelId: string, value: string) => {
    if (!selectedRaport) return;
    const updatedMapel = selectedRaport.nilai_mapel.map(nm =>
      nm.mapel_id === mapelId ? { ...nm, deskripsi_capaian: value } : nm
    );
    setSelectedRaport({ ...selectedRaport, nilai_mapel: updatedMapel });
  };

  const openAIModal = (mapelId: string, siswaId: string, nilaiAkhir: number | null) => {
    setAiTargetMapelId(mapelId);
    setAiTargetSiswaId(siswaId);
    setAiTargetNilai(nilaiAkhir);
    setCapaianPembelajaranText('');
    setCatatanTambahan('');
    setBasisDeskripsi(selectedRaport?.basis_deskripsi as any || 'capaian_pembelajaran');
    setKurikulum(selectedRaport?.kurikulum || 'kurikulum_merdeka');
    setShowAIModal(true);
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
      {/* Header with school info */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review Nilai Raport</h1>
            <p className="text-gray-600 mt-1">Review, edit, dan konfirmasi deskripsi capaian per mata pelajaran</p>
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

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!schoolId}
            >
              <option value="">Pilih Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nama_kelas}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchRaports}
              disabled={loading || !selectedKelas}
              className="w-full bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Memuat...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">{success}</div>
      )}

      {!selectedRaport ? (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-gray-600">Memuat data raport...</p>
            </div>
          ) : raports.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">Tidak ada raport untuk kelas ini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {raports.map((raport) => (
                <div key={raport.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition cursor-pointer"
                     onClick={() => handleOpenReview(raport)}>
                  <h3 className="font-semibold text-gray-900">{raport.nama_siswa}</h3>
                  <p className="text-sm text-gray-500">{raport.nisn} • {raport.nama_kelas}</p>
                  <p className="text-sm text-gray-500">{raport.periode}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      raport.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                      raport.status === 'dikirim_ke_wali_kelas' ? 'bg-blue-100 text-blue-700' :
                      raport.status === 'dikonfirmasi' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>{raport.status.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-400">
                      {raport.nilai_mapel.filter(nm => nm.dikonfirmasi_guru).length}/{raport.nilai_mapel.length} dikonfirmasi
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <button
                onClick={() => setSelectedRaport(null)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                &larr; Kembali
              </button>
              <h2 className="text-xl font-bold text-gray-900 mt-1">{selectedRaport.nama_siswa}</h2>
              <p className="text-sm text-gray-500">{selectedRaport.nama_kelas} • {selectedRaport.periode}</p>
            </div>
            <div className="text-xs text-gray-400">
              {selectedRaport.nilai_mapel.filter(nm => nm.dikonfirmasi_guru).length} / {selectedRaport.nilai_mapel.length} dikonfirmasi
              &nbsp;•&nbsp;
              {selectedRaport.nilai_mapel.filter(nm => nm.deskripsi_dibuka_untuk_review).length} / {selectedRaport.nilai_mapel.length} dibuka review
            </div>
          </div>

          <div className="space-y-6">
            {selectedRaport.nilai_mapel.map((nm) => (
              <div key={nm.mapel_id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{nm.nama_mapel}</h3>
                    <span className="text-sm text-gray-500">
                      Nilai: {nm.nilai_akhir !== null ? nm.nilai_akhir : '-'}
                      {nm.kkm !== null ? ` / KKM: ${nm.kkm}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {nm.deskripsi_sumber_ai && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        AI
                      </span>
                    )}
                    {nm.deskripsi_dibuka_untuk_review ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Dibuka
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Belum dibuka
                      </span>
                    )}
                    {nm.dikonfirmasi_guru ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        Dikonfirmasi
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Belum
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <textarea
                    rows={3}
                    value={nm.deskripsi_capaian}
                    onChange={(e) => handleDeskripsiChange(nm.mapel_id, e.target.value)}
                    placeholder="Tulis deskripsi capaian atau generate via AI..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openAIModal(nm.mapel_id, selectedRaport.siswa_id, nm.nilai_akhir)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transition font-medium"
                      >
                        {generatingMapelId === nm.mapel_id ? 'Memproses...' : 'Rancang draf via AI'}
                      </button>
                      <button
                        onClick={() => handleSaveDeskripsi(nm.mapel_id, nm.deskripsi_capaian)}
                        disabled={saving === nm.mapel_id}
                        className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition font-medium"
                      >
                        {saving === nm.mapel_id ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>

                    <button
                      onClick={() => handleToggleKonfirmasi(nm.mapel_id, nm.dikonfirmasi_guru)}
                      disabled={saving === nm.mapel_id}
                      className={`px-3 py-1.5 text-sm rounded-lg transition font-medium ${
                        nm.dikonfirmasi_guru
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      } disabled:opacity-50`}
                    >
                      {nm.dikonfirmasi_guru ? 'Batalkan Konfirmasi' : 'Konfirmasi'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAIModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
             onClick={() => setShowAIModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between rounded-t-3xl">
              <div>
                <h3 className="font-bold text-slate-800">Rancang Draf Deskripsi via AI</h3>
              </div>
              <button
                onClick={() => setShowAIModal(false)}
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-500 transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kurikulum</label>
                <select
                  value={kurikulum}
                  onChange={(e) => setKurikulum(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="kurikulum_merdeka">Kurikulum Merdeka</option>
                  <option value="k13">K13</option>
                  <option value="kbc">KBC (Kurikulum Berbasis Cinta)</option>
                  <option value="hybrid">Hybrid (K13 + Merdeka)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Basis Deskripsi</label>
                <select
                  value={basisDeskripsi}
                  onChange={(e) => setBasisDeskripsi(e.target.value as any)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="capaian_pembelajaran">Capaian Pembelajaran</option>
                  <option value="alur_tujuan_pembelajaran">Alur Tujuan Pembelajaran</option>
                  <option value="poin_materi">Poin Materi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capaian Pembelajaran / Materi</label>
                <textarea
                  rows={4}
                  value={capaianPembelajaranText}
                  onChange={(e) => setCapaianPembelajaranText(e.target.value)}
                  placeholder="Masukkan Capaian Pembelajaran, ATP, atau poin materi..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Tambahan (opsional)</label>
                <textarea
                  rows={2}
                  value={catatanTambahan}
                  onChange={(e) => setCatatanTambahan(e.target.value)}
                  placeholder="Catatan guru untuk AI..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAIModal(false)}
                  className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleGenerateAI(aiTargetMapelId, aiTargetSiswaId, aiTargetNilai)}
                  disabled={!capaianPembelajaranText.trim() || generatingSiswaId === aiTargetSiswaId}
                  className="flex-1 px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition font-medium"
                >
                  {generatingSiswaId === aiTargetSiswaId ? 'AI Memproses...' : 'Generate Draf'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RapotReviewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RapotReviewContent />
    </Suspense>
  );
}
