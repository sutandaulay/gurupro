'use client';

import React, { useState } from 'react';
import { useKurikulumStore, DIMENSI_8_OPTIONS } from '@/lib/stores';

export default function Dimensi8Selector() {
  const {
    selectedDimensi8,
    toggleDimensi8,
    setSelectedDimensi8,
  } = useKurikulumStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = DIMENSI_8_OPTIONS.filter(d =>
    d.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allSelected = selectedDimensi8.length === DIMENSI_8_OPTIONS.length;
  const noneSelected = selectedDimensi8.length === 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedDimensi8([]);
    } else {
      setSelectedDimensi8(DIMENSI_8_OPTIONS.map(d => d.key));
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-indigo-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <div>
            <h4 className="text-sm font-bold text-indigo-800">
              8 Dimensi Profil Lulusan
            </h4>
            <p className="text-[10px] text-indigo-500">
              Deep Learning • {selectedDimensi8.length} dipilih
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {noneSelected ? (
            <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full">
              Wajib pilih
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-bold">
              {selectedDimensi8.length} dipilih
            </span>
          )}
          <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-xs text-indigo-400`}></i>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Quick Actions */}
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={toggleAll}
              className="text-[10px] px-2 py-1 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition"
            >
              {allSelected ? 'Batalkan Semua' : 'Pilih Semua'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedDimensi8([])}
              className="text-[10px] px-2 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
            >
              Reset
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Cari dimensi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-indigo-200 rounded-xl text-xs bg-white
              focus:border-indigo-400 focus:outline-none mb-2"
          />

          {/* Dimensi List */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {filteredOptions.map((dimensi) => {
              const isSelected = selectedDimensi8.includes(dimensi.key);
              return (
                <label
                  key={dimensi.key}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-50 border border-indigo-300'
                      : 'bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleDimensi8(dimensi.key)}
                    className="mt-0.5 w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{dimensi.icon}</span>
                      <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-800' : 'text-slate-700'}`}>
                        {dimensi.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                      {dimensi.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Selected Summary */}
          {selectedDimensi8.length > 0 && (
            <div className="mt-3 p-2.5 bg-indigo-100 rounded-xl">
              <p className="text-[10px] font-semibold text-indigo-700 mb-1.5">
                Dimensi Terpilih:
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedDimensi8.map((key) => {
                  const d = DIMENSI_8_OPTIONS.find(x => x.key === key);
                  return (
                    <span
                      key={key}
                      className="px-1.5 py-0.5 bg-indigo-200 text-indigo-700 rounded text-[10px] font-medium"
                    >
                      {d?.icon} {d?.label.split('. ')[1] || key}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
