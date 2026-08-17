"use client";
import { apiFetch } from "@/lib/api-client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import AppIcon from "@/app/components/ui/AppIcon";
import { getLucideIcon, resolveCategory, resolveInstitutionHref, resolveActiveInstitutionId, isInstitutionHref, featureKeyForHref } from "@/lib/menuConfig";
import { useMenuVisibility } from "@/hooks/useMenuVisibility";

type SubItem = {
  label: string;
  href: string;
  desc?: string;
};

type MenuItem = {
  label: string;
  href?: string;
  submenu?: (SubItem | { label: string; href?: string; submenu: SubItem[] })[];
};

const menuItems: MenuItem[] = [
  { label: "Dasbor", href: "/dashboard" },
  {
    label: "Master Data",
    href: "/dashboard?module=sekolah",
  },
  {
    label: "Presensi",
    submenu: [
      { label: "Presensi Saya", href: "/attendance" },
      { label: "Presensi Mengajar", href: "/attendance/teaching" },
      { label: "Pengajuan Izin", href: "/attendance/leave" },
      { label: "Laporan Presensi", href: "/reports/attendance" },
      { label: "Rekap TPG", href: "/reports/tpg" },
    ],
  },
  {
    label: "Administrasi",
    submenu: [
      { label: "AI Silabus", href: "/dashboard/administrasi?tipe=silabus" },
      { label: "Program Tahunan (Prota)", href: "/dashboard/prota" },
      { label: "Program Semester (Prosem)", href: "/dashboard/prosem" },
      { label: "ATP Editor", href: "/dashboard/atp-editor" },
      { label: "AI Modul Ajar", href: "/dashboard/administrasi?tipe=modul_ajar" },
      { label: "AI RPP", href: "/dashboard/administrasi?tipe=rpp" },
      { label: "AI LKPD", href: "/dashboard/administrasi?tipe=lkpd" },
      { label: "AI Bahan Ajar", href: "/dashboard/bahan-ajar" },
      { label: "Buat Soal AI", href: "/dashboard?module=soal" },
    ],
  },
  {
    label: "Monitoring",
    submenu: [
      { label: "Jurnal Mengajar", href: "/dashboard?module=jurnal" },
      { label: "Kalender Akademik", href: "/dashboard?module=kalender" },
      { label: "Supervisi & Analitik", href: "/dashboard?module=supervisi_analitik" },
      { label: "Tugas Harian", href: "/dashboard?module=tugas_harian" },
      { label: "Pengingat", href: "/dashboard?module=scheduler" },
    ],
  },
  {
    label: "AI",
    submenu: [
      { label: "Chat AI", href: "/dashboard/chat" },
      { label: "AI Performance Report", href: "/dashboard/ai-performance-report" },
    ],
  },
  {
    label: "Buku Nilai",
    href: "/dashboard?module=nilai",
  },
  {
    label: "Laporan",
    submenu: [
      { label: "Laporan Harian & Mengajar", href: "/dashboard/laporan-harian", desc: "Rekap harian resmi + arsip jurnal mengajar" },
      {
        label: "Laporan Kinerja",
        href: "/dashboard/laporan-kinerja",
        submenu: [
          { label: "Daftar", href: "/dashboard/laporan-kinerja" },
          { label: "Buat Baru", href: "/dashboard/laporan-kinerja/buat" },
          { label: "Observasi", href: "/dashboard/laporan-kinerja/observasi" },
          { label: "SKP", href: "/dashboard/laporan-kinerja/skp" },
        ],
      },
      { label: "Evidence", href: "/dashboard/evidence" },
    ],
  },
  {
    label: "Raport",
    submenu: [
      { label: "Status Raport", href: "/dashboard/raport-status" },
      { label: "Review Nilai Raport", href: "/dashboard/rapor-review" },
      { label: "Layout Raport", href: "/dashboard/layout-raport" },
      { label: "Pemetaan Kolom Raport", href: "/dashboard/pemetaan-kolom" },
    ],
  },
  {
    label: "Pengembangan Diri",
    submenu: [
      { label: "Daftar Kegiatan", href: "/dashboard/pengembangan-diri" },
      { label: "Buat Baru", href: "/dashboard/pengembangan-diri/tambah" },
      { label: "Sertifikat", href: "/dashboard/pengembangan-diri" },
    ],
  },
  {
    label: "Perpustakaan",
    href: "/perpustakaan",
  },
  {
    label: "Wali Kelas",
    submenu: [
      { label: "Dashboard Wali Kelas", href: "/dashboard/wali-kelas" },
      { label: "Daftar Siswa", href: "/dashboard/wali-kelas?tab=siswa" },
      { label: "Catatan Wali Kelas", href: "/dashboard/wali-kelas?tab=catatan" },
      { label: "Laporan Wali Kelas", href: "/dashboard/wali-kelas?tab=laporan" },
    ],
  },
  {
    label: "Pembina Eskul",
    submenu: [
      { label: "Dashboard Pembina", href: "/dashboard/pembina-ekskul" },
      { label: "Daftar Kegiatan", href: "/dashboard/pembina-ekskul?tab=daftar" },
      { label: "Penilaian", href: "/dashboard/pembina-ekskul?tab=penilaian" },
      { label: "Laporan", href: "/dashboard/pembina-ekskul?tab=laporan" },
    ],
  },
  {
    label: "Institusi",
    submenu: [
      { label: "Overview Institusi", href: "/dashboard/institution" },
      { label: "Anggota Institusi", href: "/dashboard/institution/members" },
      { label: "Rekap TPG", href: "/dashboard/institution/tpg" },
      { label: "Laporan Mengajar", href: "/dashboard/institution/laporan-mengajar" },
      { label: "Approval / Persetujuan", href: "/dashboard/institution/approval" },
      { label: "Langganan & Billing", href: "/dashboard/institution/langganan" },
      { label: "Pengaturan Institusi", href: "/dashboard/institution/settings" },
    ],
  },
  {
    label: "Keuangan",
    submenu: [
      { label: "Pemasukan", href: "/dashboard?module=keuangan" },
      { label: "Pengeluaran", href: "/dashboard?module=keuangan" },
      { label: "Laporan Keuangan", href: "/dashboard?module=keuangan" },
    ],
  },
  {
    label: "Brankas",
  },
  {
    label: "Pengaturan",
    href: "/settings",
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
  },
];

interface MenuBarProps {
  onStorageClick?: () => void;
}

export default function MenuBar({ onStorageClick }: MenuBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hiddenSet, isLoading } = useMenuVisibility();

  const [isWaliKelas, setIsWaliKelas] = useState<boolean | null>(null);
  const [activeInstitutionId, setActiveInstitutionId] = useState<number | null>(null);
  const [institutionLoaded, setInstitutionLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/auth/active-context')
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setActiveInstitutionId(resolveActiveInstitutionId(data));
        }
        setInstitutionLoaded(true);
      })
      .catch(() => { if (!cancelled) { setActiveInstitutionId(null); setInstitutionLoaded(true); } });
    return () => { cancelled = true; };
  }, []);

  // "Status Raport" hanya dikelola wali kelas → sembunyikan submenu bagi yg
  // bukan wali kelas (belum punya kelas yang ditugaskan kepadanya).
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/wali-kelas/my-classes')
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        setIsWaliKelas(!!(res.ok && (body.data?.length ?? 0) > 0));
      })
      .catch(() => {
        if (!cancelled) setIsWaliKelas(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleMenuItems: MenuItem[] = useMemo(() => {
    if (isWaliKelas === null) return menuItems;

    // Sembunyikan item yang rutenya merupakan feature (menu/submenu/modul)
    // yang disembunyikan oleh konfigurasi peran institusi.
    const isVisibleFeature = (href?: string) => {
      if (!href || isLoading) return true;
      const fk = featureKeyForHref(href);
      return fk === null || !hiddenSet.has(fk);
    };

    const filterSub = (subs: MenuItem["submenu"]): MenuItem["submenu"] => {
      if (!subs) return undefined;
      const filtered = subs
        .map((sub) => {
          if ("submenu" in sub && sub.submenu) {
            const nested = filterSub(sub.submenu);
            if (!nested || nested.length === 0) return null;
            return { ...sub, submenu: nested as SubItem[] };
          }
          return isVisibleFeature(sub.href) ? sub : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return filtered;
    };

    return menuItems
      .map((item) => {
        // Hide institution menu until institution context is loaded
        if (item.label === "Institusi" && !institutionLoaded) {
          return { ...item, submenu: [] };
        }
        if (item.label === "Raport" && item.submenu) {
          const kept = item.submenu.filter(
            (sub) => !(sub as SubItem).label?.startsWith("Status Raport") || isWaliKelas
          );
          const filtered = filterSub(kept);
          return filtered && filtered.length > 0 ? { ...item, submenu: filtered } : null;
        }
        if (item.label === "Brankas") return item;
        if (item.submenu) {
          const filtered = filterSub(item.submenu);
          return filtered && filtered.length > 0 ? { ...item, submenu: filtered } : null;
        }
        return isVisibleFeature(item.href) ? item : null;
      })
      .filter((x): x is MenuItem => x !== null);
  }, [isWaliKelas, institutionLoaded, hiddenSet, isLoading]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const isDropdownActive = (item: MenuItem): boolean => {
    if (item.href && isActive(item.href)) return true;
    if (item.submenu) {
      return item.submenu.some((sub) => {
        if ("submenu" in sub && sub.submenu) {
          return sub.submenu.some((s) => isActive(s.href));
        }
        return isActive((sub as SubItem).href);
      });
    }
    return false;
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await apiFetch("/api/auth/logout", { method: "POST" });
    signOut({ callbackUrl: "/login" });
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.label === "Brankas") {
      onStorageClick?.();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <div className="relative hidden lg:block w-full">
      <nav className="flex h-12 bg-white border-b border-gray-200 px-6 sticky top-0 z-50 max-w-[1400px] 2xl:max-w-[1800px] mx-auto">
        <div className="flex items-center gap-1 w-full overflow-x-auto thin-scrollbar">
          {visibleMenuItems.map((item) => {
            const active = isDropdownActive(item);
            const Icon = getLucideIcon(item.label);

            if (item.label === "Brankas") {
              return (
                <button
                  key={item.label}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 transition-all duration-150 cursor-pointer whitespace-nowrap min-w-max ${
                    active
                      ? "text-violet-600 border-violet-600 bg-violet-50"
                      : "text-gray-600 border-transparent hover:text-violet-500 hover:bg-violet-50"
                  }`}
                >
                  {Icon && <AppIcon label={item.label} size={40} iconSize={20} category={resolveCategory(item.label)} active={active} icon={<Icon />} />}
                  {item.label}
                </button>
              );
            }

            if (!item.submenu) {
              return (
                <a
                  key={item.label}
                  href={item.href!}
                  onClick={(e) => { e.preventDefault(); handleItemClick(item); }}
                  className={`flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 transition-all duration-150 cursor-pointer whitespace-nowrap min-w-max ${
                    active
                      ? "text-violet-600 border-violet-600 bg-violet-50"
                      : "text-gray-600 border-transparent hover:text-violet-500 hover:bg-violet-50"
                  }`}
                >
                  {Icon && <AppIcon label={item.label} size={40} iconSize={20} category={resolveCategory(item.label)} active={active} icon={<Icon />} />}
                  {item.label}
                </a>
              );
            }

            return (
              <div key={item.label} className="relative group shrink-0">
                <div
                  className={`flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 transition-all duration-150 cursor-pointer whitespace-nowrap min-w-max ${
                    active
                      ? "text-violet-600 border-violet-600 bg-violet-50"
                      : "text-gray-600 border-transparent hover:text-violet-500 hover:bg-violet-50"
                  }`}
                >
                  {Icon && <AppIcon label={item.label} size={40} iconSize={20} category={resolveCategory(item.label)} active={active} icon={<Icon />} />}
                  {item.label}
                  <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                <div className="absolute top-full left-0 min-w-[220px] bg-white rounded-xl shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] overflow-hidden">
                  <div className="p-2 pt-3">
                    {item.submenu.map((sub) => {
                      if ("submenu" in sub && sub.submenu) {
                        const parentActive = sub.href ? isActive(sub.href) : sub.submenu.some((s) => isActive(s.href));
                        const ParentSubIcon = getLucideIcon(sub.label);
                        return (
                          <div key={sub.label} className="relative group/sub">
                            <div
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer whitespace-nowrap ${
                                parentActive
                                  ? "bg-violet-50 text-violet-700"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {ParentSubIcon && <AppIcon label={sub.label} size={28} iconSize={14} category={resolveCategory(sub.label)} active={parentActive} icon={<ParentSubIcon />} />}
                              <span className="flex-1 truncate">{sub.label}</span>
                              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div className="absolute left-full top-0 min-w-[180px] bg-white rounded-xl shadow-xl border border-gray-200 opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all duration-200 z-[101] overflow-hidden">
                              <div className="p-2 pl-3">
                                {sub.submenu.map((s) => {
                                  const sActive = isActive(s.href);
                                  const SIcon = getLucideIcon(s.label);
                                  return (
                                    <a
                                      key={s.label}
                                      href={s.href}
                                      onClick={(e) => { e.preventDefault(); router.push(s.href); }}
                                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer whitespace-nowrap ${
                                        sActive
                                          ? "bg-violet-50 text-violet-700"
                                          : "text-gray-700 hover:bg-gray-50"
                                      }`}
                                    >
                                      {SIcon && <AppIcon label={s.label} size={24} iconSize={12} category={resolveCategory(s.label)} active={sActive} icon={<SIcon />} />}
                                      <span className="truncate">{s.label}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const s = sub as SubItem;
                      const sActive = isActive(s.href);
                      const SubIcon = getLucideIcon(s.label);

                      if (s.label === "Keluar") {
                        return (
                          <button
                            key={s.label}
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left whitespace-nowrap"
                          >
                            {s.label}
                          </button>
                        );
                      }

                      return (
                        <a
                          key={s.label}
                          href={isInstitutionHref(s.href) ? resolveInstitutionHref(s.href, activeInstitutionId) : s.href}
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(isInstitutionHref(s.href)
                              ? resolveInstitutionHref(s.href, activeInstitutionId)
                              : s.href);
                          }}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer whitespace-nowrap ${
                            sActive
                              ? "bg-violet-50 text-violet-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {SubIcon && <AppIcon label={s.label} size={28} iconSize={14} category={resolveCategory(s.label)} active={sActive} icon={<SubIcon />} />}
                          <span>
                            <span className="block truncate">{s.label}</span>
                            {s.desc && (
                              <span className="block text-[10px] font-normal text-gray-400 truncate max-w-[200px]">{s.desc}</span>
                            )}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </nav>
      <style jsx>{`
        .thin-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .thin-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .thin-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 4px;
        }
        .thin-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 4px;
        }
        
        /* Responsive adjustments */
        @media (max-width: 1024px) {
          nav {
            padding-left: 1rem;
            padding-right: 1rem;
          }
        }
        
        @media (max-width: 768px) {
          nav {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
