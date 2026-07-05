'use client';

import React, { useState } from 'react';
import { useKurikulumStore, TIGA_PENGALAMAN_OPTIONS } from '@/lib/stores';

export default function TigaPengalamanSelector() {
  const {
    useTigaPengalaman,
    setUseTigaPengalaman,
    selectedPengalaman,
    togglePengalaman,
    setSelectedPengalaman,
  } = useKurikulumStore();

  const [isExpanded, setIsExpanded] = useState(false);

  const allSelected = selectedPengalaman.length === TIGA_PENGALAMAN_OPTIONS.length;

  const toggleAllPengalaman = () => {
    if (allSelected) {
      setSelectedPengalaman([]);
    } else {
      setSelectedPengalaman(TIGA_PENGALAMAN_OPTIONS.map(p => p.key));
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 overflow-hidden">
      {/* Header with toggle */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔄</span>
            <div>
              <h4 className="text-sm font-bold text-emerald-800">
                3 Pengalaman Belajar
              </h4>
              <p className="text-[10px] text-emerald-500">
                Deep Learning: Memahami → Mengaplikasi → Merefleksikan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUseTigaPengalaman(!useTigaPengalaman)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              useTigaPengalaman ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                useTigaPengalaman ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Info when enabled */}
        {useTigaPengalaman && (
          <div className="mt-2 flex flex-wrap gap-1">
            {TIGA_PENGALAMAN_OPTIONS.map((p) => (
              <span
                key={p.key}
                className="px-2 py-0.5 bg-emerald-200 text-emerald-700 rounded-full text-[10px] font-semibold"
              >
                {p.label.split(' (')[0]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Detail */}
      {useTigaPengalaman && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleAllPengalaman}
              className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition"
            >
              {allSelected ? 'Batalkan Semua' : 'Pilih Semua'}
            </button>
          </div>

          <div className="space-y-2">
            {TIGA_PENGALAMAN_OPTIONS.map((pengalaman, idx) => {
              const isSelected = selectedPengalaman.includes(pengalaman.key);
              const phaseColors = [
                'from-blue-50 to-indigo-50 border-blue-200',
                'from-amber-50 to-orange-50 border-amber-200',
                'from-emerald-50 to-teal-50 border-emerald-200',
              ];
              const phaseIcons = ['📖', '🔧', '💭'];
              const phaseLabelColors = ['text-blue-700', 'text-amber-700', 'text-emerald-700'];

              return (
                <div key={pengalaman.key}>
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? `${phaseColors[idx]} shadow-sm`
                        : 'bg-white border-slate-200 hover:border-emerald-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePengalaman(pengalaman.key)}
                      className="mt-0.5 w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-400 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{phaseIcons[idx]}</span>
                        <span className={`text-xs font-bold ${isSelected ? phaseLabelColors[idx] : 'text-slate-700'}`}>
                          {idx + 1}. {pengalaman.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                          {pengalaman.taxonomyLevel}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        {pengalaman.description}
                      </p>
                      {isSelected && (
                        <div className="mt-1.5 space-y-0.5">
                          {pengalaman.activities.map((activity, aIdx) => (
                            <div key={aIdx} className="flex items-center gap-1">
                              <div className="w-1 h-1 rounded-full bg-emerald-400" />
                              <span className="text-[10px] text-slate-600">{activity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              );
            })}
          </div>

          {/* Structure Summary */}
          {selectedPengalaman.length > 0 && (
            <div className={`p-3 rounded-xl border ${
              selectedPengalaman.length === 3
                ? 'bg-emerald-100 border-emerald-200'
                : 'bg-amber-100 border-amber-200'
            }`}>
              <p className={`text-[10px] font-bold mb-1 ${
                selectedPengalaman.length === 3 ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {selectedPengalaman.length === 3
                  ? '✅ Struktur 3 Pengalaman Belajar LENGKAP'
                  : `⚠️ Struktur BELUM LENGKAP (${selectedPengalaman.length}/3)`}
              </p>
              <p className="text-[10px] text-slate-600">
                {selectedPengalaman.length === 3
                  ? 'Modul Ajar & RPP akan memiliki struktur kegiatan yang kaya dan mendalam'
                  : 'Disarankan memilih ketiganya untuk pengalaman belajar yang optimal'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
