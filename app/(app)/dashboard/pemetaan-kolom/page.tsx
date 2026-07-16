"use client";

import { useEffect } from "react";
import { useTeacherStore } from "@/lib/stores";
import PemetaanKolomSettings from "@/components/raport/PemetaanKolomSettings";
import Link from "next/link";

export default function PemetaanKolomPage() {
  const activeSchoolId = useTeacherStore((s) => s.activeSchoolId);
  const schools = useTeacherStore((s) => s.schools);

  if (!activeSchoolId && schools.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <span className="text-4xl mb-3 block">⚠️</span>
            <h2 className="text-lg font-bold text-amber-800 mb-2">Belum Ada Sekolah yang Dipilih</h2>
            <p className="text-sm text-amber-600 mb-4">
              Anda belum memilih sekolah aktif. Silakan pilih sekolah terlebih dahulu di menu Dasbor.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl transition"
            >
              Kembali ke Dasbor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const schoolId = activeSchoolId || schools[0]?.id;
  const schoolName = schools.find((s) => s.id === schoolId)?.nama_sekolah || "Sekolah";

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/dashboard" className="hover:text-violet-600 transition">Dashboard</Link>
            <span>/</span>
            <Link href="/dashboard/raport-status" className="hover:text-violet-600 transition">Raport</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Pemetaan Kolom Raport</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pemetaan Kolom Raport</h1>
          <p className="text-gray-500 text-sm mt-1">
            Atur pemetaan kolom untuk ekspor Excel raport - {schoolName}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          {schoolId ? (
            <PemetaanKolomSettings sekolahId={schoolId} />
          ) : (
            <div className="text-center text-gray-500">
              Pilih sekolah terlebih dahulu untuk mengatur pemetaan kolom.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
