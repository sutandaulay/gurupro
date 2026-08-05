'use client';
import { apiFetch } from "@/lib/api-client";

import React, { useState } from 'react';
import { useTeacherStore, useKurikulumStore } from '@/lib/stores';
import dynamic from 'next/dynamic';
import PoinHabisModal from '@/app/components/ui/PoinHabisModal';

export default function ProtaPage() {
  const {
    activeSchoolId,
    getActiveSchool,
    getActiveKurikulum,
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
    topik: '',
  });

  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertMarkdownToHtml = (md: string): string => {
    if (!md) return "";
    let html = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="rounded-xl max-w-full my-3 shadow-sm border border-slate-200 mx-auto block" />')
      .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-slate-800 mt-3 mb-1.5">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-slate-800 border-b border-slate-200 pb-1 mt-4 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-slate-900 border-b-2 border-slate-300 pb-1.5 mt-5 mb-3 uppercase text-center">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li class="list-disc ml-5 my-0.5 text-xs">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="list-decimal ml-5 my-0.5 text-xs">$2</li>')
      .replace(/\n\n/g, "</p><p class='my-1.5 text-xs text-justify text-slate-700'>")
      .replace(/\n/g, "<br>");
    html = html.replace(/(<li class="list-disc ml-5 my-0.5 text-xs">.*?<\/li>\n?)+/g, '<ul class="my-2 ml-1">$&</ul>');
    html = html.replace(/(<li class="list-decimal ml-5 my-0.5 text-xs">.*?<\/li>\n?)+/g, '<ol class="my-2 ml-1">$&</ol>');
    html = html.replace(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g, (match: string, header: string, body: string) => {
      const headerCells = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th class="border border-slate-300 px-2 py-1 bg-slate-100 font-semibold text-xs text-center">${c.trim()}</th>`).join('');
      const headerRow = `<tr>${headerCells}</tr>`;
      const bodyRows = body.trim().split('\n').map((row: string) => {
        const cells = row.split('|').filter((c: string) => c.trim() !== undefined).slice(1, -1).map((c: string) => `<td class="border border-slate-300 px-2 py-1 text-xs">${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<table class="w-full border-collapse border border-slate-300 my-3 text-xs"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
    });
    return `<div class="text-xs text-slate-700 leading-relaxed font-sans">${html}</div>`;
  };

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
      const res = await apiFetch('/api/generate-prota', {
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
          topik: formData.topik,
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
          setError(err.error || 'Gagal generate Prota');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl">
              📋
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Program Tahunan (Prota)</h1>
              <p className="text-sm text-slate-500">Deep Learning </p>
            </div>
          </div>

          {activeSchool && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
              🏫 {activeSchool.nama_sekolah}
              {activeSchool.npsn && ` (NPSN: ${activeSchool.npsn})`}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4">📝 Konfigurasi Prota</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Jenjang</label>
                  <select
                    value={formData.jenjang}
                    onChange={(e) => setFormData(f => ({ ...f, jenjang: e.target.value }))}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
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
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
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
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Kelas</label>
                  <select
                    value={formData.kelas}
                    onChange={(e) => setFormData(f => ({ ...f, kelas: e.target.value }))}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
                  >
                    <option value="all">Semua Kelas</option>
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
                  <label className="text-xs font-medium text-slate-500 block mb-1">Topik / Bab Utama</label>
                  <input
                    type="text"
                    value={formData.topik}
                    onChange={(e) => setFormData(f => ({ ...f, topik: e.target.value }))}
                    placeholder="Contoh: Aljabar, Trigonometri"
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
                  />
                </div>

                {/* 8 Dimensi Info */}
                {selectedDimensi8.length > 0 && (
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <p className="text-[10px] font-bold text-indigo-700 mb-1">✨ 8 Dimensi Terpilih:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedDimensi8.slice(0, 3).map((d: string) => (
                        <span key={d} className="px-1.5 py-0.5 bg-indigo-200 text-indigo-700 rounded text-[10px]">{d}</span>
                      ))}
                      {selectedDimensi8.length > 3 && (
                        <span className="text-[10px] text-indigo-500">+{selectedDimensi8.length - 3} lagi</span>
                      )}
                    </div>
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
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
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
                    '🤖 Hasilkan Prota dengan AI'
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
                  <span className="text-6xl mb-4">📋</span>
                  <p className="text-lg font-semibold">Prota Belum Dibuat</p>
                  <p className="text-sm">Isi form di kiri dan klik Hasilkan</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                    <div>
                      <h3 className="font-bold text-slate-800">{result.judul}</h3>
                      <p className="text-xs text-slate-500">
                        {activeSchool?.nama_sekolah} • {formData.mapel} • {formData.kurikulum}
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
                        printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${result.judul || 'PROTA'}</title><style>@page{margin:25mm 20mm 20mm 30mm;size:A4;}*{box-sizing:border-box;}body{font-family:'Times New Roman',Times,serif;font-size:11pt;color:#000;line-height:1.6;padding:0;margin:0;}h1{font-size:16pt;text-align:center;margin:0 0 6pt;text-transform:uppercase;font-weight:bold;}h2{font-size:14pt;margin:16pt 0 8pt;font-weight:bold;border-bottom:1.5px solid #1e3a8a;padding-bottom:2pt;}p{margin:6pt 0;text-align:justify;}.page-footer{position:fixed;bottom:15mm;right:20mm;font-size:9pt;color:#666;}</style></head><body><h1>${activeSchool?.nama_sekolah || 'GuruPRO'}</h1><p style="text-align:center;font-size:10pt;color:#555;">${formData.mapel} • ${formData.kurikulum} • Kelas ${formData.kelas}</p><hr style="border:1.5px solid #000;margin:8pt 0 16pt;"><div>${bodyHtml}</div><div class="page-footer">Halaman <span style="mso-field-code:' PAGE \\* MERGEFORMAT '"></span> dari <span style="mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span></div><script>window.onload=function(){window.print();}</script></body></html>`);
                        printWindow.document.close();
                      }}
                      className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition"
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

                  <div className="prose max-w-none overflow-x-auto">
                    <div dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(result.konten || '') }} />
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
