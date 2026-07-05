'use client';

import React, { useState } from 'react';
import { useKurikulumStore } from '@/lib/stores';

interface PaiModeSelectorProps {
  isPaiSubject?: boolean;
  kurikulum?: string;
}

export default function PaiModeSelector({ isPaiSubject = false, kurikulum = '' }: PaiModeSelectorProps) {
  const {
    paiModeEnabled,
    setPaiModeEnabled,
    paiIntegration,
    setPaiIntegration,
  } = useKurikulumStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const showPanel = isPaiSubject || kurikulum === 'kbc';

  if (!showPanel) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/50 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-amber-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🕌</span>
          <div>
            <h4 className="text-sm font-bold text-amber-800">
              Mode Guru PAI
            </h4>
            <p className="text-[10px] text-amber-500">
              {paiModeEnabled ? 'Aktif' : 'Nonaktif'} • Referensi: Kepka BKPDM No. 020/2026
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {paiModeEnabled ? (
            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full font-bold">
              {paiIntegration === 'hybrid_kbc' ? 'HYBRID KBC' : 'SPIRITUAL'}
            </span>
          ) : null}
          <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-xs text-amber-400`}></i>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200">
            <div>
              <p className="text-xs font-semibold text-slate-700">Aktifkan Mode PAI</p>
              <p className="text-[10px] text-slate-500">Integrasi nilai spiritual &amp; karakter Islami</p>
            </div>
            <button
              type="button"
              onClick={() => setPaiModeEnabled(!paiModeEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                paiModeEnabled ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  paiModeEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {paiModeEnabled && (
            <>
              {/* Integration Mode Selection */}
              <div>
                <p className="text-[10px] font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                  Tipe Integrasi
                </p>
                <div className="space-y-2">
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border ${
                      paiIntegration === 'none'
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-white border-slate-200 hover:border-amber-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pai-integration"
                      checked={paiIntegration === 'none'}
                      onChange={() => setPaiIntegration('none')}
                      className="w-4 h-4 text-amber-600 focus:ring-amber-400"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-700">Standar</span>
                      <p className="text-[10px] text-slate-500">Modul Ajar PAI biasa tanpa integrasi khusus</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border ${
                      paiIntegration === 'spiritual_only'
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-white border-slate-200 hover:border-emerald-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pai-integration"
                      checked={paiIntegration === 'spiritual_only'}
                      onChange={() => setPaiIntegration('spiritual_only')}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-400"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-700">Integrasi Nilai Spiritual</span>
                      <p className="text-[10px] text-slate-500">Nilai Imtaq, Akhlak, Hablumminallah, Habluminannas</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border ${
                      paiIntegration === 'hybrid_kbc'
                        ? 'bg-purple-50 border-purple-300'
                        : 'bg-white border-slate-200 hover:border-purple-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pai-integration"
                      checked={paiIntegration === 'hybrid_kbc'}
                      onChange={() => setPaiIntegration('hybrid_kbc')}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-400"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-700">🔗 Hybrid KBC (Recommended)</span>
                      <p className="text-[10px] text-slate-500">
                        Kurikulum Berbasis Cinta + Kepka BKPDM No. 020/2026
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-3 bg-purple-100 border border-purple-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <span className="text-sm">📋</span>
                  <div>
                    <p className="text-[10px] font-bold text-purple-800">
                      Referensi: Kepka BKPDM No. 020/2026
                    </p>
                    <p className="text-[10px] text-purple-600 mt-0.5 leading-relaxed">
                      {paiIntegration === 'hybrid_kbc'
                        ? 'Modul Ajar akan terintegrasi penuh dengan Kurikulum Berbasis Cinta (KBC) dan merujuk pada ketentuan Kepala Badan Pelatihan Pendidikan Madrasah No. 020 Tahun 2026.'
                        : paiIntegration === 'spiritual_only'
                        ? 'Modul Ajar akan mengintegrasikan nilai-nilai spiritual ke dalam setiap kegiatan pembelajaran secara otomatis.'
                        : 'Modul Ajar PAI standar dengan format Kurikulum Merdeka.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Integration Summary */}
              {paiIntegration !== 'none' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-700">🕌 Nilai Spiritual</p>
                    <p className="text-[10px] text-emerald-600">
                      {paiIntegration === 'hybrid_kbc' ? 'Terintegrasi penuh' : 'Imtaq + Akhlak'}
                    </p>
                  </div>
                  <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-[10px] font-bold text-purple-700">💚 Kurikulum</p>
                    <p className="text-[10px] text-purple-600">
                      {paiIntegration === 'hybrid_kbc' ? 'KBC Berbasis Cinta' : 'Merdeka'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
