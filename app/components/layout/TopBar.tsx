"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  IconMenu2,
  IconCapRounded,
  IconBuilding,
  IconSearch,
  IconBell,
  IconUser,
  IconSettings,
  IconHelp,
  IconLogout,
  IconCreditCard,
} from "@tabler/icons-react";
import dynamic from "next/dynamic";
import InstitutionSwitcher from "@/app/components/institution-switcher";
import { useTeacherStore, useProfileStore } from "@/lib/stores";

const TokenTopUpModal = dynamic(() => import("@/app/components/ui/TokenTopUpModal"), { ssr: false });

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const { data: session } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const profile = useProfileStore(s => s.profile);
  const fetchProfile = useProfileStore(s => s.fetchProfile);
  const [notifications, setNotifications] = useState<any[]>([
    { id: "welcome", title: "Selamat Datang!", body: "Terima kasih telah bergabung dengan GuruPRO.", time: "Baru saja", read: false },
  ]);
  const [showTopUp, setShowTopUp] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const triggerPwaInstall = async () => {
    if (!deferredPrompt) {
      alert("Cara Menginstal GuruPRO di Perangkat Anda:\n\n- Android (Chrome): Klik ikon titik tiga di kanan atas, lalu pilih 'Instal aplikasi' atau 'Tambahkan ke Layar Utama'.\n- iPhone/Safari: Klik tombol 'Share' (kotak dengan panah ke atas) di bawah, lalu pilih 'Tambahkan ke Layar Utama' (Add to Home Screen).\n- Laptop (Chrome/Edge): Klik ikon monitor dengan tanda plus di sebelah kanan address bar browser.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install choice outcome: ${outcome}`);
    setDeferredPrompt(null);
  };
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const schoolDropdownRef = useRef<HTMLDivElement>(null);

  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const setStoreActiveSchool = useTeacherStore((s) => s.setActiveSchool);
  const setStoreSchools = useTeacherStore((s) => s.setSchools);

  useEffect(() => {
    fetchProfile();

    fetch("/api/schools")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSchools(data);
          setStoreSchools(data);
          const savedSchoolId = sessionStorage.getItem("gurupro_school_selected");
          if (savedSchoolId && data.some((s) => s.id === savedSchoolId)) {
            setSelectedSchoolId(savedSchoolId);
            setStoreActiveSchool(savedSchoolId);
          } else if (data.length > 0) {
            setSelectedSchoolId(data[0].id);
            setStoreActiveSchool(data[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Listen to external school changes (e.g. from welcome modal)
  useEffect(() => {
    const handleGlobalSchoolChange = () => {
      const savedSchoolId = sessionStorage.getItem("gurupro_school_selected");
      if (savedSchoolId) {
        setSelectedSchoolId(savedSchoolId);
      }
    };
    window.addEventListener("gurupro_school_changed", handleGlobalSchoolChange);
    return () => window.removeEventListener("gurupro_school_changed", handleGlobalSchoolChange);
  }, []);

  const handleSchoolChange = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    setStoreActiveSchool(schoolId);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("gurupro_school_selected", schoolId);
      window.dispatchEvent(new Event("gurupro_school_changed"));
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
      if (
        notifRef.current &&
        !notifRef.current.contains(e.target as Node)
      ) {
        setShowNotif(false);
      }
      if (
        schoolDropdownRef.current &&
        !schoolDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSchoolDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = profile?.nama_lengkap || session?.user?.name || "Pengguna";
  const displayEmail = profile?.email || session?.user?.email || "";

  const initials = displayName
    ? displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "GP";

  const profilePhotoUrl = profile?.photo_url || session?.user?.image || null;

  const avatarContent = profilePhotoUrl ? (
    <img
      src={profilePhotoUrl}
      alt={displayName}
      className="w-8 h-8 rounded-full object-cover"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold">
      {initials}
    </div>
  );

  return (
    <header className="sticky top-0 z-50 h-16 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          {/* Token indicator */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setShowTopUp(true)}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-sm font-semibold hover:bg-violet-100"
            >
              <span className="text-xs">Token:</span>
              <span className="text-sm">{profile ? Number(profile.token_limit || 0) : "—"}</span>
              <span className="text-xs text-gray-400">+</span>
              <span className="text-sm">{profile ? Number(profile.addon_token_balance || 0) : "—"}</span>
            </button>
          </div>
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            aria-label="Toggle sidebar"
          >
            <IconMenu2 size={22} stroke={1.5} />
          </button>
          <a href="/dashboard" className="flex items-center gap-2">
            <IconCapRounded size={26} stroke={1.5} className="text-violet-600" />
            <span className="text-lg font-bold text-gray-900">
              Guru<span className="text-violet-600">PRO</span>
            </span>
          </a>
        </div>

        {/* Center - Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <IconSearch
              size={18}
              stroke={1.5}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari fitur, dokumen..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* School Selector (Pemilih Sekolah Mandiri - Custom Dropdown) */}
        {schools.length > 0 && (
          <div className="hidden sm:flex relative mr-2" ref={schoolDropdownRef}>
            <button
              onClick={() => {
                setIsSchoolDropdownOpen(!isSchoolDropdownOpen);
                setShowDropdown(false);
                setShowNotif(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm transition-colors cursor-pointer"
            >
              <IconBuilding size={16} stroke={1.5} className="text-violet-600 shrink-0" />
              <span className="text-gray-800 font-medium max-w-[145px] truncate">
                {schools.find(s => s.id === selectedSchoolId)?.nama_sekolah || "Pilih Sekolah"}
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isSchoolDropdownOpen ? 'rotate-180' : ''}`}
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
                <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-dropdown py-1 animate-fade-in">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      Ruang Kerja Pribadi / Sekolah
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {schools.map((school) => (
                      <button
                        key={school.id}
                        onClick={() => {
                          handleSchoolChange(school.id);
                          setIsSchoolDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedSchoolId === school.id
                            ? 'bg-violet-50 text-violet-700 font-semibold'
                            : 'text-gray-700'
                        }`}
                      >
                        <IconBuilding size={16} stroke={1.5} className="shrink-0" />
                        <span className="truncate">{school.nama_sekolah}</span>
                        {selectedSchoolId === school.id && (
                          <span className="ml-auto">
                            <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Institution Switcher */}
        <div className="hidden md:flex items-center mr-2">
          <InstitutionSwitcher />
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* PWA Install Button */}
          <button
            onClick={triggerPwaInstall}
            className={`bg-indigo-650 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer ${
              deferredPrompt ? "animate-bounce ring-2 ring-indigo-200" : ""
            }`}
          >
            <span>📲</span>
            <span className="hidden sm:inline">Instal Aplikasi</span>
          </button>

          {/* Admin Panel Button */}
          {profile?.role === "admin" && (
            <a
              href="/admin"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
            >
              <span>🛡️</span>
              <span className="hidden sm:inline">Admin Panel</span>
            </a>
          )}

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotif(!showNotif); setShowDropdown(false); }}
              className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 cursor-pointer"
            >
              <IconBell size={22} stroke={1.5} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-dropdown py-2 animate-fade-in z-50">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase">Notifikasi</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] text-violet-600 hover:text-violet-700 font-semibold cursor-pointer">
                      Tandai dibaca
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">Tidak ada notifikasi</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer ${!n.read ? "bg-violet-50/30" : ""}`}
                        onClick={() => setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))}
                      >
                        <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{n.body}</p>
                        <p className="text-[9px] text-gray-400 mt-1">{n.time}</p>
                      </div>
                    ))
                  )}
                </div>
                <a
                  href="/dashboard"
                  className="block px-4 py-2.5 text-center text-xs font-semibold text-violet-600 hover:bg-gray-50 border-t border-gray-100"
                >
                  Lihat Semua →
                </a>
              </div>
            )}
          </div>

          <div className="relative" ref={dropdownRef}>
            {showTopUp && (
              // Lazy load modal to avoid SSR issues
              // @ts-ignore
              <TokenTopUpModal open={showTopUp} onClose={() => setShowTopUp(false)} userId={profile?.id} />
            )}
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
            >
              {avatarContent}
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-dropdown py-2 animate-fade-in">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {displayEmail}
                  </p>
                </div>
                <div className="py-1">
                  <a
                    href="/profile?tab=billing"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <IconCreditCard size={18} stroke={1.5} className="text-gray-400" />
                    Billing & Langganan
                  </a>
                  <a
                    href="/profile"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <IconUser size={18} stroke={1.5} className="text-gray-400" />
                    Profil Saya
                  </a>
                  <a
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <IconSettings size={18} stroke={1.5} className="text-gray-400" />
                    Pengaturan
                  </a>
                  <a
                    href="https://wa.me/6281283960337"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <IconHelp size={18} stroke={1.5} className="text-gray-400" />
                    Bantuan
                  </a>
                </div>
                <div className="border-t border-gray-100 pt-1">
                  <button
                    onClick={async () => {
                      await fetch("/api/auth/logout", { method: "POST" });
                      signOut({ callbackUrl: "/login" });
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left cursor-pointer"
                  >
                    <IconLogout size={18} stroke={1.5} />
                    Keluar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
