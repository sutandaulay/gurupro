'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LayoutBuilder from '@/components/raport/LayoutBuilder';
import type { LayoutSection } from '@/lib/raport/schemas';

// Helper functions for formatting display values
const JENJANG_LABELS: Record<string, string> = {
  'paud': 'PAUD/RA',
  'sd_mi': 'SD/MI',
  'smp_mts': 'SMP/MTs',
  'sma_ma': 'SMA/MA',
  'smk_mak': 'SMK/MAK',
};

const KURIKULUM_LABELS: Record<string, string> = {
  'kurikulum_merdeka': 'Kurikulum Merdeka',
  'k13': 'K13',
  'kbc': 'KBC (Kurikulum Berbasis Cinta)',
  'hybrid': 'Hybrid (K13 + Merdeka)',
};

const JALUR_LABELS: Record<string, string> = {
  'kemendikdasmen': 'Kemendikdasmen',
  'kemenag': 'Kemenag (Madrasah)',
};

const formatJenjang = (val: string) => JENJANG_LABELS[val] || val;
const formatKurikulum = (val: string) => KURIKULUM_LABELS[val] || val;

interface TemplateOption {
  id: string;
  nama_template: string;
  jenjang: string;
  kurikulum: string;
  jenis_laporan: string;
}

interface LayoutRecord {
  id: string;
  templateRaportId: string;
  sekolahId: string;
  namaLayout: string;
  sections: LayoutSection[];
  lastEditedAt: string;
  namaTemplate?: string;
}

interface SchoolOption {
  id: string;
  nama_sekolah: string;
  jenjang: string;
  npsn: string;
}

export default function LayoutRaportPage() {
  const router = useRouter();

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [layouts, setLayouts] = useState<LayoutRecord[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<LayoutRecord | null>(null);
  const [sekolahId, setSekolahId] = useState<string>('');
  const [memberId, setMemberId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [layoutName, setLayoutName] = useState('');

  // Multi-school support
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolId, setSchoolId] = useState<string>('');
  const [showSchoolSelector, setShowSchoolSelector] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Create template modal
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    nama_template: '',
    jenjang: 'smp_mts',
    kurikulum: 'kurikulum_merdeka',
    jenis_laporan: 'akhir_semester',
    mode_nilai_akademik: 'angka_kkm',
    basis_deskripsi: 'capaian_pembelajaran',
    jalur_regulasi: 'kemendikdasmen',
    varian_sikap: 'profil_pelajar_pancasila',
  });

  const updateKurikulum = (value: string) => {
    const updates: any = { kurikulum: value };
    if (value === 'kbc') {
      updates.jalur_regulasi = 'kemenag';
      updates.varian_sikap = 'profil_rahmatan_lil_alamin';
    } else if (value === 'hybrid') {
      updates.jalur_regulasi = 'kemendikdasmen';
      updates.varian_sikap = 'profil_pelajar_pancasila';
    } else if (value === 'kurikulum_merdeka') {
      updates.jalur_regulasi = 'kemendikdasmen';
      updates.varian_sikap = 'profil_pelajar_pancasila';
    } else {
      updates.jalur_regulasi = 'kemendikdasmen';
      updates.varian_sikap = 'profil_pelajar_pancasila';
    }
    setNewTemplate(prev => ({ ...prev, ...updates }));
  };
  const [creatingTemplate, setCreatingTemplate] = useState(false);

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
            setSekolahId(savedSchoolId);
          } else if (parsed.length === 1) {
            setSchoolId(parsed[0].id);
            setSekolahId(parsed[0].id);
            sessionStorage.setItem('gurupro_school_selected', parsed[0].id);
          } else if (parsed.length > 1) {
            setShowSchoolSelector(true);
          }
        } catch {
          // Invalid cache, continue with API fetch
        }
      }

      try {
        const [memberRes, schoolRes] = await Promise.all([
          fetch('/api/raport/guru-member-id'),
          fetch('/api/schools'),
        ]);

        if (!schoolRes.ok) {
          router.push('/login');
          return;
        }

        const schoolData = await schoolRes.json();
        if (!Array.isArray(schoolData)) {
          router.push('/login');
          return;
        }

        // Update cache
        sessionStorage.setItem('gurupro_schools_cache', JSON.stringify(schoolData));

        if (memberRes.ok) {
          const memberData = await memberRes.json();
          if (memberData.guru_mapel_member_id) setMemberId(memberData.guru_mapel_member_id);
        }

        setSchools(schoolData);

        const savedSchoolId = sessionStorage.getItem('gurupro_school_selected');

        if (savedSchoolId && schoolData.some((s: any) => s.id === savedSchoolId)) {
          setSchoolId(savedSchoolId);
          setSekolahId(savedSchoolId);
          setShowSchoolSelector(false);
        } else if (schoolData.length === 1) {
          setSchoolId(schoolData[0].id);
          setSekolahId(schoolData[0].id);
          sessionStorage.setItem('gurupro_school_selected', schoolData[0].id);
          setShowSchoolSelector(false);
        } else if (schoolData.length > 1) {
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
    setSekolahId(newSchoolId);
    sessionStorage.setItem('gurupro_school_selected', newSchoolId);
    setShowSchoolSelector(false);
    setSelectedTemplateId('');
    setTemplates([]);
  };

  const fetchTemplatesAndLayouts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (schoolId) params.append('sekolah_id', schoolId);

      const tRes = await fetch(`/api/template-raport?${params}`);
      const text = await tRes.text();

      if (!tRes.ok) {
        console.error('Template API error:', tRes.status, text);
        setError(`Gagal memuat template: ${text || tRes.statusText}`);
        setTemplates([]);
      } else if (!text.trim()) {
        setTemplates([]);
      } else {
        const tData = JSON.parse(text);
        setTemplates(Array.isArray(tData) ? tData : []);
        if (Array.isArray(tData) && tData.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(tData[0].id);
        } else if (Array.isArray(tData) && tData.length === 0) {
          setSelectedTemplateId('');
        }
      }
    } catch (err: any) {
      console.error('Fetch templates error:', err);
      setError(err.message);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLayouts = useCallback(async () => {
    if (!selectedTemplateId) return;
    try {
      const res = await fetch(`/api/raport/layout?template_raport_id=${selectedTemplateId}`);
      if (res.ok) {
        const data = await res.json();
        setLayouts(data);
        setSelectedLayout(null);
        setLayoutName('');
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    fetchLayouts();
  }, [fetchLayouts]);

  // Load templates when school is initialized
  useEffect(() => {
    if (schoolId && isInitialized) {
      fetchTemplatesAndLayouts();
    }
  }, [schoolId, isInitialized]);

  const handleSelectLayout = (layout: LayoutRecord) => {
    setSelectedLayout(layout);
    setLayoutName(layout.namaLayout);
  };

  const handleSave = async (sections: LayoutSection[]) => {
    if (!selectedTemplateId || !sekolahId) {
      setError('Data belum lengkap. Pastikan Anda sudah login.');
      return;
    }

    if (!layoutName.trim()) {
      setError('Nama layout wajib diisi');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (selectedLayout) {
        const res = await fetch('/api/raport/layout', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedLayout.id,
            nama_layout: layoutName.trim(),
            sections,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal memperbarui layout');
        }

        setSuccess('Layout berhasil diperbarui!');
      } else {
        const res = await fetch('/api/raport/layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_raport_id: selectedTemplateId,
            sekolah_id: sekolahId,
            nama_layout: layoutName.trim(),
            sections,
            ...(memberId ? { created_by_wali_kelas_member_id: memberId } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal menyimpan layout');
        }

        setSuccess('Layout baru berhasil disimpan!');
      }

      await fetchLayouts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLayout = async (layoutId: string) => {
    if (!confirm('Hapus layout ini?')) return;

    try {
      const res = await fetch(`/api/raport/layout?id=${layoutId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus layout');
      }

      setSuccess('Layout berhasil dihapus!');
      await fetchLayouts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.nama_template.trim()) {
      setError('Nama template wajib diisi');
      return;
    }

    setCreatingTemplate(true);
    setError(null);

    try {
      const res = await fetch('/api/template-raport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTemplate,
          sekolah_id: schoolId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat template');
      }

      setSuccess('Template berhasil dibuat!');
      setShowCreateTemplate(false);
      setNewTemplate({
        nama_template: '',
        jenjang: 'smp_mts',
        kurikulum: 'kurikulum_merdeka',
        jenis_laporan: 'akhir_semester',
        mode_nilai_akademik: 'angka_kkm',
        basis_deskripsi: 'capaian_pembelajaran',
        jalur_regulasi: 'kemendikdasmen',
        varian_sikap: 'profil_pelajar_pancasila',
      });

      // Refresh templates list
      await fetchTemplatesAndLayouts();

      // Auto-select the new template
      if (data.id) {
        setSelectedTemplateId(data.id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingTemplate(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Memuat...</div>
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
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Header with school info */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Layout Builder Raport</h1>
            <p className="text-sm text-gray-500 mt-1">Atur layout dan section raport</p>
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

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          {success}
        </div>
      )}

      {/* Template selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Pilih Template Raport
              </label>
              <button
                onClick={() => setShowCreateTemplate(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Buat Baru
              </button>
            </div>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {templates.length === 0 && (
                <option value="">Tidak ada template tersedia</option>
              )}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nama_template} ({formatJenjang(t.jenjang)} - {formatKurikulum(t.kurikulum)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Layout
            </label>
            <input
              type="text"
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              placeholder="Misal: Layout Semester Ganjil 2025"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Layout Tersimpan
            </label>
            {layouts.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">
                Belum ada layout untuk template ini
              </p>
            ) : (
              <select
                value={selectedLayout?.id ?? ''}
                onChange={(e) => {
                  const layout = layouts.find((l) => l.id === e.target.value);
                  if (layout) handleSelectLayout(layout);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- Buat baru --</option>
                {layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.namaLayout}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Delete button for existing layouts */}
        {selectedLayout && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => handleDeleteLayout(selectedLayout.id)}
              className="text-xs text-red-600 hover:text-red-800 hover:underline"
            >
              Hapus layout ini
            </button>
          </div>
        )}
      </div>

      {/* Layout Builder */}
      {selectedTemplateId ? (
        <LayoutBuilder
          initialSections={selectedLayout?.sections ?? []}
          templateRaportId={selectedTemplateId}
          sekolahId={sekolahId}
          layoutId={selectedLayout?.id}
          onSave={handleSave}
          isSaving={isSaving}
        />
      ) : (
        <div className="text-center text-gray-400 py-12 bg-white border border-dashed border-gray-300 rounded-lg">
          Pilih template raport terlebih dahulu untuk memulai.
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
             onClick={() => setShowCreateTemplate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
               onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Buat Template Raport Baru</h3>
              <button
                onClick={() => setShowCreateTemplate(false)}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-500"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Template *
                </label>
                <input
                  type="text"
                  value={newTemplate.nama_template}
                  onChange={(e) => setNewTemplate({ ...newTemplate, nama_template: e.target.value })}
                  placeholder="Misal: Raport SMP Kelas 7 Kurikulum Merdeka"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenjang</label>
                  <select
                    value={newTemplate.jenjang}
                    onChange={(e) => setNewTemplate({ ...newTemplate, jenjang: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="paud">PAUD</option>
                    <option value="sd_mi">SD/MI</option>
                    <option value="smp_mts">SMP/MTs</option>
                    <option value="sma_ma">SMA/MA</option>
                    <option value="smk_mak">SMK/MAK</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kurikulum</label>
                  <select
                    value={newTemplate.kurikulum}
                    onChange={(e) => updateKurikulum(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="kurikulum_merdeka">Kurikulum Merdeka (Kemendikdasmen)</option>
                    <option value="k13">K13 (Kemendikdasmen)</option>
                    <option value="kbc">KBC - Kurikulum Berbasis Cinta (Kemenag)</option>
                    <option value="hybrid">Hybrid (K13 + Merdeka)</option>
                  </select>
                  {newTemplate.kurikulum === 'kbc' && (
                    <p className="text-xs text-emerald-600 mt-1">
                      Jalur regulasi otomatis: Kemenag (Madrasah)
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Laporan</label>
                <select
                  value={newTemplate.jenis_laporan}
                  onChange={(e) => setNewTemplate({ ...newTemplate, jenis_laporan: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="akhir_semester">Akhir Semester</option>
                  <option value="tengah_semester">Tengah Semester</option>
                  <option value="kokurikuler_p5">Kokurikuler/P5</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode Nilai</label>
                  <select
                    value={newTemplate.mode_nilai_akademik}
                    onChange={(e) => setNewTemplate({ ...newTemplate, mode_nilai_akademik: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="angka_kkm">Angka + KKM</option>
                    <option value="angka_deskripsi">Angka + Deskripsi</option>
                    <option value="naratif_saja">Naratif Saja</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basis Deskripsi</label>
                  <select
                    value={newTemplate.basis_deskripsi}
                    onChange={(e) => setNewTemplate({ ...newTemplate, basis_deskripsi: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="capaian_pembelajaran">Capaian Pembelajaran</option>
                    <option value="alur_tujuan_pembelajaran">ATP</option>
                    <option value="poin_materi">Poin Materi</option>
                  </select>
                </div>
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 space-y-1">
                <p>Jalur Regulasi: <span className="font-medium">{JALUR_LABELS[newTemplate.jalur_regulasi] || newTemplate.jalur_regulasi}</span></p>
                <p>Varian Sikap: <span className="font-medium">{newTemplate.varian_sikap === 'profil_pelajar_pancasila' ? 'Profil Pelajar Pancasila' : newTemplate.varian_sikap === 'profil_rahmatan_lil_alamin' ? 'Profil Pelajar Rahmatan Lil Alamin (P2RA)' : 'Dimensi Profil Lulusan Madrasah'}</span></p>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateTemplate(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={creatingTemplate || !newTemplate.nama_template.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creatingTemplate ? 'Membuat...' : 'Buat Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
