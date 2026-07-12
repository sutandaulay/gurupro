"use client";
import React, { useState, useRef } from 'react';
import SchoolSwitcher from './school-switcher';
import Dimensi8Selector from './dimensi-8-selector';
import TigaPengalamanSelector from './tiga-pengalaman-selector';
import PaiModeSelector from './pai-mode-selector';
import { useKurikulumStore, useTeacherStore } from '@/lib/stores';

const kurikulumData: { [key: string]: {
  title: string;
  subtitle: string;
  desc: string;
  icon: string;
  colorClass: string;
  bgActive: string;
  borderActive: string;
  textColor: string;
  iconBg: string;
  iconColor: string;
  infoBg: string;
  infoBorder: string;
  badges: string[];
}} = {
  merdeka: {
    title: 'Merdeka',
    subtitle: 'Deep Learning',
    desc: 'Pendekatan Deep Learning dengan Profil Pelajar Pancasila. Format soal mengikuti standar Permendikbudristek terbaru.',
    icon: 'fa-graduation-cap',
    colorClass: 'merdeka',
    bgActive: 'bg-gradient-to-br from-[#eef2ff] to-[#e0e7ff]',
    borderActive: 'border-[#6366f1]',
    textColor: 'text-indigo-700',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    infoBg: 'bg-indigo-50/50',
    infoBorder: 'border-indigo-200',
    badges: ['HOTS (C4–C6)', 'Kontekstual', 'Profil Pelajar Pancasila', 'Asesmen Formatif & Sumatif']
  },
  kbc: {
    title: 'KBC',
    subtitle: 'Madrasah',
    desc: 'Pendekatan humanis dan islami untuk madrasah. Soal diintegrasikan dengan nilai-nilai akhlak, karakter, dan materi keagamaan.',
    icon: 'fa-heart',
    colorClass: 'kbc',
    bgActive: 'bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5]',
    borderActive: 'border-[#10b981]',
    textColor: 'text-emerald-700',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    infoBg: 'bg-emerald-50/50',
    infoBorder: 'border-emerald-200',
    badges: ['Integrasi Akhlak', 'Nilai Keagamaan', 'Karakter Islami', 'Kognitif & Afektif']
  },
  k13: {
    title: 'K13',
    subtitle: 'Kurikulum 2013',
    desc: 'Pendekatan saintifik dengan keseimbangan kompetensi sikap, pengetahuan, dan keterampilan secara terpadu.',
    icon: 'fa-book',
    colorClass: 'k13',
    bgActive: 'bg-gradient-to-br from-[#fffbeb] to-[#fef3c7]',
    borderActive: 'border-[#f59e0b]',
    textColor: 'text-amber-700',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    infoBg: 'bg-amber-50/50',
    infoBorder: 'border-amber-200',
    badges: ['Sikap & Keterampilan', 'Saintifik', 'Tematik Terpadu', 'Autentik Asesmen']
  },
  hybrid: {
    title: 'Hybrid',
    subtitle: 'Gabungan',
    desc: 'Menggabungkan keunggulan Kurikulum Merdeka (karakter & kemandirian) dengan struktur materi K13 secara dinamis.',
    icon: 'fa-layer-group',
    colorClass: 'hybrid',
    bgActive: 'bg-gradient-to-br from-[#f5f3ff] to-[#ede9fe]',
    borderActive: 'border-[#8b5cf6]',
    textColor: 'text-purple-700',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    infoBg: 'bg-purple-50/50',
    infoBorder: 'border-purple-200',
    badges: ['Fleksibel', 'Struktur K13', 'Karakter Merdeka', 'Komprehensif']
  }
};

interface SidebarProps {
  onGenerate: (formData: any) => Promise<void>;
  isLoading: boolean;
  schools?: any[];
}

export default function Sidebar({ onGenerate, isLoading, schools = [] }: SidebarProps) {
  const [formData, setFormData] = useState<any>({
    kurikulum: 'merdeka', jenjang: 'SD', kelas: '1', namaGuru: '', namaSekolah: '', mapel: '', topik: '',
    tujuan: '', bahasa: 'id', jenisAsesmen: 'Sumatif Harian', opsiPG: '4', pendekatan: 'standar',
    qty: { pg: 0, isian: 0, essay: 0, pgKompleks: 0, bs: 0, jodoh: 0, urutan: 0, tabel: 0, sebabAkibat: 0, ilustrasi: 0, diagram: 0, mindmap: 0 },
    visualMapping: { ilustrasi: [], diagram: [], mindmap: [] },
    proporsi: { mudah: 40, sedang: 40, sulit: 20 },
    activeLevels: ['C2', 'C3', 'C4']
  });

  const [error, setError] = useState<string | null>(null);
  const [isMapelCustom, setIsMapelCustom] = useState(false);
  const [materiTab, setMateriTab] = useState('none');
  const [fileName, setFileName] = useState<string | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const txtInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLER ---
  const updateField = (key: string, value: any) => setFormData((prev: any) => ({ ...prev, [key]: value }));
  const updateQty = (key: string, value: string) => setFormData((prev: any) => ({ ...prev, qty: { ...prev.qty, [key]: parseInt(value) || 0 } }));
  const updateProporsi = (key: string, value: string) => setFormData((prev: any) => ({ ...prev, proporsi: { ...prev.proporsi, [key]: parseInt(value) || 0 } }));

  const questionTypeKeys = ['pg', 'isian', 'essay', 'pgKompleks', 'bs', 'jodoh', 'urutan', 'tabel', 'sebabAkibat'];
  const totalSoal: number = questionTypeKeys.reduce((acc: number, key: string) => acc + (Number(formData.qty[key]) || 0), 0);
  const totalProporsi = formData.proporsi.mudah + formData.proporsi.sedang + formData.proporsi.sulit;

  const toggleKognitif = (level: string) => {
    const levels = formData.activeLevels.includes(level) 
      ? formData.activeLevels.filter((l: string) => l !== level) 
      : [...formData.activeLevels, level];
    updateField('activeLevels', levels);
  };

  const getKelasOptions = () => {
    if (formData.jenjang === 'SD') return [1, 2, 3, 4, 5, 6];
    if (formData.jenjang === 'SMP') return [7, 8, 9];
    if (formData.jenjang === 'SMA' || formData.jenjang === 'SMK') return [10, 11, 12];
    return [];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      updateField('fileName', file.name);
      
      if (file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          updateField('materiManual', event.target?.result || '');
        };
        reader.readAsText(file);
      }
    }
  };

  const generateSoal = async () => {
    if (!formData.topik.trim()) {
      setError("Topik/Materi wajib diisi!");
      return;
    }
    if (totalSoal <= 0) {
      setError("Jumlah soal harus lebih dari 0!");
      return;
    }
    if (totalProporsi !== 100) {
      setError("Total proporsi tingkat kesulitan harus 100%!");
      return;
    }

    setError(null);

    // Sanitasi: Hanya kirim data yang bermakna
    // Include Deep Learning context
    const kurikulumOptions = useKurikulumStore.getState().serializeForAPI();
    const activeSchoolId = useTeacherStore.getState().activeSchoolId;

    const payload = {
      ...formData,
      qty: Object.fromEntries(Object.entries(formData.qty).filter(([_, v]: any) => v > 0)),
      totalSoal,
      propMudah: formData.proporsi.mudah,
      propSedang: formData.proporsi.sedang,
      propSulit: formData.proporsi.sulit,
      kognitif: formData.activeLevels,
      kurikulumLabel: kurikulumData[formData.kurikulum]?.title || "Kurikulum Merdeka",
      // === DEEP LEARNING CONTEXT (Kerangka 8334) ===
      ...kurikulumOptions,
      // === SCHOOL CONTEXT ===
      school_id: activeSchoolId,
    };

    try {
      await onGenerate(payload);
    } catch (err: any) {
      setError(err.message || "Gagal membuat soal. Coba lagi.");
    }
  };

  const { mudah, sedang, sulit } = formData.proporsi;
  const { activeLevels } = formData;
  const activeCurriculum = kurikulumData[formData.kurikulum] || kurikulumData.merdeka;

  return (
    <aside className="w-full p-6 bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-[32px] lg:h-[calc(100vh-3rem)] lg:sticky lg:top-6 lg:overflow-y-auto shadow-[0_8px_32px_rgba(31,38,135,0.03)] text-slate-800">
      <h2 className="text-2xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 text-center">GuruPRO</h2>

      {/* === DEEP LEARNING MULTI-SCHOOL FEATURES === */}
      <SchoolSwitcher />

      <div className="rounded-[24px] p-5 border border-slate-100 bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-6 transition-all duration-300">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
          <i className="fa-solid fa-book-open text-indigo-500"></i> Pilih Kurikulum
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Object.entries(kurikulumData).map(([key, item]) => {
            const isActive = formData.kurikulum === key;
            return (
              <button
                type="button"
                key={key}
                onClick={() => updateField('kurikulum', key)}
                className={`curriculum-option cursor-pointer p-3.5 rounded-2xl border-2 transition-all duration-300 text-left ${
                  isActive
                    ? `${item.bgActive} ${item.borderActive} shadow-[0_8px_20px_rgba(99,102,241,0.08)] scale-[1.02] -translate-y-0.5`
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(0,0,0,0.03)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.iconBg} ${item.iconColor}`}>
                    <i className={`fa-solid ${item.icon} text-sm`}></i>
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-sm font-semibold text-slate-800 block truncate">{item.title}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{item.subtitle}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Dynamic Detail Panel */}
        <div className="transition-all duration-300">
          <div className={`${activeCurriculum.infoBg} border ${activeCurriculum.infoBorder} rounded-2xl p-4 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.01)]`}>
            <div className="flex items-start gap-2.5">
              <i className={`fa-solid fa-circle-info ${activeCurriculum.iconColor} mt-0.5 text-sm`}></i>
              <div>
                <p className={`text-xs font-bold ${activeCurriculum.textColor}`}>
                  {activeCurriculum.title === 'KBC' ? 'Kurikulum Berbasis Cinta (KBC)' : `Kurikulum ${activeCurriculum.title}`}
                </p>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{activeCurriculum.desc}</p>
                
                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {activeCurriculum.badges.map((badge, bIdx) => (
                    <span
                      key={bIdx}
                      className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-white border ${activeCurriculum.infoBorder} ${activeCurriculum.textColor}`}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === 8 DIMENSI PROFIL LULUSAN (Deep Learning) === */}
      {formData.kurikulum === 'merdeka' && (
        <div className="mb-4 space-y-2">
          <Dimensi8Selector />
          <TigaPengalamanSelector />
        </div>
      )}

      <div className="rounded-[24px] p-5 border border-slate-100 bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-6 transition-all duration-300">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
          <span className="text-indigo-500">🪪</span> Identitas Soal
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Jenjang</label>
            <select
              value={formData.jenjang}
              onChange={(e) => {
                const newJenjang = e.target.value;
                let defaultKelas = '1';
                if (newJenjang === 'SD') defaultKelas = '1';
                else if (newJenjang === 'SMP') defaultKelas = '7';
                else if (newJenjang === 'SMA' || newJenjang === 'SMK') defaultKelas = '10';
                
                setFormData((prev: any) => ({
                  ...prev,
                  jenjang: newJenjang,
                  kelas: defaultKelas
                }));
              }}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none"
            >
              <option value="SD">SD / MI</option>
              <option value="SMP">SMP / MTs</option>
              <option value="SMA">SMA / MA</option>
              <option value="SMK">SMK</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Kelas</label>
            <select value={formData.kelas} onChange={(e) => updateField('kelas', e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none">
              {getKelasOptions().map(k => <option key={k} value={String(k)}>Kelas {k}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Mata Pelajaran</label>
            <select 
              value={isMapelCustom ? 'custom' : formData.mapel}
              onChange={(e) => {
                const val = e.target.value;
                setIsMapelCustom(val === 'custom');
                updateField('mapel', val === 'custom' ? '' : val);
              }}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none"
            >
              <option value="">-- Pilih Mata Pelajaran --</option>
              <option>Bahasa Indonesia</option><option>Matematika</option><option>IPA</option><option>IPS</option>
              <option>IPAS (IPA & IPS)</option><option>PPKn</option><option>Pendidikan Pancasila</option>
              <option>Bahasa Inggris</option><option>PAI</option>
              <optgroup label="PAI Madrasah (MI/MTs/MA)">
                <option>Al-Qur'an Hadits</option><option>Aqidah Akhlak</option><option>Fiqih</option>
                <option>Sejarah Kebudayaan Islam (SKI)</option><option>Bahasa Arab</option>
              </optgroup>
              <option>PJOK</option><option>Seni Budaya</option><option>Informatika</option>
              <option>Fisika</option><option>Kimia</option><option>Biologi</option>
              <option>Ekonomi</option><option>Sosiologi</option><option>Geografi</option>
              <option>Sejarah</option><option>TSM (Teknik Sepeda Motor)</option>
              <option>TKJ (Teknik Komputer Jaringan)</option><option>Akuntansi Keuangan</option>
              <option>Perpajakan</option>
              <optgroup label="Muatan Lokal / Bahasa Daerah">
                <option>Bahasa Jawa</option><option>Bahasa Sunda</option><option>Bahasa Bali</option>
                <option>Bahasa Madura</option><option>Bahasa Minangkabau</option><option>Bahasa Bugis</option>
                <option>Bahasa Banjar</option><option>Bahasa Betawi</option><option>Bahasa Aceh</option>
                <option>Bahasa Batak</option><option>Bahasa Sasak</option><option>Bahasa Dayak</option>
                <option>Bahasa Gorontalo</option><option>Bahasa Lampung</option>
              </optgroup>
              <option value="custom">Lainnya (Ketik Sendiri)</option>
            </select>
            {isMapelCustom && <input type="text" value={formData.mapel} onChange={(e) => updateField('mapel', e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none mt-2" placeholder="Ketik nama mata pelajaran..." />}
          </div>

          {/* === PAI SPECIAL MODE === */}
          <div className="col-span-2">
            <PaiModeSelector
              isPaiSubject={
                formData.mapel === 'PAI' ||
                formData.mapel === 'Al-Qur\'an Hadits' ||
                formData.mapel === 'Aqidah Akhlak' ||
                formData.mapel === 'Fiqih' ||
                formData.mapel === 'Sejarah Kebudayaan Islam (SKI)' ||
                formData.mapel === 'Bahasa Arab'
              }
              kurikulum={formData.kurikulum}
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Topik/Materi <span className="text-red-500">*</span></label>
            <input type="text" value={formData.topik} onChange={(e) => updateField('topik', e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none" placeholder="Contoh: Teorema Pythagoras" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Tujuan Pembelajaran <span className="text-xs font-normal text-slate-400">(Opsional)</span></label>
            <input type="text" value={formData.tujuan} onChange={(e) => updateField('tujuan', e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none" placeholder="Contoh: Siswa mampu menjelaskan..." />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Bahasa Pengantar Soal <span className="text-xs font-normal text-slate-400">(Opsional)</span></label>
            <select value={formData.bahasa} onChange={(e) => updateField('bahasa', e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none">
              <option value="id">Indonesia (Bawaan)</option><option value="ar">Arab (Full Hijaiyah)</option><option value="en">Inggris (Full English)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] p-5 border border-slate-100 bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-6 transition-all duration-300">
        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
          📚 Materi Referensi <span className="text-xs font-normal text-gray-400">(Opsional)</span>
        </h3>
        <p className="text-xs text-gray-500 mb-4">💡 Jika tidak diisi, AI akan membuat soal berdasarkan topik.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => { setMateriTab('none'); setFileName(null); updateField('fileName', null); }} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${materiTab === 'none' ? 'bg-indigo-650 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>Tanpa Materi</button>
          <button type="button" onClick={() => { setMateriTab('pdf'); setFileName(null); updateField('fileName', null); }} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${materiTab === 'pdf' ? 'bg-indigo-650 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>PDF</button>
          <button type="button" onClick={() => { setMateriTab('txt'); setFileName(null); updateField('fileName', null); }} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${materiTab === 'txt' ? 'bg-indigo-650 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>TXT</button>
          <button type="button" onClick={() => { setMateriTab('manual'); setFileName(null); updateField('fileName', null); }} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${materiTab === 'manual' ? 'bg-indigo-650 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>Ketik Manual</button>
        </div>

        {/* Logic Upload File */}
        <input type="file" ref={pdfInputRef} onChange={handleFileChange} className="hidden" accept=".pdf" />
        <input type="file" ref={txtInputRef} onChange={handleFileChange} className="hidden" accept=".txt" />

        {materiTab === 'pdf' && (
          <div onClick={() => pdfInputRef.current?.click()} className="cursor-pointer p-5 border border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl bg-indigo-50/20 hover:bg-indigo-50/40 text-center text-xs text-indigo-650 font-bold transition-all duration-200 hover:scale-[1.01]">
            {fileName || "Klik untuk upload PDF"}
          </div>
        )}
        {materiTab === 'txt' && (
          <div onClick={() => txtInputRef.current?.click()} className="cursor-pointer p-5 border border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl bg-indigo-50/20 hover:bg-indigo-50/40 text-center text-xs text-indigo-650 font-bold transition-all duration-200 hover:scale-[1.01]">
            {fileName || "Klik untuk upload TXT"}
          </div>
        )}
        {materiTab === 'manual' && <textarea rows={4} value={formData.materiManual || ''} onChange={(e) => updateField('materiManual', e.target.value)} className="w-full p-3.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none" placeholder="Ketik materi di sini..."></textarea>}
      </div>

      {/* Konfigurasi Soal */}
      <div className="rounded-[24px] p-5 border border-slate-100 bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-6 transition-all duration-300">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">⚙️ Konfigurasi Soal</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Jenis Asesmen</label>
            <select value={formData.jenisAsesmen} onChange={(e) => updateField('jenisAsesmen', e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none">
              <optgroup label="📖 Kurikulum Merdeka"><option>Sumatif Harian</option><option>Sumatif Tengah Semester (STS)</option><option>Sumatif Akhir Semester (SAS)</option><option>Sumatif Akhir Tahun (SAT)</option></optgroup>
              <optgroup label="📘 K13 / Umum"><option>Ulangan Harian (UH)</option><option>Penilaian Tengah Semester (PTS)</option><option>Penilaian Akhir Semester (PAS)</option><option>Penilaian Akhir Tahun (PAT)</option></optgroup>
              <optgroup label="📊 ANBK / Asesmen Nasional"><option>ANBK - AKM Literasi</option><option>ANBK - AKM Numerasi</option></optgroup>
              <optgroup label="📌 Lainnya"><option>Ujian Sekolah (US)</option><option>Ujian Praktik</option><option>Try Out</option><option>Latihan Soal / Kuis</option></optgroup>
            </select>
          </div>
          <div className="col-span-1">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Opsi (PG)</label>
            <select value={formData.opsiPG} onChange={(e) => updateField('opsiPG', e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none">
              <option value="3">3 Opsi A-C</option>
              <option value="4">4 Opsi A-D</option>
              <option value="5">5 Opsi A-E</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Pendekatan Soal</label>
            <select value={formData.pendekercatan || formData.pendekatan} onChange={(e) => updateField('pendekatan', e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 focus:outline-none">
              <option value="standar">Standar / Kurikuler</option>
              <option value="literasi">Literasi - AKM</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jumlah Per Tipe Soal */}
      <div className="rounded-[24px] p-5 border border-slate-100 bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-6 transition-all duration-300">
        <label className="text-xs font-medium text-gray-500 mb-2 block flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Jumlah Per Tipe Soal</h3>
          <span id="total-soal-badge" className="px-2.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold">Total: {totalSoal}</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 hover:bg-slate-100/80 rounded-2xl p-2.5 border border-slate-100/50 transition-all duration-200">
            <label className="text-[10px] text-slate-500 block mb-1 font-bold">Pilihan Ganda</label>
            <input type="number" value={formData.qty.pg} min="0" max="50" onChange={(e) => updateQty('pg', e.target.value)} className="w-full bg-transparent px-1 py-1 text-sm text-center font-black text-slate-800 focus:text-indigo-650 outline-none transition-colors" />
          </div>
          <div className="bg-slate-50 hover:bg-slate-100/80 rounded-2xl p-2.5 border border-slate-100/50 transition-all duration-200">
            <label className="text-[10px] text-slate-500 block mb-1 font-bold">Isian Singkat</label>
            <input type="number" value={formData.qty.isian} min="0" max="50" onChange={(e) => updateQty('isian', e.target.value)} className="w-full bg-transparent px-1 py-1 text-sm text-center font-black text-slate-800 focus:text-indigo-650 outline-none transition-colors" />
          </div>
          <div className="bg-slate-50 hover:bg-slate-100/80 rounded-2xl p-2.5 border border-slate-100/50 transition-all duration-200">
            <label className="text-[10px] text-slate-500 block mb-1 font-bold">Essay/Uraian</label>
            <input type="number" value={formData.qty.essay} min="0" max="50" onChange={(e) => updateQty('essay', e.target.value)} className="w-full bg-transparent px-1 py-1 text-sm text-center font-black text-slate-800 focus:text-indigo-650 outline-none transition-colors" />
          </div>
          <div className="bg-indigo-50/50 hover:bg-indigo-50 rounded-2xl p-2.5 border border-indigo-100 transition-all duration-200">
            <label className="text-[10px] text-indigo-700 block mb-1 font-bold">PG Kompleks</label>
            <input type="number" value={formData.qty.pgKompleks} min="0" max="50" onChange={(e) => updateQty('pgKompleks', e.target.value)} className="w-full bg-transparent px-1 py-1 text-sm text-center font-black text-indigo-850 focus:text-indigo-650 outline-none transition-colors" />
          </div>
          <div className="bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-2.5 border border-emerald-100 transition-all duration-200">
            <label className="text-[10px] text-emerald-700 block mb-1 font-bold">Benar/Salah</label>
            <input type="number" value={formData.qty.bs} min="0" max="50" onChange={(e) => updateQty('bs', e.target.value)} className="w-full bg-transparent px-1 py-1 text-sm text-center font-black text-emerald-850 focus:text-emerald-650 outline-none transition-colors" />
          </div>
          <div className="bg-purple-50/50 hover:bg-purple-50 rounded-2xl p-2.5 border border-purple-100 transition-all duration-200">
            <label className="text-[10px] text-purple-700 block mb-1 font-bold">Menjodohkan</label>
            <input type="number" value={formData.qty.jodoh} min="0" max="50" onChange={(e) => updateQty('jodoh', e.target.value)} className="w-full bg-transparent px-1 py-1 text-sm text-center font-black text-purple-850 focus:text-purple-650 outline-none transition-colors" />
          </div>
          <div className="bg-amber-50/50 hover:bg-amber-50 rounded-2xl p-2.5 border border-amber-100 transition-all duration-200">
            <label className="text-[10px] text-amber-700 block mb-1 font-bold">Urutan</label>
            <input type="number" value={formData.qty.urutan} min="0" max="50" onChange={(e) => updateQty('urutan', e.target.value)} className="w-full bg-transparent px-1 py-1 text-sm text-center font-black text-amber-850 focus:text-amber-650 outline-none transition-colors" />
          </div>
          <div className="bg-cyan-50/50 hover:bg-cyan-50 rounded-2xl p-2.5 border border-cyan-100 transition-all duration-200">
            <label className="text-[10px] text-cyan-700 block mb-1 font-bold">Isi Tabel</label>
            <input type="number" value={formData.qty.tabel} min="0" max="50" onChange={(e) => updateQty('tabel', e.target.value)} className="w-full bg-transparent px-1 py-1 text-sm text-center font-black text-cyan-850 focus:text-cyan-650 outline-none transition-colors" />
          </div>
          <div className="bg-rose-50/50 hover:bg-rose-50 rounded-2xl p-2.5 border border-rose-100 transition-all duration-200">
            <label className="text-[10px] text-rose-700 block mb-1 font-bold">Sebab-Akibat</label>
            <input type="number" value={formData.qty.sebabAkibat} min="0" max="50" onChange={(e) => updateQty('sebabAkibat', e.target.value)} className="w-full bg-transparent px-1 py-1 text-sm text-center font-black text-rose-850 focus:text-rose-650 outline-none transition-colors" />
          </div>
        </div>
      </div>

      {/* Proporsi Kesulitan */}
      <div className="rounded-[24px] p-5 border border-slate-100 bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-6 transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-sm">Proporsi Tingkat Kesulitan Soal</h3>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${totalProporsi === 100 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>{totalProporsi}%</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Mudah', val: mudah, set: (val: number) => updateProporsi('mudah', String(val)), color: 'emerald' },
            { label: 'Sedang', val: sedang, set: (val: number) => updateProporsi('sedang', String(val)), color: 'blue' },
            { label: 'Sulit', val: sulit, set: (val: number) => updateProporsi('sulit', String(val)), color: 'rose' }
          ].map((item) => (
            <div key={item.label} className={`bg-${item.color}-50/50 hover:bg-${item.color}-50 rounded-2xl p-2.5 border border-${item.color}-100 transition-all duration-200`}>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">{item.label}</label>
              <input type="number" value={item.val} onChange={(e) => item.set(Number(e.target.value) || 0)} className="w-full bg-transparent text-center font-black text-sm text-slate-800 outline-none" />
            </div>
          ))}
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full mt-4 flex overflow-hidden">
          <div className="bg-emerald-400" style={{ width: `${mudah}%` }}></div>
          <div className="bg-blue-400" style={{ width: `${sedang}%` }}></div>
          <div className="bg-rose-400" style={{ width: `${sulit}%` }}></div>
        </div>
      </div>
      
      {/* Level Kognitif */}
      <div className="rounded-[24px] p-5 border border-slate-100 bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-6 transition-all duration-300">
        <h3 className="font-bold text-slate-800 text-sm mb-1">Level Kognitif - Taksonomi Bloom</h3>
        <p className="text-[10px] text-gray-500 mb-4">(LOTS: C1-C3, HOTS: C4-C6)</p>
        <div className="grid grid-cols-6 gap-1" id="kognitif-container">
          {[
            { id: 'C1', label: 'Mengingat' },
            { id: 'C2', label: 'Memahami' },
            { id: 'C3', label: 'Menerapkan' },
            { id: 'C4', label: 'Menganalisis' },
            { id: 'C5', label: 'Mengevaluasi' },
            { id: 'C6', label: 'Mencipta' }
          ].map((item) => {
            const isActive = activeLevels.includes(item.id);
            return (
              <button 
                type="button"
                key={item.id} 
                className="flex flex-col items-center cursor-pointer focus:outline-none" 
                onClick={() => toggleKognitif(item.id)}
              >
                <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold transition-all duration-300 
                  ${isActive 
                    ? 'bg-gradient-to-r from-indigo-650 to-violet-600 text-white border-transparent shadow-md shadow-indigo-500/20 scale-105' 
                    : 'bg-white text-slate-650 border-slate-200 hover:border-indigo-400 hover:scale-105'}`}
                >
                  {item.id}
                </div>
                <span className="text-[8px] text-gray-500 mt-1 text-center truncate w-full">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
 
      {/* Visual & Multimedia */}
      <div className="rounded-[24px] p-5 border border-slate-100 bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-6 transition-all duration-300">
        <label className="text-xs font-medium text-gray-500 mb-3 block flex items-center justify-between">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">📚 Visual & Multimedia</h3>
          <span className="text-xs font-normal text-gray-400">(Opsional)</span>
        </label>
        <div className="space-y-3">
          {[
            { key: 'ilustrasi', label: 'Soal dengan Ilustrasi AI', desc: 'Gambar ilustrasi', bg: 'purple' },
            { key: 'diagram', label: 'Soal dengan Diagram/Grafik', desc: 'Data visual', bg: 'green' },
            { key: 'mindmap', label: 'Soal Peta Konsep', desc: 'Melengkapi peta konsep', bg: 'amber' }
          ].map(item => {
            const hasQty = (formData.qty[item.key] || 0) > 0;
            const typeLabelsLocalMap: { [key: string]: string } = {
              pg: "PG",
              isian: "Isian",
              essay: "Essay",
              pgKompleks: "PG Komp.",
              bs: "B/S",
              jodoh: "Jodoh",
              urutan: "Urutan",
              tabel: "Tabel",
              sebabAkibat: "S/A"
            };

            return (
              <div key={item.key} className={`flex flex-col p-3 bg-${item.bg}-50 border border-${item.bg}-100 rounded-xl`}>
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1">
                    <p className={`text-xs font-semibold text-${item.bg}-700`}>{item.label}</p>
                    <p className={`text-[9px] text-${item.bg}-500`}>{item.desc}</p>
                  </div>
                  <input type="number" value={formData.qty[item.key]} min="0" max="50" onChange={(e) => updateQty(item.key, e.target.value)} className="w-16 px-2 py-2 border border-slate-200 rounded-xl text-sm text-center font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white transition-all duration-200 shrink-0" />
                </div>

                {hasQty && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-200/50">
                    <p className="text-[9px] font-bold text-slate-500 mb-1.5">Terapkan pada tipe soal:</p>
                    <div className="flex flex-wrap gap-1">
                      {questionTypeKeys.map((typeKey) => {
                        const count = formData.qty[typeKey] || 0;
                        if (count === 0) return null;
                        const isSelected = formData.visualMapping?.[item.key]?.includes(typeKey);
                        return (
                          <button
                            type="button"
                            key={typeKey}
                            onClick={() => {
                              const currentList = formData.visualMapping?.[item.key] || [];
                              const updatedList = isSelected
                                ? currentList.filter((t: string) => t !== typeKey)
                                : [...currentList, typeKey];
                              setFormData((prev: any) => ({
                                ...prev,
                                visualMapping: {
                                  ...prev.visualMapping,
                                  [item.key]: updatedList
                                }
                              }));
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[8px] font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 border-transparent text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {typeLabelsLocalMap[typeKey] || typeKey}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-100">
        <button 
          type="button"
          onClick={generateSoal}
          disabled={isLoading}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 active:scale-98 flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Memproses AI...
            </>
          ) : (
            <>
              <span>✨ Buat Soal Otomatis</span>
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 bg-red-50 border-2 border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium">
            ⚠️ {error}
          </div>
        )}
      </div>
    </aside>
  );
}