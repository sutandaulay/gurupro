'use client';
import { apiFetch } from "@/lib/api-client";

import React, { useState } from 'react';
import { useTeacherStore, useKurikulumStore } from '@/lib/stores';
import dynamic from 'next/dynamic';
import PoinHabisModal from '@/app/components/ui/PoinHabisModal';
import RichMarkdown from '@/components/ai/RichMarkdown';

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

  // Token Modal State
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenShortfall, setTokenShortfall] = useState(0);

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
      const res = await apiFetch('/api/generate-prosem', {
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
        // Check if token error
        if (err.reason === "token_habis" || err.reason === "subscription_expired") {
          setShowTokenModal(true);
          setTokenShortfall(1);
          setError("Poin habis. Silakan top-up atau upgrade paket.");
        } else {
          setError(err.error || 'Gagal generate Prosem');
        }
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
              <p className="text-sm text-slate-500">Deep Learning </p>
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
                      Memproses...
                    </span>
                  ) : (
                    '🤖 Hasilkan Prosem dengan AI'
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
                  <p className="text-sm">Isi form di kiri dan klik Hasilkan</p>
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
                      onClick={() => {
                        const printWindow = window.open("", "_blank");
                        if (!printWindow) return;
                        const md = result.konten || '';
                        let bodyHtml = md
                          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.+?)\*/g, '<em>$1</em>')
                          .replace(/^### (.+)$/gm, '<h3 style="font-family:Times New Roman,serif;font-size:13pt;color:#1e293b;margin-top:12pt;margin-bottom:4pt;font-weight:bold;">$1</h3>')
                          .replace(/^## (.+)$/gm, '<h2 style="font-family:Times New Roman,serif;font-size:15pt;color:#1e3a8a;margin-top:18pt;margin-bottom:6pt;border-bottom:1.5px solid #1e3a8a;padding-bottom:2pt;font-weight:bold;">$1</h2>')
                          .replace(/^# (.+)$/gm, '<h1 style="font-family:Times New Roman,serif;font-size:18pt;color:#1e3a8a;text-align:center;margin-top:24pt;margin-bottom:12pt;text-transform:uppercase;font-weight:bold;">$1</h1>')
                          .replace(/^- (.+)$/gm, '<li style="font-family:Times New Roman,serif;font-size:11pt;color:#334155;margin-left:20pt;margin-bottom:4pt;line-height:1.6;">$1</li>')
                          .replace(/^(\d+)\. (.+)$/gm, '<li style="font-family:Times New Roman,serif;font-size:11pt;color:#334155;margin-left:20pt;margin-bottom:4pt;line-height:1.6;list-style:decimal;">$2</li>')
                          .replace(/\n\n/g, "</p><p style='font-family:Times New Roman,serif;font-size:11pt;color:#334155;line-height:1.6;text-align:justify;margin:6pt 0;'>")
                          .replace(/\n/g, "<br>");
                        bodyHtml = bodyHtml.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, (m) => `<ul style='margin:6pt 0;padding-left:20pt;'>${m}</ul>`);
                        bodyHtml = bodyHtml.replace(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g, (match: string, header: string, body: string) => {
                          const headerCells = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th style="border:1px solid #000;padding:4pt 6pt;background:#f3f4f6;font-weight:bold;text-align:center;font-size:10pt;">${c.trim()}</th>`).join('');
                          const bodyRows = body.trim().split('\n').map((row: string) => {
                            const cells = row.split('|').filter((c: string) => c.trim() !== undefined).slice(1, -1).map((c: string) => `<td style="border:1px solid #000;padding:4pt 6pt;font-size:10pt;">${c.trim()}</td>`).join('');
                            return `<tr>${cells}</tr>`;
                          }).join('');
                          return `<table style="width:100%;border-collapse:collapse;margin:8pt 0;font-family:Times New Roman,serif;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
                        });
                        printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${result.judul || 'PROSEM'}</title><style>@page{margin:25mm 20mm 20mm 30mm;size:A4;}*{box-sizing:border-box;}body{font-family:'Times New Roman',Times,serif;font-size:11pt;color:#000;line-height:1.6;padding:0;margin:0;}h1{font-size:16pt;text-align:center;margin:0 0 6pt;text-transform:uppercase;font-weight:bold;}h2{font-size:14pt;margin:16pt 0 8pt;font-weight:bold;border-bottom:1.5px solid #1e3a8a;padding-bottom:2pt;}p{margin:6pt 0;text-align:justify;}.page-footer{position:fixed;bottom:15mm;right:20mm;font-size:9pt;color:#666;}</style></head><body><h1>${activeSchool?.nama_sekolah || 'GuruPRO'}</h1><p style="text-align:center;font-size:10pt;color:#555;">${formData.mapel} • Semester ${formData.semester} • ${formData.minggu_efektif} Minggu Efektif</p><hr style="border:1.5px solid #000;margin:8pt 0 16pt;"><div>${bodyHtml}</div><div class="page-footer">Halaman <span style="mso-field-code:' PAGE \\* MERGEFORMAT '"></span> dari <span style="mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span></div><script>window.onload=function(){window.print();}</script></body></html>`);
                        printWindow.document.close();
                      }}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition"
                    >
                      🖨️ Print
                    </button>
                  </div>

                  {/* Download links */}
                  {(result.pdf_url || result.docx_url) && (
                    <div className="mb-4 p-4 bg-white border border-slate-200 rounded-2xl flex flex-col gap-2 text-xs font-bold font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Unduh Berkas Dokumen:</span>
                        <span className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[10px] font-semibold">
                          ✓ Tersimpan di Storage Saya
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
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
                    </div>
                  )}

                  <RichMarkdown content={result.konten || ''} />
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
