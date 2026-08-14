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

  const activeSchool = schools.find(s => s.id === activeSchoolId) || schools[0];

  if (!activeSchool) {
    return (
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
        ⚠️ Silakan pilih sekolah aktif di Top Bar terlebih dahulu.
      </div>
    );
  }

  return (
    <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs overflow-hidden shrink-0">
          {activeSchool.logo ? (
            <img src={activeSchool.logo} alt={activeSchool.nama_sekolah} className="w-full h-full object-contain" />
          ) : (
            activeSchool.nama_sekolah.charAt(0)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-indigo-800 truncate">{activeSchool.nama_sekolah}</p>
          <p className="text-[10px] text-indigo-500 truncate">
            NPSN: {activeSchool.npsn || '—'} {activeSchool.alamat && `• ${activeSchool.alamat}`}
          </p>
        </div>
        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[10px] font-bold">
          AKTIF
        </span>
      </div>
    </div>
  );
}
