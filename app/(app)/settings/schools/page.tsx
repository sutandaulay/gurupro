"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Building, UserCheck, User, MapPin, Hash, ExternalLink } from "lucide-react";

type SchoolType = "institusi" | "mandiri";

interface SchoolItem {
  id: string;
  nama_sekolah: string;
  logo: string | null;
  alamat: string | null;
  npsn: string | null;
  nama_kepala_sekolah: string | null;
  user_id: string;
  is_owner: boolean;
  created_at: string;
}

export default function DetailSekolahTerpilihPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/schools");

      if (!res.ok) throw new Error("Gagal memuat data sekolah");

      const data: SchoolItem[] = await res.json();

      setSchools(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const getSchoolType = (school: SchoolItem): SchoolType => {
    if (school.is_owner) return "mandiri";
    return "institusi";
  };

  const isLinkedToInstitution = (school: SchoolItem): boolean => {
    return !school.is_owner;
  };

  const mandiriSchools = schools.filter((s) => getSchoolType(s) === "mandiri");
  const institusiSchools = schools.filter((s) => getSchoolType(s) === "institusi");

  const SchoolCard = ({ school }: { school: SchoolItem }) => {
    const type = getSchoolType(school);

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        <div className={`h-2 ${type === "institusi" ? "bg-blue-500" : "bg-emerald-500"}`} />
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold ${
                type === "institusi" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
              }`}>
                {school.nama_sekolah?.charAt(0) || "S"}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{school.nama_sekolah}</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                  type === "institusi"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                  {type === "institusi" ? <Building size={10} /> : <UserCheck size={10} />}
                  {type === "institusi" ? "Institusi" : "Mandiri"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 text-sm">
            {school.npsn && (
              <div className="flex items-center gap-2 text-gray-600">
                <Hash size={14} className="text-gray-400 shrink-0" />
                <span className="text-xs">NPSN: <span className="font-semibold text-gray-800">{school.npsn}</span></span>
              </div>
            )}
            {school.alamat && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                <span className="text-xs">{school.alamat}</span>
              </div>
            )}
            {school.nama_kepala_sekolah && (
              <div className="flex items-center gap-2 text-gray-600">
                <User size={14} className="text-gray-400 shrink-0" />
                <span className="text-xs">Kepsek: <span className="font-semibold text-gray-800">{school.nama_kepala_sekolah}</span></span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {isLinkedToInstitution(school) ? "Terhubung via institusi" : "Didaftarkan mandiri"}
            </span>
            <button
              onClick={() => router.push(`/dashboard?module=sekolah&id=${school.id}`)}
              className="flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-700 transition cursor-pointer"
            >
              Kelola <ExternalLink size={10} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500 font-medium">Memuat data sekolah...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm max-w-md">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-base font-bold text-gray-800 mb-2">Terjadi Kesalahan</h2>
          <p className="text-xs text-gray-500 mb-4">{error}</p>
          <button onClick={loadData} className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition cursor-pointer">
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <Link href="/settings" className="hover:text-violet-600 transition">Pengaturan</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Detail Sekolah Terpilih</span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Detail Sekolah Terpilih</h1>
        <p className="text-xs text-gray-500 mt-1">
          Semua sekolah yang Anda daftarkan, baik secara mandiri maupun melalui institusi
        </p>
      </div>

      {schools.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <span className="text-3xl mb-3 block">🏫</span>
          <h4 className="text-sm font-bold text-amber-800">Belum Ada Sekolah Terdaftar</h4>
          <p className="text-xs text-amber-600 mt-2 max-w-md mx-auto">
            Anda belum mendaftarkan sekolah. Silakan daftarkan sekolah baru di menu Master Data.
          </p>
          <button
            onClick={() => router.push("/dashboard?module=sekolah")}
            className="mt-4 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Daftarkan Sekolah
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {institusiSchools.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Building size={18} className="text-blue-600" />
                <h2 className="text-base font-bold text-gray-800">Sekolah via Institusi</h2>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold">{institusiSchools.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {institusiSchools.map((school) => (
                  <SchoolCard key={school.id} school={school} />
                ))}
              </div>
            </section>
          )}

          {mandiriSchools.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <UserCheck size={18} className="text-emerald-600" />
                <h2 className="text-base font-bold text-gray-800">Sekolah Mandiri</h2>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold">{mandiriSchools.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mandiriSchools.map((school) => (
                  <SchoolCard key={school.id} school={school} />
                ))}
              </div>
            </section>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-600 mb-1">Informasi Tipe Sekolah</p>
                <p><strong>Institusi:</strong> Sekolah yang terhubung melalui institusi/lembaga pendidikan tempat Anda terdaftar sebagai anggota.</p>
                <p className="mt-1"><strong>Mandiri:</strong> Sekolah yang Anda daftarkan sendiri secara langsung ke GuruPRO.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
