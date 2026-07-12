"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

type SubItem = {
  label: string;
  href: string;
};

type MenuItem = {
  label: string;
  icon: string;
  href?: string;
  submenu?: (SubItem | { label: string; href?: string; submenu: SubItem[] })[];
};

const menuItems: MenuItem[] = [
  { label: "Dasbor", icon: "📊", href: "/dashboard" },
  {
    label: "Master Data",
    icon: "🗄️",
    href: "/dashboard?module=sekolah",
  },
  {
    label: "Administrasi",
    icon: "📋",
    submenu: [
      { label: "AI Silabus", href: "/dashboard/administrasi?tipe=silabus" },
      { label: "Program Tahunan (Prota)", href: "/dashboard/prota" },
      { label: "Program Semester (Prosem)", href: "/dashboard/prosem" },
      { label: "ATP Editor", href: "/dashboard/atp-editor" },
      { label: "AI Modul Ajar", href: "/dashboard/administrasi?tipe=modul_ajar" },
      { label: "AI RPP", href: "/dashboard/administrasi?tipe=rpp" },
      { label: "AI LKPD", href: "/dashboard/administrasi?tipe=lkpd" },
      { label: "AI Bahan Ajar", href: "/dashboard/bahan-ajar" },
    ],
  },
  {
    label: "Monitoring",
    icon: "📊",
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
    icon: "💬",
    submenu: [
      { label: "Chat AI", href: "/dashboard/chat" },
      { label: "AI Performance Report", href: "/dashboard/ai-performance-report" },
      { label: "Deep Learning", href: "/dashboard" },
    ],
  },
  {
    label: "Laporan",
    icon: "📝",
    submenu: [
      { label: "Laporan Harian", href: "/dashboard/laporan-harian" },
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
      { label: "Status Raport", href: "/dashboard/raport-status" },
      { label: "Review Nilai Raport", href: "/dashboard/rapor-review" },
      { label: "Layout Raport", href: "/dashboard/layout-raport" },
    ],
  },
  {
    label: "Pengembangan Diri",
    icon: "🌱",
    submenu: [
      { label: "Daftar Kegiatan", href: "/dashboard/pengembangan-diri" },
      { label: "Buat Baru", href: "/dashboard/pengembangan-diri/tambah" },
      { label: "Sertifikat", href: "/dashboard/pengembangan-diri" },
    ],
  },
  {
    label: "Buku Nilai",
    icon: "📚",
    href: "/dashboard?module=nilai",
  },
  {
    label: "Rapor",
    icon: "📋",
    submenu: [
      { label: "Status Raport", href: "/dashboard/raport-status" },
      { label: "Review Nilai Raport", href: "/dashboard/rapor-review" },
      { label: "Layout Raport", href: "/dashboard/layout-raport" },
    ],
  },
  {
    label: "Brankas",
    icon: "🗂️",
  },
  {
    label: "Keuangan",
    icon: "💰",
    submenu: [
      { label: "Pemasukan", href: "/dashboard?module=keuangan" },
      { label: "Pengeluaran", href: "/dashboard?module=keuangan" },
      { label: "Laporan Keuangan", href: "/dashboard?module=keuangan" },
    ],
  },
  {
    label: "Profil",
    icon: "👤",
    submenu: [
      { label: "Profil Saya", href: "/profile" },
      { label: "Billing & Langganan", href: "/profile?tab=billing" },
      { label: "Pengaturan", href: "/settings" },
      { label: "Pemetaan Kolom", href: "/settings#pemetaan-kolom" },
      { label: "Keluar", href: "#" },
    ],
  },
];

interface MenuBarProps {
  onStorageClick?: () => void;
}

export default function MenuBar({ onStorageClick }: MenuBarProps) {
  const pathname = usePathname();
  const router = useRouter();

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
    await fetch("/api/auth/logout", { method: "POST" });
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
    <div className="relative hidden lg:block">
      <nav className="flex h-12 bg-white border-b border-gray-200 px-6">
        <div className="flex items-center gap-1">
          {menuItems.map((item) => {
            const active = isDropdownActive(item);

            if (item.label === "Brankas") {
              return (
                <button
                  key={item.label}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 transition-all duration-150 cursor-pointer ${
                    active
                      ? "text-violet-600 border-violet-600 bg-violet-50"
                      : "text-gray-600 border-transparent hover:text-violet-500 hover:bg-violet-50"
                  }`}
                >
                  <span>{item.icon}</span>
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
                  className={`flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 transition-all duration-150 cursor-pointer ${
                    active
                      ? "text-violet-600 border-violet-600 bg-violet-50"
                      : "text-gray-600 border-transparent hover:text-violet-500 hover:bg-violet-50"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </a>
              );
            }

            return (
              <div key={item.label} className="relative group">
                <div
                  className={`flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 transition-all duration-150 cursor-pointer ${
                    active
                      ? "text-violet-600 border-violet-600 bg-violet-50"
                      : "text-gray-600 border-transparent hover:text-violet-500 hover:bg-violet-50"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                  <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                <div className="absolute top-full left-0 w-56 bg-white rounded-xl shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="p-2 pt-3">
                    {item.submenu.map((sub) => {
                      if ("submenu" in sub && sub.submenu) {
                        const parentActive = sub.href ? isActive(sub.href) : sub.submenu.some((s) => isActive(s.href));
                        return (
                          <div key={sub.label} className="relative group/sub">
                            <div
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                                parentActive
                                  ? "bg-violet-50 text-violet-700"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <span className="flex-1">{sub.label}</span>
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div className="absolute left-full top-0 w-48 bg-white rounded-xl shadow-xl border border-gray-200 opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all duration-200 z-50">
                              <div className="p-2 pl-3">
                                {sub.submenu.map((s) => {
                                  const sActive = isActive(s.href);
                                  return (
                                    <a
                                      key={s.label}
                                      href={s.href}
                                      onClick={(e) => { e.preventDefault(); router.push(s.href); }}
                                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                                        sActive
                                          ? "bg-violet-50 text-violet-700"
                                          : "text-gray-700 hover:bg-gray-50"
                                      }`}
                                    >
                                      {s.label}
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

                      if (s.label === "Keluar") {
                        return (
                          <button
                            key={s.label}
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
                          >
                            {s.label}
                          </button>
                        );
                      }

                      return (
                        <a
                          key={s.label}
                          href={s.href}
                          onClick={(e) => { e.preventDefault(); router.push(s.href); }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                            sActive
                              ? "bg-violet-50 text-violet-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {s.label}
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
    </div>
  );
}
