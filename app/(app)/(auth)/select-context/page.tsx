"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconBuilding, IconUser, IconLoader2, IconLogout, IconArrowRight } from "@tabler/icons-react";

interface Institution {
  id: number;
  name: string;
}

export default function SelectContextPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [activeContext, setActiveContext] = useState<any>(null);

  useEffect(() => {
    async function loadContext() {
      try {
        const res = await fetch("/api/auth/active-context");
        if (res.ok) {
          const data = await res.json();
          setInstitutions(data.institutions || []);
          setActiveContext(data.activeContext || "individual");
        } else if (res.status === 401) {
          router.push("/login");
        }
      } catch (err) {
        console.error("Failed to load context:", err);
      } finally {
        setLoading(false);
      }
    }
    loadContext();
  }, [router]);

  const handleSelect = async (value: string) => {
    setSwitching(value);
    let newContext: any = "individual";
    if (value !== "individual") {
      newContext = { institutionId: Number(value) };
    }

    try {
      const res = await fetch("/api/auth/active-context", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeContext: newContext }),
      });

      if (res.ok) {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to set active context:", err);
    } finally {
      setSwitching(null);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <IconLoader2 size={40} className="animate-spin text-violet-500 mb-4" />
        <p className="text-slate-400 text-sm">Menyiapkan Ruang Kerja Anda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-white p-6 font-sans relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between py-4 relative z-10">
        <h1 className="text-xl font-black tracking-tight text-white">
          Guru<span className="text-violet-500">PRO</span>
        </h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-xs text-slate-400 font-bold transition-all cursor-pointer"
        >
          <IconLogout size={14} />
          <span>Keluar</span>
        </button>
      </div>

      {/* Main Context Card Selector */}
      <div className="w-full max-w-lg mx-auto py-12 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl tracking-tight">
            Pilih Ruang Kerja Anda
          </h2>
          <p className="mt-2.5 text-sm text-slate-400 max-w-md mx-auto">
            Akun Anda terhubung ke beberapa sekolah. Pilih sekolah aktif atau masuk ke ruang kerja pribadi Anda.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Individual Context */}
          <button
            disabled={switching !== null}
            onClick={() => handleSelect("individual")}
            className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 cursor-pointer relative overflow-hidden group
              ${activeContext === "individual" 
                ? "bg-violet-600/15 border-violet-500 shadow-md shadow-violet-500/5 text-white" 
                : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300"
              }`}
          >
            <div className={`p-3 rounded-lg shrink-0 ${activeContext === "individual" ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 group-hover:text-slate-200 transition-colors"}`}>
              <IconUser size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white">Ruang Kerja Pribadi (Guru Mandiri)</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">Akses modul mandiri, bank soal, dan RPP personal Anda</p>
            </div>
            <div className="shrink-0 text-slate-500 group-hover:text-white transition-colors transform group-hover:translate-x-1 duration-200">
              {switching === "individual" ? (
                <IconLoader2 size={18} className="animate-spin text-violet-500" />
              ) : (
                <IconArrowRight size={18} />
              )}
            </div>
          </button>

          {/* School Contexts */}
          {institutions.map((school) => {
            const isSelected = activeContext && activeContext !== "individual" && activeContext.institutionId === school.id;
            return (
              <button
                key={school.id}
                disabled={switching !== null}
                onClick={() => handleSelect(String(school.id))}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 cursor-pointer relative overflow-hidden group
                  ${isSelected 
                    ? "bg-violet-600/15 border-violet-500 shadow-md shadow-violet-500/5 text-white" 
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300"
                  }`}
              >
                <div className={`p-3 rounded-lg shrink-0 ${isSelected ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 group-hover:text-slate-200 transition-colors"}`}>
                  <IconBuilding size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white">{school.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">Akses presensi mengajar, rapor, dan jurnal kelas</p>
                </div>
                <div className="shrink-0 text-slate-500 group-hover:text-white transition-colors transform group-hover:translate-x-1 duration-200">
                  {switching === String(school.id) ? (
                    <IconLoader2 size={18} className="animate-spin text-violet-500" />
                  ) : (
                    <IconArrowRight size={18} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-4xl mx-auto py-4 text-center text-xs text-slate-500 relative z-10 border-t border-slate-900">
        GuruPRO AI — Platform Administrasi & Presensi Digital Terintegrasi.
      </div>
    </div>
  );
}
