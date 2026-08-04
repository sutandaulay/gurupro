"use client";
import { apiFetch } from "@/lib/api-client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useProfileStore } from "@/lib/stores";
import AppIcon from "@/app/components/ui/AppIcon";
import { getLucideIcon, masterMenus, resolveCategory, isInstitutionHref, resolveInstitutionHref, resolveActiveInstitutionId } from "@/lib/menuConfig";

export type MenuItem = {
  label: string;
  href?: string;
  submenu?: { label: string; href: string; desc?: string }[];
};

function getGreeting(hour: number) {
  if (hour < 12) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

function formatIndonesianDate(date: Date) {
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function SkeletonCard() {
  return (
    <div className="flex flex-col items-center gap-2 animate-pulse">
      <div className="w-14 h-14 rounded-2xl bg-slate-200" />
      <div className="h-3 w-16 rounded bg-slate-200" />
    </div>
  );
}

function MenuGridSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

interface MobileHomeMenuProps {
  currentModule: string;
  onNavigate?: () => void;
}

export default function MobileHomeMenu({ currentModule, onNavigate }: MobileHomeMenuProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = useProfileStore(s => s.profile);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [roleFlags, setRoleFlags] = useState<{ isWaliKelas: boolean; isPembinaEkskul: boolean } | null>(null);
  const [activeInstitutionId, setActiveInstitutionId] = useState<number | null>(null);
  const [greeting, setGreeting] = useState("Selamat pagi");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()));
    setCurrentDate(formatIndonesianDate(new Date()));
  }, []);

  const displayName = useMemo(() => {
    if (!profile) return "Guru";
    return [profile.nama_depan, profile.nama_belakang].filter(Boolean).join(" ") || "Guru";
  }, [profile]);

  const roleText = useMemo(() => {
    if (!profile) return "";
    return profile.jabatan || profile.role || "";
  }, [profile]);

  const institutionText = useMemo(() => {
    if (!profile) return "";
    return profile.nama_sekolah || profile.institusi || "";
  }, [profile]);

  useEffect(() => {
    const fetchRoleFlags = async () => {
      try {
        const res = await apiFetch('/api/user/role-flags');
        if (res.ok) {
          const data = await res.json();
          setRoleFlags(data);
        }
      } catch {
        // silently fail
      }
    };
    fetchRoleFlags();
  }, []);

  useEffect(() => {
    const fetchActiveContext = async () => {
      try {
        const res = await apiFetch('/api/auth/active-context');
        if (res.ok) {
          const data = await res.json();
          setActiveInstitutionId(resolveActiveInstitutionId(data));
        }
      } catch {
        // silently fail
      }
    };
    fetchActiveContext();
  }, []);

  const filteredMenus = useMemo(() => {
    let base = masterMenus;
    if (roleFlags) {
      base = base.filter((item) => {
        if (item.label === "Wali Kelas" && !roleFlags.isWaliKelas) return false;
        if (item.label === "Pembina Eskul" && !roleFlags.isPembinaEkskul) return false;
        return true;
      });
    }
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      m =>
        m.label.toLowerCase().includes(q) ||
        m.submenu?.some(s => s.label.toLowerCase().includes(q))
    );
  }, [search, roleFlags]);

  const handleNavigate = (href?: string) => {
    if (onNavigate) onNavigate();
    if (href) router.push(href);
  };

  const switchToModule = (module: string) => {
    if (onNavigate) onNavigate();
    window.dispatchEvent(new CustomEvent("switchModule", { detail: { module } }));
  };

  const handleSubmenuNavigate = (href: string) => {
    if (onNavigate) onNavigate();
    router.push(resolveMenuHref(href) || "/dashboard");
  };

  const resolveMenuHref = (href?: string) => {
    if (isInstitutionHref(href)) {
      return resolveInstitutionHref(href as string, activeInstitutionId);
    }
    return href;
  };

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-100 cursor-pointer active:scale-95 transition-transform"
          onClick={() => router.push("/profile")}
        >
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName}
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-violet-100 text-violet-700 text-lg font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">{greeting},</p>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">{displayName}</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 text-[11px] sm:text-xs text-slate-500">
            {roleText && <span className="truncate">{roleText}</span>}
            {roleText && institutionText && <span className="hidden sm:inline text-slate-300">•</span>}
            {institutionText && <span className="truncate">{institutionText}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">
            {currentDate}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <svg
            className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari menu..."
          className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white border border-slate-200 text-slate-700 placeholder:text-slate-400 shadow-sm rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
        />
      </div>

      {/* Menu Grid */}
      {isLoading ? (
        <MenuGridSkeleton />
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-5">
          {filteredMenus.map((menu, idx) => {
            const isActive =
              menu.href && currentModule === "tugas_harian"
                ? searchParams.get("module") === menu.href.split("=")[1]
                : false;
            const Icon = getLucideIcon(menu.label);

            return (
              <button
                key={menu.label}
                onClick={() => {
                  if (menu.href && !menu.href.includes("?module=")) {
                    handleNavigate(menu.href);
                  } else if (menu.href && menu.href.includes("?module=")) {
                    const mod = menu.href.split("=")[1];
                    switchToModule(mod);
                  } else if (menu.submenu && menu.submenu.length > 0) {
                    handleSubmenuNavigate(menu.submenu[0].href);
                  }
                }}
                className={`flex flex-col items-center gap-1.5 group min-h-[72px] ${
                  menu.submenu && menu.submenu.length > 0 ? "" : ""
                }`}
              >
                <AppIcon
                  label={menu.label}
                  size={56}
                  iconSize={26}
                  category={resolveCategory(menu.label)}
                  active={isActive}
                  icon={Icon ? <Icon /> : undefined}
                />
                <span className="text-[11px] sm:text-xs font-medium text-slate-600 text-center leading-tight line-clamp-2">
                  {menu.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
