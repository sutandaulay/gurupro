"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useProfileStore, useTeacherStore } from "@/lib/stores";
import AppIcon from "@/app/components/ui/AppIcon";
import { getLucideIcon, masterMenus, resolveCategory } from "@/lib/menuConfig";
import {
  IconX,
  IconChevronDown,
  IconBuilding,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}

export default function Sidebar({ isOpen, onClose, onNavigate }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const profile = useProfileStore(s => s.profile);
  const [expandedItems, setExpandedItems] = useState<{[key: string]: boolean}>({});
  const [roleFlags, setRoleFlags] = useState<{ isWaliKelas: boolean; isPembinaEkskul: boolean } | null>(null);

  const {
    schools,
    activeSchoolId,
    setActiveSchool,
  } = useTeacherStore();
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const [pendingSchool, setPendingSchool] = useState<{ id: string; name: string } | null>(null);
  const [tokenStatus, setTokenStatus] = useState<any>(null);

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

  const handleSchoolChange = (schoolId: string) => {
    setActiveSchool(schoolId);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("gurupro_school_selected", schoolId);
      window.dispatchEvent(new Event("gurupro_school_changed"));
    }
  };

  useEffect(() => {
    const fetchTokenStatus = async () => {
      try {
        const res = await apiFetch("/api/user/token-status");
        if (res.ok) {
          const data = await res.json();
          setTokenStatus(data);
        }
      } catch (err) {
        console.error("Gagal memuat status token:", err);
      }
    };

    fetchTokenStatus();

    // Listen to token updates
    window.addEventListener("gurupro_token_updated", fetchTokenStatus);
    return () => window.removeEventListener("gurupro_token_updated", fetchTokenStatus);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        document.body.style.overflow = 'unset';
      } else if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : "";

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const isExpanded = (label: string) => !!expandedItems[label];

  const resolveHref = (href?: string) => {
    if (!href) return "";
    if (href === "/dashboard/institution" || href.startsWith("/dashboard/institution/")) {
      return activeSchoolId ? `/dashboard/institution/${activeSchoolId}/operator` : "/dashboard";
    }
    return href;
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    const resolved = resolveHref(href);
    return pathname === resolved || pathname.startsWith(resolved + "?") || pathname.startsWith(resolved + "/");
  };

  const handleLogout = async () => {
    // Clear client-side stores first
    useProfileStore.getState().clearProfile();
    useTeacherStore.getState().resetContext();

    // Clear sessionStorage and localStorage
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      localStorage.removeItem('gurupro-profile-store');
      localStorage.removeItem('gurupro-teacher-store');
    }

    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    }
    await signOut({ redirect: true, callbackUrl: "/" });
  };

  const handleNavigateClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    try {
      const url = new URL(href, window.location.origin);
      const isDashboard = url.pathname === "/dashboard" || url.pathname === "/dashboard/";
      const module = url.searchParams.get("module");
      const tab = url.searchParams.get("tab");

      const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
      const isOnDashboardPage = currentPath === "/dashboard" || currentPath === "/dashboard/";

      console.log("[Sidebar.tsx] handleNavigateClick:", { href, isDashboard, isOnDashboardPage, module, tab, currentPath });

      if (isDashboard && isOnDashboardPage) {
        e.preventDefault();
        onNavigate?.();

        if (window.innerWidth < 768) {
          onClose();
        }

        if (module) {
          window.dispatchEvent(new CustomEvent("switchModule", { detail: { module } }));
        } else {
          window.dispatchEvent(new CustomEvent("switchModule", { detail: { module: "tugas_harian" } }));
        }

        if (module === "keuangan" && tab) {
          window.dispatchEvent(new CustomEvent("switchFinanceTab", { detail: { tab } }));
        }

        const newUrl = url.pathname + url.search;
        window.history.replaceState({}, "", newUrl);
      } else {
        onNavigate?.();
        if (typeof window !== "undefined" && window.innerWidth < 768) {
          onClose();
        }
      }
    } catch (err) {
      onNavigate?.();
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        onClose();
      }
    }
  };

  return (
    <>
      {/* Backdrop: Hanya muncul di mobile (< md) jika isOpen = true */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[998] md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container: Drawer di mobile, toggleable di desktop (>= md) */}
      <div
        className={`fixed top-0 left-0 h-full w-[80vw] max-w-[280px] md:w-64 bg-white shadow-xl md:shadow-none z-[999] md:z-40 border-r border-gray-200/80 transform transition-transform duration-300 ease-in-out md:top-16 md:h-[calc(100vh-4rem)] ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
      >
        {/* Header hanya muncul di mobile */}
        <div className="p-4 border-b border-gray-150 flex items-center justify-between md:hidden">
          <h2 className="text-lg font-bold text-gray-900">Menu</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 cursor-pointer"
          >
            <IconX size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 custom-scrollbar">
          {/* School Selector (Pemilih Sekolah Aktif) */}
          {schools.length > 0 && (
            <div className="mb-4 px-2 relative">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 px-1">
                Sekolah Aktif
              </label>
              <button
                onClick={() => setIsSchoolDropdownOpen(!isSchoolDropdownOpen)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs transition-colors cursor-pointer justify-between text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <IconBuilding size={14} className="text-violet-600 shrink-0" />
                  <span className="text-gray-700 font-semibold truncate">
                    {schools.find(s => s.id === activeSchoolId)?.nama_sekolah || "Pilih Sekolah"}
                  </span>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isSchoolDropdownOpen ? 'rotate-180' : ''} shrink-0`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isSchoolDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSchoolDropdownOpen(false)} />
                  <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 animate-fade-in max-h-64 overflow-y-auto">
                    <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50/50">
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                        Ganti Sekolah Aktif
                      </p>
                    </div>
                    {schools.map((school) => (
                      <button
                        key={school.id}
                        onClick={() => {
                          setPendingSchool({ id: school.id, name: school.nama_sekolah });
                          setIsSchoolDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left hover:bg-gray-50 transition-colors cursor-pointer ${
                          activeSchoolId === school.id
                            ? 'bg-violet-50 text-violet-700 font-semibold'
                            : 'text-gray-700'
                        }`}
                      >
                        <IconBuilding size={14} className="shrink-0 text-gray-400" />
                        <span className="truncate">{school.nama_sekolah}</span>
                        {activeSchoolId === school.id && (
                          <span className="ml-auto">
                            <svg className="w-3.5 h-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Divider jika pemilih sekolah aktif tampil */}
          {schools.length > 0 && <div className="border-b border-gray-100/80 mb-4 mx-2" />}

          <Dialog open={!!pendingSchool} onOpenChange={(open) => { if (!open) setPendingSchool(null); }}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Pindah Sekolah</DialogTitle>
                <DialogDescription>
                  Yakin ingin pindah ke <span className="font-semibold text-slate-800">{pendingSchool?.name}</span>?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <button
                  type="button"
                  onClick={() => setPendingSchool(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingSchool) {
                      handleSchoolChange(pendingSchool.id);
                      setPendingSchool(null);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
                >
                  Ya, Pindah
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {(() => {
            const visibleMenus = roleFlags
              ? masterMenus.filter((item) => {
                  if (item.label === "Wali Kelas" && !roleFlags.isWaliKelas) return false;
                  if (item.label === "Pembina Eskul" && !roleFlags.isPembinaEkskul) return false;
                  return true;
                })
              : masterMenus;

            return visibleMenus.map((item) => {
              const Icon = getLucideIcon(item.label);

              if (item.href && !item.submenu) {
                const resolvedHref = resolveHref(item.href);
                const active = isActive(resolvedHref);
                return (
                  <Link
                    key={item.label}
                    href={resolvedHref}
                    onClick={(e) => handleNavigateClick(e, resolvedHref)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer mb-1 ${
                      active
                        ? "bg-violet-600 text-white shadow-md shadow-violet-500/10"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {Icon && <AppIcon label={item.label} size={40} iconSize={20} category={resolveCategory(item.label)} active={active} icon={<Icon />} />}
                    <span className="flex-1 text-left">{item.label}</span>
                  </Link>
                );
              }

              const expanded = isExpanded(item.label);
              const anyChildActive = item.submenu?.some((s) => isActive(s.href)) || false;

              return (
                <div key={item.label} className="mb-1">
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      anyChildActive && !expanded
                        ? "bg-violet-50 text-violet-650 font-semibold"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {Icon && <AppIcon label={item.label} size={40} iconSize={20} category={resolveCategory(item.label)} active={anyChildActive} icon={<Icon />} />}
                    <span className="flex-1 text-left">{item.label}</span>
                    <IconChevronDown
                      size={16}
                      stroke={1.5}
                      className={`transition-transform duration-200 text-gray-400 ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {expanded && item.submenu && (
                    <div className="ml-4 mt-1 mb-1 rounded-lg bg-gray-50/60 border border-gray-100/80 overflow-hidden">
                      {item.submenu.map((sub) => {
                        const resolvedHref = resolveHref(sub.href);
                        const active = isActive(resolvedHref);
                        const SubIcon = getLucideIcon(sub.label);
                        return (
                          <Link
                            key={sub.label}
                            href={resolvedHref}
                            onClick={(e) => handleNavigateClick(e, resolvedHref)}
                            className={`flex items-center gap-3 px-4 py-2.5 text-xs transition-colors cursor-pointer ${
                              active
                                ? "bg-violet-50 text-violet-700 font-semibold border-l-2 border-violet-600"
                                : "text-gray-600 hover:bg-gray-100/80"
                            }`}
                          >
                            {SubIcon && <AppIcon label={sub.label} size={28} iconSize={14} category={resolveCategory(sub.label)} active={active} icon={<SubIcon />} />}
                            <span className="truncate">{sub.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </nav>

        <div className="border-t border-gray-150 p-4 bg-white sticky bottom-0">
          {/* Token Status Card - Compact & Dynamic Layout */}
          {(() => {
            const balance = tokenStatus?.total_token_balance ?? 0;
            const isLow = balance <= 3;
            const isZero = balance === 0;

            let cardBg = "bg-violet-50/70 border-violet-100/50 shadow-[0_2px_8px_rgba(124,58,237,0.02)]";
            let labelColor = "text-violet-700";
            let balanceColor = "text-violet-900";
            let badgeBg = "bg-violet-150 text-violet-750";

            if (isZero) {
              cardBg = "bg-red-50/70 border-red-200/50 shadow-sm";
              labelColor = "text-red-700";
              balanceColor = "text-red-900";
              badgeBg = "bg-red-100 text-red-700";
            } else if (isLow) {
              cardBg = "bg-amber-50/70 border-amber-200/50 shadow-sm";
              labelColor = "text-amber-700";
              balanceColor = "text-amber-900";
              badgeBg = "bg-amber-100 text-amber-700";
            }

            return (
              <div className={`border rounded-xl p-3 mb-2 transition-colors duration-300 ${cardBg}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider block ${labelColor}`}>
                      Sisa Poin AI
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className={`text-lg font-extrabold leading-none ${balanceColor}`}>
                        {balance.toLocaleString("id-ID")}
                      </span>
                      <span className={`text-[9px] font-bold ${isZero ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-violet-500'}`}>
                        Poin
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${badgeBg}`}>
                      {tokenStatus?.subscription_status === "active" ? "PRO" : "FREE"}
                    </span>
                    {tokenStatus?.main_token_reset_date && (
                      <span className={`text-[8px] whitespace-nowrap ${isZero ? 'text-red-400' : isLow ? 'text-amber-500/90' : 'text-violet-500/90'}`}>
                        Reset: {new Date(tokenStatus.main_token_reset_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                </div>
                {isLow && (
                  <div className="mt-2 pt-1.5 border-t border-dashed border-current/10 flex items-center justify-between gap-1 text-[8px] font-bold">
                    <span className={isZero ? "text-red-650" : "text-amber-750"}>
                      {isZero ? "Poin habis!" : "Poin hampir habis!"}
                    </span>
                    <a
                      href="/dashboard/billing?tab=token"
                      className={`px-1.5 py-0.5 rounded transition-colors ${
                        isZero
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-amber-600 text-white hover:bg-amber-700"
                      }`}
                    >
                      Top-Up
                    </a>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </>
  );
}
