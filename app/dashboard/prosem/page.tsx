'use client';

import React, { useState } from 'react';
import { useTeacherStore, useKurikulumStore } from '@/lib/stores';

export default function ProsemPage() {
  const {
    activeSchoolId,
    getActiveSchool,
    getActiveJenjang,
  } = useTeacherStore();

  const {
    selectedDimensi8,
    useTigaPengalaman,
    serializeForAPI,
  } = useKurikulumStore();

  const [formData, setFormData] = useState({
    jenjang: 'SMA',
    kurikulum: 'merdeka',
    mapel: '',
    kelas: '10',
    semester: 'ganjil',
    minggu_efektif: '18',
  });

  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSchool = getActiveSchool();
  const kurikulumCtx = serializeForAPI();

  const handleGenerate = async () => {
    if (!formData.mapel.trim()) {
      setError('Mata pelajaran wajib diisi');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/generate-prosem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: activeSchoolId,
          school_name: activeSchool?.nama_sekolah,
          school_npsn: activeSchool?.npsn,
          jenjang: formData.jenjang,
          kurikulum: formData.kurikulum,
          mapel: formData.mapel,
          kelas: formData.kelas,
          semester: formData.semester,
          minggu_efektif: parseInt(formData.minggu_efektif),
          dimensi8: kurikulumCtx.dimensi8,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal generate Prosem');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl">
              📅
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Program Semester (Prosem)</h1>
              <p className="text-sm text-slate-500">Deep Learning • Kerangka 8334</p>
            </div>
          </div>

          {activeSchool && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
              🏫 {activeSchool.nama_sekolah}
              {activeSchool.npsn && ` (NPSN: ${activeSchool.npsn})`}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4">📝 Konfigurasi Prosem</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Jenjang</label>
                  <select
                    value={formData.jenjang}
                    onChange={(e) => setFormData(f => ({ ...f, jenjang: e.target.value }))}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none"
                  >
                    <option value="SD">SD / MI</option>
                    <option value="SMP">SMP / MTs</option>
                    <option value="SMA">SMA / MA</option>
                    <option value="SMK">SMK</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Kurikulum</label>
                  <select
                    value={formData.kurikulum}
                    onChange={(e) => setFormData(f => ({ ...f, kurikulum: e.target.value }))}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none"
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
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Kelas</label>
                    <select
                      value={formData.kelas}
                      onChange={(e) => setFormData(f => ({ ...f, kelas: e.target.value }))}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none"
                    >
                      {formData.jenjang === 'SD' && [1,2,3,4,5,6].map(k => (
                        <option key={k} value={k}>Kelas {k}</option>
                      ))}
                      {formData.jenjang === 'SMP' && [7,8,9].map(k => (
                        <option key={k} value={k}>Kelas {k}</option>
                      ))}
                      {['SMA', 'SMK'].includes(formData.jenjang) && [10,11,12].map(k => (
                        <option key={k} value={k}>Kelas {k}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Semester</label>
                    <select
                      value={formData.semester}
                      onChange={(e) => setFormData(f => ({ ...f, semester: e.target.value }))}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none"
                    >
                      <option value="ganjil">Ganjil</option>
                      <option value="genap">Genap</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Minggu Efektif</label>
                  <select
                    value={formData.minggu_efektif}
                    onChange={(e) => setFormData(f => ({ ...f, minggu_efektif: e.target.value }))}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none"
                  >
                    <option value="16">16 Minggu</option>
                    <option value="17">17 Minggu</option>
                    <option value="18">18 Minggu</option>
                    <option value="19">19 Minggu</option>
                    <option value="20">20 Minggu</option>
                  </select>
                </div>

                {/* Deep Learning Info */}
                {selectedDimensi8.length > 0 && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <p className="text-[10px] font-bold text-emerald-700 mb-1">✨ 8 Dimensi Terpilih:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedDimensi8.slice(0, 3).map((d: string) => (
                        <span key={d} className="px-1.5 py-0.5 bg-emerald-200 text-emerald-700 rounded text-[10px]">{d}</span>
                      ))}
                      {selectedDimensi8.length > 3 && (
                        <span className="text-[10px] text-emerald-500">+{selectedDimensi8.length - 3} lagi</span>
                      )}
                    </div>
                  </div>
                )}

                {useTigaPengalaman && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-[10px] font-bold text-amber-700">🔄 3 Pengalaman Belajar</p>
                    <p className="text-[10px] text-amber-600">Memahami → Mengaplikasi → Merefleksikan</p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-700 text-xs">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
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
                    '🤖 Generate Prosem dengan AI'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[500px]">
              {!result ? (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                  <span className="text-6xl mb-4">📅</span>
                  <p className="text-lg font-semibold">Prosem Belum Dibuat</p>
                  <p className="text-sm">Isi form di kiri dan klik Generate</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                    <div>
                      <h3 className="font-bold text-slate-800">{result.judul}</h3>
                      <p className="text-xs text-slate-500">
                        {activeSchool?.nama_sekolah} • {formData.mapel} • Semester {formData.semester}
                      </p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition"
                    >
                      🖨️ Print
                    </button>
                  </div>
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto">
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
