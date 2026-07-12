"use client";

import { useState, useCallback } from "react";
import {
  importedSoalSchema,
  csvRowToSoal,
  parseCSV,
  questionTypes,
  type ImportResult,
} from "@/lib/schemas/soal-import";

interface ImportSoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (soalList: any[], merge: boolean) => void;
  existingCount: number;
}

export default function ImportSoalModal({
  isOpen,
  onClose,
  onImport,
  existingCount,
}: ImportSoalModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [mergeMode, setMergeMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, []);

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setImportResult(null);

    try {
      const content = await selectedFile.text();
      const rows = parseCSV(content);

      const soalList: any[] = [];
      const errors: ImportResult["errors"] = [];

      rows.forEach((row, index) => {
        const { soal, error } = csvRowToSoal(row, index);
        if (error) {
          errors.push({ row: index + 1, message: error });
        } else if (soal) {
          // Validate with Zod
          const validation = importedSoalSchema.safeParse(soal);
          if (validation.success) {
            soalList.push(validation.data);
          } else {
            const zodError = validation.error as { issues?: Array<{ message: string }> };
            errors.push({
              row: index + 1,
              message: zodError.issues?.map(e => e.message).join(", ") || "Validation failed",
              data: soal,
            });
          }
        }
      });

      const result: ImportResult = {
        success: errors.length === 0,
        total: rows.length,
        imported: soalList.length,
        failed: errors.length,
        errors,
        soal: soalList,
      };

      setImportResult(result);
      setPreview(soalList.slice(0, 5)); // Show first 5 as preview
    } catch (error: any) {
      setImportResult({
        success: false,
        total: 0,
        imported: 0,
        failed: 1,
        errors: [{ row: 0, message: `Gagal membaca file: ${error.message}` }],
        soal: [],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    if (importResult && importResult.soal.length > 0) {
      onImport(importResult.soal, mergeMode);
      onClose();
      resetState();
    }
  };

  const resetState = () => {
    setFile(null);
    setPreview([]);
    setImportResult(null);
    setMergeMode(true);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  const typeLabels: Record<string, string> = {
    "pg": "Pilihan Ganda",
    "isian": "Isian Singkat",
    "essay": "Essay",
    "pg-kompleks": "PG Kompleks",
    "bs": "Benar/Salah",
    "jodoh": "Menjodohkan",
    "urutan": "Urutan",
    "tabel": "Tabel",
    "sebab-akibat": "Sebab-Akibat",
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-3xl">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              📥 Import Soal dari File
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Format yang didukung: CSV, XLSX
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* File Drop Zone */}
          {!file && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
                ${isDragging
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
                }
              `}
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <div className="text-4xl mb-3">📁</div>
                <p className="text-sm font-bold text-slate-700">
                  Drag & drop file di sini
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  atau klik untuk memilih file
                </p>
                <p className="text-[10px] text-slate-400 mt-3">
                  CSV: pertanyaan,tipe,opsi_a,opsi_b,opsi_c,opsi_d,kunci,...
                </p>
              </label>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin text-4xl mb-3">⏳</div>
              <p className="text-sm font-semibold text-slate-600">Memproses file...</p>
            </div>
          )}

          {/* File Info & Result */}
          {file && importResult && (
            <div className="space-y-4">
              {/* File Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📄</span>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetState}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold"
                >
                  Ganti File
                </button>
              </div>

              {/* Import Summary */}
              <div className={`rounded-xl p-4 ${importResult.success ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={importResult.success ? "text-emerald-600" : "text-amber-600"}>
                    {importResult.success ? "✅" : "⚠️"}
                  </span>
                  <span className={`text-sm font-bold ${importResult.success ? "text-emerald-800" : "text-amber-800"}`}>
                    {importResult.success ? "Import berhasil" : "Import dengan peringatan"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-white/60 rounded-lg p-2 text-center">
                    <p className="text-slate-500">Total Baris</p>
                    <p className="text-lg font-black text-slate-800">{importResult.total}</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2 text-center">
                    <p className="text-slate-500">Berhasil</p>
                    <p className="text-lg font-black text-emerald-600">{importResult.imported}</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2 text-center">
                    <p className="text-slate-500">Gagal</p>
                    <p className="text-lg font-black text-rose-600">{importResult.failed}</p>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 max-h-32 overflow-y-auto">
                  <p className="text-xs font-bold text-rose-800 mb-2">Errors:</p>
                  {importResult.errors.slice(0, 5).map((err, idx) => (
                    <p key={idx} className="text-[10px] text-rose-700">
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                  {importResult.errors.length > 5 && (
                    <p className="text-[10px] text-rose-600 mt-1">
                      ...dan {importResult.errors.length - 5} error lainnya
                    </p>
                  )}
                </div>
              )}

              {/* Preview */}
              {preview.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-600 mb-2">
                    Preview ({Math.min(5, preview.length)} dari {importResult.imported} soal):
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {preview.map((soal, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-700">{idx + 1}.</span>
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                            {typeLabels[soal.tipe] || soal.tipe}
                          </span>
                          {soal.tingkat && (
                            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                              {soal.tingkat}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 line-clamp-2">{soal.pertanyaan}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Options */}
              {importResult.imported > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-600">Opsi Import:</p>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${mergeMode ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={mergeMode}
                        onChange={() => setMergeMode(true)}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-700">Gabungkan</p>
                        <p className="text-xs text-slate-500">
                          Tambah {importResult.imported} soal ke {existingCount} soal yang ada
                        </p>
                      </div>
                    </label>
                    <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${!mergeMode ? "border-rose-500 bg-rose-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={!mergeMode}
                        onChange={() => setMergeMode(false)}
                        className="w-4 h-4 text-rose-600"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-700">Ganti Semua</p>
                        <p className="text-xs text-slate-500">
                          Hapus semua soal lama, import {importResult.imported} soal baru
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-3xl">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleImport}
            disabled={!importResult || importResult.imported === 0}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center gap-2"
          >
            📥 Import {importResult?.imported || 0} Soal
          </button>
        </div>
      </div>
    </div>
  );
}
