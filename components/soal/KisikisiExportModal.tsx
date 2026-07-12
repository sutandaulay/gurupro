"use client";

import { useState, useEffect } from "react";
import {
  defaultKisikisiOptions,
  KisikisiOptions,
  MetaInfo,
  generateKisikisiHTML,
  downloadKisikisiPdf,
  downloadKisikisiWord,
} from "@/lib/export/kisikisi-generator";

interface KisikisiExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  soalList: any[];
  metaInfo: MetaInfo;
  onExportPdf: (html: string) => void;
  onExportWord: (html: string) => void;
}

export default function KisikisiExportModal({
  isOpen,
  onClose,
  soalList,
  metaInfo,
  onExportPdf,
  onExportWord,
}: KisikisiExportModalProps) {
  const [options, setOptions] = useState<KisikisiOptions>(defaultKisikisiOptions);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (isOpen && metaInfo?.namaGuru) {
      setOptions((prev) => ({
        ...prev,
        signatureName: prev.signatureName || metaInfo.namaGuru || "",
      }));
    }
  }, [isOpen, metaInfo?.namaGuru]);

  if (!isOpen) return null;

  const handleExportPdf = () => {
    const html = generateKisikisiHTML(soalList, metaInfo, options);
    onExportPdf(html);
    onClose();
  };

  const handleExportWord = () => {
    const html = generateKisikisiHTML(soalList, metaInfo, options);
    onExportWord(html);
    onClose();
  };

  const toggleOption = (key: keyof KisikisiOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-3xl">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              📋 Export Kisi-Kisi Ujian
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {soalList.length} soal tersedia untuk di-export
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Format Selection */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-2">
              Pilih Kolom yang Akan Ditampilkan
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "includeTipe", label: "Tipe Soal" },
                { key: "includeMateri", label: "Materi Pokok" },
                { key: "includeCP", label: "Capaian Pembelajaran" },
                { key: "includeTP", label: "Tujuan Pembelajaran" },
                { key: "includeIndikator", label: "Indikator" },
                { key: "includeLevel", label: "Level Bloom" },
                { key: "includeKesulitan", label: "Tingkat Kesukaran" },
                { key: "includeKunci", label: "Kunci Jawaban" },
                { key: "includeSkor", label: "Skor" },
                { key: "includeSchoolHeader", label: "Header Sekolah" },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition border border-slate-100"
                >
                  <input
                    type="checkbox"
                    checked={options[item.key as keyof KisikisiOptions] as boolean}
                    onChange={() => toggleOption(item.key as keyof KisikisiOptions)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Signature Info */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-600 block">
              Informasi Tanda Tangan
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Nama Guru</label>
                <input
                  type="text"
                  value={options.signatureName}
                  onChange={(e) => setOptions((prev) => ({ ...prev, signatureName: e.target.value }))}
                  placeholder="Nama lengkap guru"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Tanggal</label>
                <input
                  type="text"
                  value={options.signatureDate}
                  onChange={(e) => setOptions((prev) => ({ ...prev, signatureDate: e.target.value }))}
                  placeholder="Contoh: 15 Januari 2025"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs text-amber-800">
              <span className="font-bold">ℹ️ Info:</span> File PDF akan menggunakan orientasi landscape
              untuk accommodate semua kolom yang dipilih.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-3xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleExportPdf}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer flex items-center gap-2"
          >
            📄 Export PDF
          </button>
          <button
            onClick={handleExportWord}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-100 cursor-pointer flex items-center gap-2"
          >
            📝 Export Word
          </button>
        </div>
      </div>
    </div>
  );
}
