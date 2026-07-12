"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useProfileStore } from "@/lib/stores";
import {
  IconX,
  IconCapRounded,
  IconChevronDown,
} from "@tabler/icons-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onStorageClick?: () => void;
}

type SubItem = {
  label: string;
  href: string;
};

type MenuItem = {
  label: string;
  icon: string;
  href?: string;
  submenu?: SubItem[];
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
      { label: "Laporan Kinerja", href: "/dashboard/laporan-kinerja" },
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
    href: "/dashboard/brankas",
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
    ],
  },
];

export default function MobileSidebar({ isOpen, onClose, onStorageClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const profile = useProfileStore(s => s.profile);
  const fetchProfile = useProfileStore(s => s.fetchProfile);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!profile) fetchProfile();
  }, []);

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "GP";

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const toggleExpand = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isExpanded = (label: string) => expandedMenus.includes(label);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    signOut({ callbackUrl: "/login" });
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 left-0 z-50 h-full w-[280px] bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <a
            href="/dashboard"
            onClick={(e) => { e.preventDefault(); router.push("/dashboard"); onClose(); }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <IconCapRounded size={26} stroke={1.5} className="text-violet-600" />
            <span className="text-lg font-bold text-gray-900">
              Guru<span className="text-violet-600">PRO</span>
            </span>
          </a>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            aria-label="Close sidebar"
          >
            <IconX size={20} stroke={1.5} />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto" style={{ height: "calc(100% - 140px)" }}>
          {menuItems.map((item) => {
            if (!item.submenu) {
              const isStorage = item.label === "Brankas";
              const active = isStorage ? false : isActive(item.href!);
              return (
                <a
                  key={item.label}
                  href={isStorage ? "#" : item.href!}
                  onClick={(e) => {
                    e.preventDefault();
                    if (isStorage) {
                      onStorageClick?.();
                    } else {
                      router.push(item.href!);
                    }
                    onClose();
                  }}
                  className={`flex items-center gap-3 mx-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-violet-50 text-violet-600 border-l-3 border-violet-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </a>
              );
            }

            const expanded = isExpanded(item.label);
            const anyChildActive = item.submenu.some((s) => isActive(s.href));

            return (
              <div key={item.label} className="mx-2">
                <button
                  onClick={() => toggleExpand(item.label)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    anyChildActive && !expanded
                      ? "bg-violet-50 text-violet-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  <IconChevronDown
                    size={16}
                    stroke={1.5}
                    className={`transition-transform duration-200 ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expanded && (
                  <div className="ml-4 mt-1 mb-1 border-l-2 border-gray-100 pl-2">
                    {item.submenu.map((sub) => {
                      const active = isActive(sub.href);
                      return (
                        <a
                          key={sub.label}
                          href={sub.href}
                          onClick={(e) => { e.preventDefault(); router.push(sub.href); onClose(); }}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                            active
                              ? "bg-violet-50 text-violet-600"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {sub.label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-4 bg-white">
          <div className="flex items-center gap-3 mb-3">
            {profile?.photo_url || session?.user?.image ? (
              <img
                src={profile?.photo_url || session?.user?.image || ""}
                alt={session?.user?.name || "User"}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {session?.user?.name || "Pengguna"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {session?.user?.email || ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            Keluar
          </button>
        </div>
      </div>
    </>
  );
}
