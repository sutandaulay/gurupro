'use client';
import { apiFetch } from "@/lib/api-client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTeacherStore, useKurikulumStore, DIMENSI_8_OPTIONS } from '@/lib/stores';
import { GenerateBahanAjarButton } from '@/app/components/bahan-ajar';
import { useSession } from "next-auth/react";
import dynamic from 'next/dynamic';
import PoinHabisModal from '@/app/components/ui/PoinHabisModal';
import RichMarkdown from '@/components/ai/RichMarkdown';
import { silabusToMarkdown } from '@/lib/ai/silabus-markdown';

function AdministrasiContent() {
  const { data: session } = useSession();
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
    toggleDimensi8,
  } = useKurikulumStore();

  const [formData, setFormData] = useState({
    tipe: 'modul', // modul, rpp, silabus, lkpd, bahan_ajar, prota, prosem
    mapel: '',
    kelas: '10',
    kurikulum: 'merdeka',
    topik: '',
    tujuan: '',
    // RPP & Modul Ajar specific
    fase: 'E',
    alokasi_waktu: '2 x 45 menit',
    model_pembelajaran: 'discovery',
    jumlah_pertemuan: 1,
    semester: 'Ganjil',
    // Modul Ajar additional fields
    capaian_pembelajaran: '',
    kompetensi_awal: '',
    sarana_prasarana: '',
    dimensi_target: [] as string[],
  });

  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Token Modal State
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenShortfall, setTokenShortfall] = useState(0);

  // States untuk simpan Modul Ajar
  const [isSaving, setIsSaving] = useState(false);
  const [savedModulAjarId, setSavedModulAjarId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Modul Ajar export mode (ringkas vs lengkap)
  const [modulAjarExportMode, setModulAjarExportMode] = useState<'lengkap' | 'ringkas'>('lengkap');

  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);

    // Read URL query params for document type
    const tipeParam = searchParams.get('tipe');
    if (tipeParam) {
      const validTypes = ['modul', 'modul_ajar', 'rpp', 'silabus', 'lkpd', 'bahan_ajar', 'prota', 'prosem'];
      if (validTypes.includes(tipeParam)) {
        const mappedTipe = tipeParam === 'modul_ajar' ? 'modul' : tipeParam;
        setFormData(f => ({ ...f, tipe: mappedTipe }));
      }
    }
  }, [searchParams]);

  const activeSchool = mounted ? getActiveSchool() : null;
  const kurikulumCtx = serializeForAPI();

  const getFaseFromKelas = (kelasStr: string): string => {
    const k = parseInt(kelasStr, 10);
    if (k === 1 || k === 2) return 'A';
    if (k === 3 || k === 4) return 'B';
    if (k === 5 || k === 6) return 'C';
    if (k === 7 || k === 8 || k === 9) return 'D';
    if (k === 10) return 'E';
    if (k === 11 || k === 12) return 'F';
    return 'E';
  };

  const getJenjangFromKelas = (kelasStr: string): string => {
    const k = parseInt(kelasStr, 10);
    if (k >= 1 && k <= 6) return 'SD';
    if (k >= 7 && k <= 9) return 'SMP';
    if (k >= 10 && k <= 12) return 'SMA';
    return 'SMA';
  };

  const handleSaveModulAjar = async () => {
    if (!result) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    const jenjang = getJenjangFromKelas(formData.kelas);
    const fase = getFaseFromKelas(formData.kelas);

    try {
      const res = await apiFetch('/api/modul-ajar/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaModul: result.judul,
          jenjang,
          fase,
          mapel: formData.mapel,
          kelas: formData.kelas,
          jenisKurikulum: formData.kurikulum,
          topik: formData.topik,
          tujuan: formData.tujuan,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSavedModulAjarId(data.modulAjarId);
        setSaveSuccess(true);
      } else {
        setSaveError(data.error || 'Gagal menyimpan modul ajar');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!formData.mapel.trim() || !formData.topik.trim()) {
      setError('Mata pelajaran dan topik wajib diisi');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSavedModulAjarId(null);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      // Tipe silabus memakai endpoint terdedikasi /api/silabus/generate
      // yang mengembalikan JSON terstruktur Alur Tujuan Pembelajaran (ATP).
      if (formData.tipe === 'silabus') {
        const semesterNumber = String(formData.semester).toLowerCase().startsWith('genap') ? 2 : 1;
        const res = await apiFetch('/api/silabus/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mataPelajaran: formData.mapel,
            fase: formData.fase,
            kelas: formData.kelas,
            semester: semesterNumber,
            kurikulum: formData.kurikulum,
            dimensi8: formData.dimensi_target.length > 0 ? formData.dimensi_target : kurikulumCtx.dimensi8,
            tiga_pengalaman: kurikulumCtx.tiga_pengalaman,
            capaianPembelajaran: formData.capaian_pembelajaran || '',
            jumlahMingguEfektif: 18,
            tahunAjaran: '',
            school_id: activeSchoolId,
            school_name: activeSchool?.nama_sekolah,
            school_npsn: activeSchool?.npsn,
            jenjang: getActiveJenjang(),
            pai_mode: kurikulumCtx.pai_mode,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const title = `Silabus - ${formData.mapel} Kelas ${formData.kelas} - Fase ${formData.fase} (Semester ${formData.semester})`;
          setResult({
            id: data.id,
            judul: title,
            konten: data.data ? silabusToMarkdown(data.data) : String(data.error || ''),
            pdf_url: data.files?.pdf_url || null,
            docx_url: data.files?.docx_url || null,
          });
        } else {
          const err = await res.json();
          if (err.reason === "token_habis" || err.reason === "subscription_expired") {
            setShowTokenModal(true);
            setTokenShortfall(1);
            setError("Poin habis. Silakan top-up atau upgrade paket.");
          } else {
            setError(err.error || 'Gagal generate silabus');
          }
        }
        setIsLoading(false);
        return;
      }

      const res = await apiFetch('/api/generate-administrasi', {
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
          // Override dimensi8 with form-specific selection if available
          dimensi8: formData.dimensi_target.length > 0 ? formData.dimensi_target : kurikulumCtx.dimensi8,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const err = await res.json();
        // Check if token error
        if (err.reason === "token_habis" || err.reason === "subscription_expired") {
          setShowTokenModal(true);
          setTokenShortfall(1);
          setError("Poin habis. Silakan top-up atau upgrade paket.");
        } else {
          setError(err.error || 'Gagal generate dokumen');
        }
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
    bahan_ajar: 'Bahan Ajar AI',
  };

  const tipeIcons: Record<string, string> = {
    modul: '📚',
    rpp: '📋',
    silabus: '📑',
    lkpd: '📝',
    bahan_ajar: '✨',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 no-print-area">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xl">
              {tipeIcons[formData.tipe] || '📄'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {formData.tipe === 'rpp' ? 'AI RPP (Rencana Pelaksanaan Pembelajaran)' :
                 formData.tipe === 'silabus' ? 'AI Silabus Pembelajaran' :
                 formData.tipe === 'lkpd' ? 'AI LKPD (Lembar Kerja)' :
                 formData.tipe === 'bahan_ajar' ? 'AI Bahan Ajar' :
                 'AI Modul Ajar & Administrasi'}
              </h1>
              <p className="text-sm text-slate-500">
                {formData.tipe === 'rpp' ? 'Permendikdasmen No. 1 Tahun 2026 • 3 Prinsip & 3 Pengalaman Belajar' :
                 formData.tipe === 'silabus' ? 'Permendikdasmen No. 1 Tahun 2026 • Standar Proses' :
                 'Deep Learning • ' + formData.kurikulum.toUpperCase()}
              </p>
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
          <div className="lg:col-span-1 space-y-4 no-print-area">
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

                <div className="grid grid-cols-2 gap-2">
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
                    <label className="text-xs font-medium text-slate-500 block mb-1">Fase</label>
                    <select
                      value={formData.fase}
                      onChange={(e) => setFormData(f => ({ ...f, fase: e.target.value }))}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                    >
                      <option value="A">Fase A (Kelas 1-2)</option>
                      <option value="B">Fase B (Kelas 3-4)</option>
                      <option value="C">Fase C (Kelas 5-6)</option>
                      <option value="D">Fase D (Kelas 7-9)</option>
                      <option value="E">Fase E (Kelas 10)</option>
                      <option value="F">Fase F (Kelas 11-12)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Semester</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData(f => ({ ...f, semester: e.target.value }))}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
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
                  <label className="text-xs font-medium text-slate-500 block mb-1">Topik / Materi</label>
                  <input
                    type="text"
                    value={formData.topik}
                    onChange={(e) => setFormData(f => ({ ...f, topik: e.target.value }))}
                    placeholder="Contoh: Trigonometri"
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                  />
                </div>

                {/* Dimensi Profil Lulusan Target - untuk Modul Ajar & Silabus */}
                {(formData.tipe === 'modul' || formData.tipe === 'silabus') && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">
                      Dimensi Profil Lulusan Target <span className="text-slate-400">(opsional, maks 3)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {DIMENSI_8_OPTIONS.slice(0, 7).map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => {
                            const current = formData.dimensi_target;
                            if (current.includes(d.key)) {
                              setFormData(f => ({ ...f, dimensi_target: current.filter(k => k !== d.key) }));
                            } else if (current.length < 3) {
                              setFormData(f => ({ ...f, dimensi_target: [...current, d.key] }));
                            }
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                            formData.dimensi_target.includes(d.key)
                              ? 'bg-violet-500 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-violet-100'
                          }`}
                        >
                          {d.icon} {d.label.split('.')[0]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Dipilih: {formData.dimensi_target.length}/3 dimensi
                    </p>
                  </div>
                )}

                {/* RPP & Modul Ajar Specific Fields */}
                {(formData.tipe === 'rpp' || formData.tipe === 'modul') && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Alokasi Waktu per Pertemuan</label>
                      <select
                        value={formData.alokasi_waktu}
                        onChange={(e) => setFormData(f => ({ ...f, alokasi_waktu: e.target.value }))}
                        className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                      >
                        <option value="1 x 45 menit">1 x 45 menit</option>
                        <option value="2 x 45 menit">2 x 45 menit</option>
                        <option value="3 x 45 menit">3 x 45 menit</option>
                        <option value="4 x 45 menit">4 x 45 menit</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Model Pembelajaran</label>
                      <select
                        value={formData.model_pembelajaran}
                        onChange={(e) => setFormData(f => ({ ...f, model_pembelajaran: e.target.value }))}
                        className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                      >
                        <option value="discovery">Discovery Learning</option>
                        <option value="pbl">Problem Based Learning (PBL)</option>
                        <option value="pjbl">Project Based Learning (PjBL)</option>
                        <option value="sfd">Sports For Development</option>
                        <option value="cbl">Challenge Based Learning</option>
                        <option value="manufacturing">Manufacturing Based Learning</option>
                        <option value="entrepreneurship">Entrepreneurship Based Learning</option>
                        <option value="kontekstual">Kontekstual</option>
                        <option value="scientific">Scientific Approach</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Jumlah Pertemuan</label>
                      <select
                        value={formData.jumlah_pertemuan}
                        onChange={(e) => setFormData(f => ({ ...f, jumlah_pertemuan: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                      >
                        {[1,2,3,4,5,6,7,8,10,12].map(n => (
                          <option key={n} value={n}>{n} Pertemuan</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Modul Ajar Additional Fields */}
                {formData.tipe === 'modul' && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Capaian Pembelajaran <span className="text-slate-400">(Opsional)</span></label>
                      <textarea
                        value={formData.capaian_pembelajaran}
                        onChange={(e) => setFormData(f => ({ ...f, capaian_pembelajaran: e.target.value }))}
                        placeholder="Contoh: Murid mampu memahami konsep bilangan bulat..."
                        rows={2}
                        className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Kompetensi Awal <span className="text-slate-400">(Opsional)</span></label>
                      <input
                        type="text"
                        value={formData.kompetensi_awal}
                        onChange={(e) => setFormData(f => ({ ...f, kompetensi_awal: e.target.value }))}
                        placeholder="Prasyarat yang harus dikuasai murid"
                        className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Sarana Prasarana <span className="text-slate-400">(Opsional)</span></label>
                      <input
                        type="text"
                        value={formData.sarana_prasarana}
                        onChange={(e) => setFormData(f => ({ ...f, sarana_prasarana: e.target.value }))}
                        placeholder="LCD, laptop, internet, bahan ajar"
                        className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Tujuan Pembelajaran <span className="text-slate-400">(Opsional)</span></label>
                  <textarea
                    value={formData.tujuan}
                    onChange={(e) => setFormData(f => ({ ...f, tujuan: e.target.value }))}
                    placeholder="Contoh: Murid mampu menyelesaikan soal trigonometri dengan benar"
                    rows={3}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-violet-400 outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Deep Learning Info */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-4">
              <h4 className="font-bold text-violet-800 mb-2 flex items-center gap-2">
                <span>✨</span> Deep Learning Context
              </h4>
              <p className="text-[10px] text-slate-500 mb-2">Berdasarkan Permendikdasmen No. 1 Tahun 2026</p>

              <div className="mb-3 p-2 bg-white/50 rounded-lg">
                <p className="text-[10px] font-bold text-violet-600 mb-1">3 Prinsip Pembelajaran:</p>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Berkesadaran</span>
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Bermakna</span>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Meng-<span className="bg-blue-100 px-0.5 rounded">gembirakan</span></span>
                </div>
              </div>

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
                  <p className="text-[10px] font-semibold text-emerald-600 mb-1">3 Pengalaman Belajar (Pasal 10):</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedPengalaman.map((p: string) => (
                      <span key={p} className="px-1.5 py-0.5 bg-emerald-200 text-emerald-700 rounded text-[10px]">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {paiModeEnabled && (
                <div>
                  <p className="text-[10px] font-semibold text-amber-600 mb-1">PAI Mode: {paiIntegration}</p>
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
                  Memproses...
                </span>
              ) : (
                `🤖 Hasilkan ${tipeLabels[formData.tipe]} (Permendikdasmen 1/2026)`
              )}
            </button>
          </div>

          {/* Result */}
          <div className="lg:col-span-2 print-document">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[600px] print:border-none print:shadow-none print:p-0">
              {!result ? (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                  <span className="text-6xl mb-4">📄</span>
                  <p className="text-lg font-semibold">Dokumen Belum Dibuat</p>
                  <p className="text-sm">Isi form di kiri dan klik Generate</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-200 no-print">
                    <div>
                      <h3 className="font-bold text-slate-800">{result.judul}</h3>
                      <p className="text-xs text-slate-500">
                        {activeSchool?.nama_sekolah} • {formData.mapel} • {formData.kurikulum.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Tombol Cetak / Print */}
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        🖨️ Cetak {tipeLabels[formData.tipe]}
                      </button>

                      {/* Tombol Simpan Modul Ajar ke Database */}
                      {formData.tipe === 'modul' && (
                        <>
                          {!saveSuccess ? (
                            <button
                              onClick={handleSaveModulAjar}
                              disabled={isSaving}
                              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              {isSaving ? '⏳ Menyimpan...' : '💾 Simpan ke Database'}
                            </button>
                          ) : (
                            <span className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                              ✓ Tersimpan
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tampilkan Tombol Generate Bahan Ajar jika berhasil disimpan */}
                  {saveSuccess && savedModulAjarId && formData.tipe === 'modul' && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">Modul Ajar Berhasil Disimpan!</p>
                        <p className="text-xs text-emerald-600">Lanjutkan untuk membuat Bahan Ajar AI (Slide, LKPD, Handout) berdasarkan modul ini.</p>
                      </div>
                      <GenerateBahanAjarButton
                        modulAjarId={savedModulAjarId}
                        modulAjarStatus="completed"
                        modulAjarName={result.judul}
                        jumlahPertemuan={4}
                        onGenerateSuccess={(bahanAjarId) => {
                          window.location.href = `/dashboard/bahan-ajar/${bahanAjarId}`;
                        }}
                      />
                    </div>
                  )}

                  {saveError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl no-print">
                      ⚠️ {saveError}
                    </div>
                  )}

                  {/* Download links */}
                  {(result.pptx_url || result.pdf_url || result.docx_url) && (
                    <div className="mb-4 p-4 bg-white border border-slate-200 rounded-2xl flex flex-col gap-2 text-xs font-bold font-sans no-print">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          📥 Unduh {tipeLabels[formData.tipe]}:
                        </span>
                        <span className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[10px] font-semibold">
                          ✓ Tersimpan di Storage
                        </span>
                      </div>

                      {/* Modul Ajar Export Mode Toggle */}
                      {formData.tipe === 'modul' && (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200 mb-2">
                          <span className="text-[10px] font-medium text-amber-700">Mode Export:</span>
                          <button
                            onClick={() => setModulAjarExportMode('ringkas')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition ${
                              modulAjarExportMode === 'ringkas'
                                ? 'bg-amber-500 text-white'
                                : 'bg-white text-amber-600 border border-amber-300'
                            }`}
                          >
                            📋 Ringkas
                          </button>
                          <button
                            onClick={() => setModulAjarExportMode('lengkap')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition ${
                              modulAjarExportMode === 'lengkap'
                                ? 'bg-amber-500 text-white'
                                : 'bg-white text-amber-600 border border-amber-300'
                            }`}
                          >
                            📚 Lengkap (dengan Lampiran)
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {result.pptx_url && (
                          <a
                            href={result.pptx_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>📊</span> PPTX (Slide Presentasi)
                          </a>
                        )}
                        {result.docx_url && (
                          <a
                            href={result.docx_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>📘</span> Word (DOC)
                          </a>
                        )}
                        {result.pdf_url && (
                          <a
                            href={result.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>📕</span> PDF
                          </a>
                        )}
                      </div>
                      {formData.tipe === 'modul' && modulAjarExportMode === 'ringkas' && (
                        <p className="text-[10px] text-slate-500 italic mt-1">
                          ⚡ Export ringkas: tanpa lampiran (LKPD, Glosarium, Daftar Pustaka)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Kop Surat & Identitas (Tampak di screen dan print) */}
                  <div className="mb-6 p-6 bg-slate-50 rounded-xl border border-slate-200 print:bg-white print:border-none print:p-0 print:border-b-4 print:border-double print:border-black print:rounded-none">
                    {/* Kop Surat Header (Cetak/Print Mode) */}
                    <div className="text-center pb-4 mb-4 border-b border-slate-200 print:border-black print:border-b-4 print:border-double">
                      {activeSchool ? (
                        <>
                          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider print:text-black print:text-xs">
                            {formData.tipe === 'rpp' ? 'Rencana Pelaksanaan Pembelajaran (RPP) 1 Lembar' :
                             formData.tipe === 'silabus' ? 'Silabus Pembelajaran Semester' :
                             formData.tipe === 'lkpd' ? 'Lembar Kerja Peserta Didik (LKPD)' :
                             formData.tipe === 'bahan_ajar' ? 'Bahan Ajar AI' :
                             'Modul Ajar'}
                          </h2>
                          <h1 className="text-lg font-bold text-slate-800 uppercase tracking-wide mt-1 print:text-black print:text-lg">
                            {activeSchool.nama_sekolah}
                          </h1>
                          <p className="text-[10px] text-slate-400 mt-1 print:text-black print:text-[10px] print:italic">
                            {activeSchool.alamat || "Alamat Sekolah"} {activeSchool.npsn ? `• NPSN: ${activeSchool.npsn}` : ''}
                          </p>
                        </>
                      ) : (
                        <>
                          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider print:text-black print:text-xs">
                            {formData.tipe === 'rpp' ? 'Rencana Pelaksanaan Pembelajaran (RPP) 1 Lembar' :
                             formData.tipe === 'silabus' ? 'Silabus Pembelajaran Semester' :
                             formData.tipe === 'lkpd' ? 'Lembar Kerja Peserta Didik (LKPD)' :
                             formData.tipe === 'bahan_ajar' ? 'Bahan Ajar AI' :
                             'Modul Ajar'}
                          </h2>
                          <h1 className="text-lg font-bold text-slate-800 uppercase tracking-wide mt-1 print:text-black print:text-lg">
                            DOKUMEN ADMINISTRASI PEMBELAJARAN
                          </h1>
                          <p className="text-[10px] text-slate-400 mt-1 print:text-black print:text-[10px] print:italic">
                            Generasi Mandiri GuruPRO Academy
                          </p>
                        </>
                      )}
                    </div>

                    {/* Metadata Grid (Identitas Modul) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 print:text-black font-sans">
                      <div className="space-y-1.5">
                        <div className="flex">
                          <span className="w-32 font-medium">Nama Pendidik</span>
                          <span className="mr-2">:</span>
                          <span className="font-semibold">{session?.user?.name || "Guru Pengampu"}</span>
                        </div>
                        <div className="flex">
                          <span className="w-32 font-medium">Mata Pelajaran</span>
                          <span className="mr-2">:</span>
                          <span>{formData.mapel || "-"}</span>
                        </div>
                        <div className="flex">
                          <span className="w-32 font-medium">Kelas / Fase</span>
                          <span className="mr-2">:</span>
                          <span>Kelas {formData.kelas || "-"} / Fase {formData.fase}</span>
                        </div>
                        {(formData.tipe === 'rpp' || formData.tipe === 'modul') && (
                          <div className="flex">
                            <span className="w-32 font-medium">Alokasi Waktu</span>
                            <span className="mr-2">:</span>
                            <span>{formData.alokasi_waktu}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex">
                          <span className="w-32 font-medium">Topik / Materi</span>
                          <span className="mr-2">:</span>
                          <span>{formData.topik || "-"}</span>
                        </div>
                        <div className="flex">
                          <span className="w-32 font-medium">Kurikulum</span>
                          <span className="mr-2">:</span>
                          <span className="capitalize">{formData.kurikulum === 'merdeka' ? 'Kurikulum Merdeka' : formData.kurikulum === 'k13' ? 'Kurikulum 2013 (K13)' : formData.kurikulum === 'kbc' ? 'Kurikulum Berbasis Cinta' : 'Hybrid'}</span>
                        </div>
                        <div className="flex">
                          <span className="w-32 font-medium">Semester</span>
                          <span className="mr-2">:</span>
                          <span>{formData.semester}</span>
                        </div>
                        {(formData.tipe === 'rpp' || formData.tipe === 'modul') && (
                          <div className="flex">
                            <span className="w-32 font-medium">Jumlah Pertemuan</span>
                            <span className="mr-2">:</span>
                            <span>{formData.jumlah_pertemuan} Pertemuan</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Footer note */}
                    <div className="mt-4 pt-3 border-t border-slate-200 text-center">
                      <p className="text-[10px] text-slate-400 italic">
                        Disusun berdasarkan Permendikdasmen Nomor 1 Tahun 2026 tentang Standar Proses
                      </p>
                    </div>
                  </div>

                  {/* Rendering Content */}
                  <RichMarkdown content={result.konten || ''} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CSS untuk Layout Cetak Rapi */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Sembunyikan bagian navigasi, sidebar, header, form parameter, dan tombol */
          header, nav, aside, .no-print, button, .no-print-area {
            display: none !important;
          }
          /* Reset container utama */
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          .print-document {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          /* Pengaturan font dokumen formal */
          .markdown-body {
            font-family: "Times New Roman", Times, serif !important;
            color: #000000 !important;
            line-height: 1.6 !important;
          }
          .markdown-body h1 {
            font-size: 20pt !important;
            margin-top: 24pt !important;
            margin-bottom: 12pt !important;
            text-align: center !important;
            font-weight: bold !important;
            text-transform: uppercase !important;
          }
          .markdown-body h2 {
            font-size: 14pt !important;
            margin-top: 18pt !important;
            margin-bottom: 8pt !important;
            font-weight: bold !important;
            border-bottom: 1px solid #000 !important;
            padding-bottom: 3pt !important;
          }
          .markdown-body h3 {
            font-size: 12pt !important;
            margin-top: 12pt !important;
            margin-bottom: 6pt !important;
            font-weight: bold !important;
          }
          .markdown-body p, .markdown-body li {
            font-size: 11pt !important;
            margin-bottom: 6pt !important;
            text-align: justify !important;
          }
          /* Tabel styling untuk RPP/Silabus */
          .markdown-body table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 12pt 0 !important;
            font-size: 10pt !important;
          }
          .markdown-body table, .markdown-body th, .markdown-body td {
            border: 1px solid #333 !important;
            padding: 6pt !important;
          }
          .markdown-body th {
            background-color: #f0f0f0 !important;
            font-weight: bold !important;
            text-align: center !important;
          }
          /* Margin halaman formal cetak — standar dokumen Indonesia */
          @page {
            margin: 25mm 20mm 20mm 30mm !important;
            size: A4;
          }
        }
      `}} />

      {/* Poin Habis Modal */}
      <PoinHabisModal
        open={showTokenModal}
        shortfall={tokenShortfall}
        onClose={() => setShowTokenModal(false)}
        onBuyTopUp={() => window.location.href = '/profile?tab=billing'}
        onUpgrade={() => window.location.href = '/profile?tab=billing'}
      />
    </div>
  );
}

export default function AdministrasiPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AdministrasiContent />
    </Suspense>
  );
}
