'use client';

import React from 'react';
import { useTeacherStore } from '@/lib/stores';

export default function SchoolSwitcher() {
  const {
    schools,
    activeSchoolId,
    setActiveSchool,
    isLoadingSchools,
  } = useTeacherStore();

  // Only show if user has multiple schools
  if (schools.length === 0 && !isLoadingSchools) {
    return (
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
        ⚠️ Tidak ada sekolah ditemukan. Buat sekolah baru di menu &quot;Sekolah&quot;.
      </div>
    );
  }

  if (schools.length === 1) {
    // Single school mode - show compact info
    const school = schools[0];
    return (
      <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
            {school.nama_sekolah.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-indigo-800 truncate">{school.nama_sekolah}</p>
            <p className="text-[10px] text-indigo-500 truncate">
              NPSN: {school.npsn || '—'} {school.alamat && `• ${school.alamat}`}
            </p>
          </div>
          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[10px] font-bold">
            AKTIF
          </span>
        </div>
      </div>
    );
  }

  // Multi-school mode - show dropdown switcher
  return (
    <div className="mb-4">
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
        🏫 Sekolah Aktif
      </label>
      <div className="relative">
        <select
          value={activeSchoolId || ''}
          onChange={(e) => setActiveSchool(e.target.value)}
          className="w-full px-3 py-2.5 pr-8 border-2 border-indigo-200 rounded-xl text-sm font-semibold text-slate-800
            bg-gradient-to-r from-indigo-50 to-purple-50 focus:border-indigo-400 focus:outline-none
            appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236366f1'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '1.2rem',
          }}
        >
          <option value="">-- Pilih Sekolah --</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.nama_sekolah}
              {school.npsn ? ` (NPSN: ${school.npsn})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Active school info card */}
      {activeSchoolId && (() => {
        const activeSchool = schools.find(s => s.id === activeSchoolId);
        if (!activeSchool) return null;
        return (
          <div className="mt-2 p-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                {activeSchool.nama_sekolah.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-indigo-800 truncate">{activeSchool.nama_sekolah}</p>
                <p className="text-[10px] text-indigo-500 truncate">
                  {activeSchool.alamat || activeSchool.npsn || 'Multi-school mode aktif'}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
