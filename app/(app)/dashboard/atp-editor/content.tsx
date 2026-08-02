'use client';
import { apiFetch } from "@/lib/api-client";

import React, { useState, useEffect } from 'react';
import { useTeacherStore, useKurikulumStore } from '@/lib/stores';
import dynamic from 'next/dynamic';
import PoinHabisModal from '@/app/components/ui/PoinHabisModal';

export default function ATPEditorPage() {
  const {
    activeSchoolId,
    activeSubjectId,
    getActiveSchool,
    getActiveSubject,
    getActiveKurikulum,
    getActiveJenjang,
  } = useTeacherStore();

  const { selectedDimensi8, serializeForAPI } = useKurikulumStore();

  const [atpList, setAtpList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedATP, setSelectedATP] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [resolvedSubjectName, setResolvedSubjectName] = useState('');

  // Token Modal State
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenShortfall, setTokenShortfall] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    judul_dokumen: '',
    jenjang: '',
    kurikulum: '',
    fase: '',
    semester: 'ganjil',
  });

  // Fetch ATP list
  useEffect(() => {
    if (!activeSchoolId) return;
    fetchATPList();
  }, [activeSchoolId, activeSubjectId]);

  useEffect(() => {
    const loadSubjectName = async () => {
      if (!activeSchoolId || !activeSubjectId) {
        setResolvedSubjectName('');
        return;
      }

      const currentSubject = getActiveSubject();
      if (currentSubject?.nama_mapel) {
        setResolvedSubjectName(currentSubject.nama_mapel);
        return;
      }

      try {
        const res = await apiFetch(`/api/subjects?school_id=${activeSchoolId}`);
        if (!res.ok) return;

        const data = await res.json();
        const subjects = data.rows || data.data || [];
        const matchedSubject = subjects.find((item: any) => item.id === activeSubjectId);
        if (matchedSubject?.nama_mapel) {
          setResolvedSubjectName(matchedSubject.nama_mapel);
        }
      } catch (err) {
        console.error('Failed to resolve subject name:', err);
      }
    };

    loadSubjectName();
  }, [activeSchoolId, activeSubjectId, getActiveSubject]);

  const fetchATPList = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeSchoolId) params.set('school_id', activeSchoolId);
      if (activeSubjectId) params.set('subject_id', activeSubjectId);

      const res = await apiFetch(`/api/atp?${params}`);
      const data = await res.json();
      setAtpList(data.data || []);
    } catch (err) {
      console.error('Failed to fetch ATP:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateATP = async () => {
    if (!formData.judul_dokumen.trim()) {
      alert('Judul ATP wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const kurikulumCtx = serializeForAPI();
      const res = await apiFetch('/api/atp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul_dokumen: formData.judul_dokumen,
          konten: {
            headers: {
              jenjang: getActiveJenjang() || formData.jenjang,
              kurikulum: getActiveKurikulum() || formData.kurikulum,
              fase: formData.fase,
              semester: formData.semester,
              dimensi8: kurikulumCtx.dimensi8,
              tiga_pengalaman: kurikulumCtx.tiga_pengalaman,
            },
            rows: [],
          },
          school_id: activeSchoolId,
          subject_id: activeSubjectId,
          jenjang: getActiveJenjang() || formData.jenjang,
          kurikulum: getActiveKurikulum() || formData.kurikulum,
          fase: formData.fase,
          dimensi8: kurikulumCtx.dimensi8,
          semester: formData.semester,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert('ATP berhasil dibuat!');
        fetchATPList();
        setSelectedATP(data.data);
        setFormData({ judul_dokumen: '', jenjang: '', kurikulum: '', fase: '', semester: 'ganjil' });
      }
    } catch (err) {
      console.error('Failed to create ATP:', err);
      alert('Gagal membuat ATP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateATP = async () => {
    const school = getActiveSchool();
    const subject = getActiveSubject();
    const subjectName = subject?.nama_mapel || resolvedSubjectName || '';
    const kurikulum = getActiveKurikulum();
    const jenjang = getActiveJenjang();
    const kurikulumCtx = serializeForAPI();

    if (!formData.judul_dokumen.trim()) {
      alert('Judul ATP wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiFetch('/api/atp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul_dokumen: formData.judul_dokumen,
          school_id: activeSchoolId,
          school_name: school?.nama_sekolah,
          school_npsn: school?.npsn,
          subject_id: activeSubjectId,
          mapel: subjectName,
          jenjang: jenjang || formData.jenjang,
          kurikulum,
          fase: formData.fase,
          semester: formData.semester,
          dimensi8: kurikulumCtx.dimensi8,
          tiga_pengalaman: kurikulumCtx.tiga_pengalaman,
          pai_mode: kurikulumCtx.pai_mode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert('ATP berhasil di-generate!');
        fetchATPList();
      } else {
        const err = await res.json();
        // Check if token error
        if (err.reason === "token_habis" || err.reason === "subscription_expired") {
          setShowTokenModal(true);
          setTokenShortfall(1);
           alert('Poin habis. Silakan top-up atau upgrade paket.');
        } else {
          alert(`Gagal: ${err.error}`);
        }
      }
    } catch (err) {
      console.error('Failed to generate ATP:', err);
      alert('Gagal generate ATP');
    } finally {
      setIsLoading(false);
    }
  };

  const activeSchool = getActiveSchool();
  const activeSubject = getActiveSubject();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">📋 ATP Editor</h1>
          <p className="text-sm text-slate-500">
            {activeSchool ? `Sekolah: ${activeSchool.nama_sekolah}` : 'Pilih sekolah di sidebar'}
            {activeSubject ? ` • Mata Pelajaran: ${activeSubject.nama_mapel}` : ''}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left: ATP List + Form */}
          <div className="col-span-4 space-y-4">
            {/* Create Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span>✨</span> Buat ATP Baru
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Judul ATP</label>
                  <input
                    type="text"
                    value={formData.judul_dokumen}
                    onChange={(e) => setFormData(f => ({ ...f, judul_dokumen: e.target.value }))}
                    placeholder="Contoh: ATP Matematika Kelas 10"
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Jenjang</label>
                    <select
                      value={formData.jenjang}
                      onChange={(e) => setFormData(f => ({ ...f, jenjang: e.target.value }))}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
                    >
                      <option value="">Auto</option>
                      <option value="SD">SD</option>
                      <option value="SMP">SMP</option>
                      <option value="SMA">SMA</option>
                      <option value="SMK">SMK</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Fase</label>
                    <select
                      value={formData.fase}
                      onChange={(e) => setFormData(f => ({ ...f, fase: e.target.value }))}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
                    >
                      <option value="">-</option>
                      <option value="A">A (Kelas 1-2 SD)</option>
                      <option value="B">B (Kelas 3-4 SD)</option>
                      <option value="C">C (Kelas 5-6 SD)</option>
                      <option value="D">D (Kelas 7-9 SMP)</option>
                      <option value="E">E (Kelas 10-11 SMA)</option>
                      <option value="F">F (Kelas 12 SMA)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Semester</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData(f => ({ ...f, semester: e.target.value }))}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
                  >
                    <option value="ganjil">Ganjil</option>
                    <option value="genap">Genap</option>
                  </select>
                </div>

                {/* Dimensi8 Summary */}
                {selectedDimensi8.length > 0 && (
                  <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-200">
                    <p className="text-[10px] font-semibold text-indigo-700 mb-1">✨ 8 Dimensi Terpilih:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedDimensi8.map((d: string) => (
                        <span key={d} className="px-1.5 py-0.5 bg-indigo-200 text-indigo-700 rounded text-[10px]">{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCreateATP}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {isLoading ? 'Memproses...' : '+ Buat ATP Kosong'}
                </button>
                <button
                  onClick={handleGenerateATP}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl text-sm font-semibold transition shadow disabled:opacity-50"
                >
                  {isLoading ? 'Memproses AI...' : '🤖 Generate dengan AI'}
                </button>
              </div>
            </div>

            {/* ATP List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span>📁</span> Daftar ATP ({atpList.length})
              </h3>
              {isLoading && atpList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">Memuat...</div>
              ) : atpList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Belum ada ATP. Buat ATP baru di atas.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {atpList.map((atp: any) => (
                    <button
                      key={atp.id}
                      onClick={() => {
                        setSelectedATP(atp);
                        setEditMode(false);
                        setEditContent(atp.konten);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        selectedATP?.id === atp.id
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-800 line-clamp-1">{atp.judul_dokumen}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {atp.kurikulum || 'Kurikulum'} • {atp.jenjang || ''} {atp.fase ? `Fase ${atp.fase}` : ''} • {atp.semester || ''}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(atp.created_at).toLocaleDateString('id-ID')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: ATP Viewer/Editor */}
          <div className="col-span-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[600px]">
              {!selectedATP ? (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                  <span className="text-5xl mb-4">📋</span>
                  <p className="text-lg font-semibold">Pilih ATP untuk melihat</p>
                  <p className="text-sm">atau buat ATP baru di panel kiri</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">{selectedATP.judul_dokumen}</h2>
                      <p className="text-xs text-slate-500">
                        {selectedATP.nama_sekolah || ''} • {selectedATP.nama_mapel || selectedATP.mapel || ''} • {selectedATP.semester || ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditMode(!editMode)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                          editMode ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {editMode ? '💾 Simpan' : '✏️ Edit'}
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition"
                      >
                        🖨️ Print
                      </button>
                    </div>
                  </div>

                  {/* Download links */}
                  {selectedATP.konten && typeof selectedATP.konten !== 'string' && (selectedATP.konten.pdf_url || selectedATP.konten.docx_url) && (
                    <div className="mb-4 p-4 bg-white border border-slate-200 rounded-2xl flex flex-col gap-2 text-xs font-bold font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Unduh Berkas Dokumen:</span>
                        <span className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[10px] font-semibold">
                          ✓ Tersimpan di Storage Saya
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedATP.konten.docx_url && (
                          <a
                            href={selectedATP.konten.docx_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>📘</span> Word (DOC)
                          </a>
                        )}
                        {selectedATP.konten.pdf_url && (
                          <a
                            href={selectedATP.konten.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>📕</span> PDF
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ATP Content Display */}
                  <div className="prose max-w-none">
                    {typeof selectedATP.konten === 'string' ? (
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono bg-slate-50 p-4 rounded-xl">{selectedATP.konten}</pre>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono bg-slate-50 p-4 rounded-xl">
                        {selectedATP.konten?.markdown || selectedATP.konten?.konten || JSON.stringify(selectedATP.konten, null, 2)}
                      </pre>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Poin Habis Modal */}
        <PoinHabisModal
          open={showTokenModal}
          shortfall={tokenShortfall}
          onClose={() => setShowTokenModal(false)}
          onBuyTopUp={() => window.location.href = '/profile?tab=billing'}
          onUpgrade={() => window.location.href = '/profile?tab=billing'}
        />
      </div>
    </div>
  );
}
