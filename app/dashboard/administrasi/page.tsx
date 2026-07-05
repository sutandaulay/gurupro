'use client';

import React, { useState } from 'react';
import { useTeacherStore, useKurikulumStore } from '@/lib/stores';

export default function AdministrasiPage() {
  const {
    activeSchoolId,
    getActiveSchool,
    getActiveKurikulum,
    getActiveJenjang,
  } = useTeacherStore();

  const {
    selectedDimensi8,
    useTigaPengalaman,
    selectedPengalaman,
    paiModeEnabled,
    paiIntegration,
    serializeForAPI,
  } = useKurikulumStore();

  const [formData, setFormData] = useState({
    tipe: 'modul', // modul, rpp, silabus, lkpd
    mapel: '',
    kelas: '10',
    kurikulum: 'merdeka',
    topik: '',
    tujuan: '',
  });

  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSchool = getActiveSchool();
  const kurikulumCtx = serializeForAPI();

  const handleGenerate = async () => {
    if (!formData.mapel.trim() || !formData.topik.trim()) {
      setError('Mata pelajaran dan topik wajib diisi');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/generate-administrasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          school_id: activeSchoolId,
          school_name: activeSchool?.nama_sekolah,
          school_npsn: activeSchool?.npsn,
          school_address: activeSchool?.alamat,
          jenjang: getActiveJenjang(),
          ...kurikulumCtx,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal generate dokumen');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  const tipeLabels: Record<string, string> = {
    modul: 'Modul Ajar',
    rpp: 'RPP (Rencana Pelaksanaan Pembelajaran)',
    silabus: 'Silabus',
    lkpd: 'LKPD (Lembar Kerja)',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xl">
              📚
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">AI Modul Ajar & Administrasi</h1>
              <p className="text-sm text-slate-500">Deep Learning • Kerangka 8334 • {formData.kurikulum.toUpperCase()}</p>
            </div>
          </div>

          {activeSchool && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full text-xs font-semibold">
              🏫 {activeSchool.nama_sekolah}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1 space-y-4">
            {/* Document Type */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-3">📄 Jenis Dokumen</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(tipeLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFormData(f => ({ ...f, tipe: key }))}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      formData.tipe === key
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-slate-200 hover:border-violet-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Configuration */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-3">⚙️ Konfigurasi</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Kurikulum</label>
                  <select
                    value={formData.kurikulum}
                    onChange={(e) => setFormData(f => ({ ...f, kurikulum: e.target.value }))}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                  >
                    <option value="merdeka">Kurikulum Merdeka</option>
                    <option value="k13">Kurikulum 2013</option>
                    <option value="kbc">Kurikulum Berbasis Cinta</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Mata Pelajaran</label>
                  <input
                    type="text"
                    value={formData.mapel}
                    onChange={(e) => setFormData(f => ({ ...f, mapel: e.target.value }))}
                    placeholder="Contoh: Matematika"
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Kelas</label>
                  <select
                    value={formData.kelas}
                    onChange={(e) => setFormData(f => ({ ...f, kelas: e.target.value }))}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(k => (
                      <option key={k} value={k}>Kelas {k}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Topik / Materi</label>
                  <input
                    type="text"
                    value={formData.topik}
                    onChange={(e) => setFormData(f => ({ ...f, topik: e.target.value }))}
                    placeholder="Contoh: Trigonometri"
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Tujuan Pembelajaran <span className="text-slate-400">(Opsional)</span></label>
                  <input
                    type="text"
                    value={formData.tujuan}
                    onChange={(e) => setFormData(f => ({ ...f, tujuan: e.target.value }))}
                    placeholder="Contoh: Siswa mampu..."
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Deep Learning Info */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-4">
              <h4 className="font-bold text-violet-800 mb-2 flex items-center gap-2">
                <span>✨</span> Deep Learning Context
              </h4>

              {selectedDimensi8.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold text-violet-600 mb-1">8 Dimensi Profil Lulusan:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedDimensi8.map((d: string) => (
                      <span key={d} className="px-1.5 py-0.5 bg-violet-200 text-violet-700 rounded text-[10px]">{d}</span>
                    ))}
                  </div>
                </div>
              )}

              {useTigaPengalaman && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold text-emerald-600 mb-1">🔄 3 Pengalaman Belajar:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedPengalaman.map((p: string) => (
                      <span key={p} className="px-1.5 py-0.5 bg-emerald-200 text-emerald-700 rounded text-[10px]">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {paiModeEnabled && (
                <div>
                  <p className="text-[10px] font-semibold text-amber-600 mb-1">🕌 PAI Mode: {paiIntegration}</p>
                </div>
              )}

              {selectedDimensi8.length === 0 && !useTigaPengalaman && !paiModeEnabled && (
                <p className="text-xs text-slate-500">Pilih 8 Dimensi dan 3 Pengalaman di sidebar untuk konteks Deep Learning</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-700 text-xs">
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-violet-200 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Generate...
                </span>
              ) : (
                `🤖 Generate ${tipeLabels[formData.tipe]}`
              )}
            </button>
          </div>

          {/* Result */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[600px]">
              {!result ? (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                  <span className="text-6xl mb-4">📄</span>
                  <p className="text-lg font-semibold">Dokumen Belum Dibuat</p>
                  <p className="text-sm">Isi form di kiri dan klik Generate</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                    <div>
                      <h3 className="font-bold text-slate-800">{result.judul}</h3>
                      <p className="text-xs text-slate-500">
                        {activeSchool?.nama_sekolah} • {formData.mapel} • {formData.kurikulum.toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-violet-500 text-white rounded-xl text-sm font-semibold hover:bg-violet-600 transition"
                    >
                      🖨️ Print
                    </button>
                  </div>
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto max-h-[600px] overflow-y-auto">
                      {result.konten}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
