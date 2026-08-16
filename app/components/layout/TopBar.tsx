"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  IconMaximize,
  IconMinimize,
} from "@tabler/icons-react";
import dynamic from "next/dynamic";
import ThemeToggle from "@/components/ThemeToggle";
import { useTeacherStore, useProfileStore } from "@/lib/stores";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const PoinTopUpModal = dynamic(() => import("@/app/components/ui/PoinTopUpModal"), { ssr: false });

// Helper function to format time ago
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const profile = useProfileStore(s => s.profile);
  const fetchProfile = useProfileStore(s => s.fetchProfile);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch notifications from API
  const fetchNotifications = async () => {
    if (!profile?.id) return;

    setIsLoadingNotifications(true);
    try {
      const res = await apiFetch("/api/user/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  // Mark all notifications as read
  const markAllNotificationsRead = async () => {
    try {
      await apiFetch("/api/user/notifications?markAllRead=true", { method: "PUT" });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  // Fetch notifications when profile loads
  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();

      // Refresh notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [profile?.id]);

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error("Gagal mengubah mode layar penuh:", err);
    }
  };

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
  const teacherSchools = useTeacherStore((s) => s.schools);
  const activeSchoolId = useTeacherStore((s) => s.activeSchoolId);
  const [isContextDropdownOpen, setIsContextDropdownOpen] = useState(false);
  const [pendingSchool, setPendingSchool] = useState<{ id: string; name: string } | null>(null);

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const isLoading = useProfileStore(s => s.isLoading);

  // Session-aware school selection
  useEffect(() => {
    // Only proceed if profile is loaded and not loading
    if (!profile || isLoading) return;

    apiFetch("/api/schools")
      .then(async (r) => {
        if (!r.ok) return [];
        const data = await r.json();
        if (!Array.isArray(data)) return [];

        // Get current session user ID for validation
        const currentUserId = profile?.id;
        if (!currentUserId) return data;

        // Filter schools to only those belonging to current user
        const userSchools = data.filter((s: any) =>
          s.user_id === currentUserId || s.userId === currentUserId
        );

        // Use user's schools, or all schools if filter returns empty
        const validSchools = userSchools.length > 0 ? userSchools : data;

        setSchools(validSchools);
        setStoreSchools(validSchools);

        // Get saved school ID from session storage
        const savedSchoolId = sessionStorage.getItem("gurupro_school_selected");

        // Validate saved school exists for current user
        if (savedSchoolId) {
          const savedSchoolExists = validSchools.some((s: any) => String(s.id) === String(savedSchoolId));
          if (savedSchoolExists) {
            setSelectedSchoolId(savedSchoolId);
            setStoreActiveSchool(savedSchoolId);
            return;
          }
        }

        // Get school from profile's activeSchool
        const profileActiveSchool = profile?.activeSchool?.id;
        if (profileActiveSchool) {
          const profileSchoolExists = validSchools.some((s: any) => String(s.id) === String(profileActiveSchool));
          if (profileSchoolExists) {
            setSelectedSchoolId(String(profileActiveSchool));
            setStoreActiveSchool(String(profileActiveSchool));
            sessionStorage.setItem("gurupro_school_selected", String(profileActiveSchool));
            return;
          }
        }

        // Only set first school if user has exactly one school
        if (validSchools.length === 1) {
          setSelectedSchoolId(String(validSchools[0].id));
          setStoreActiveSchool(String(validSchools[0].id));
          sessionStorage.setItem("gurupro_school_selected", String(validSchools[0].id));
        } else if (validSchools.length > 1) {
          // For multiple schools, require explicit selection - don't auto-select
          // Clear any previous selection
          sessionStorage.removeItem("gurupro_school_selected");
        }
      })
      .catch(() => {});
  }, [profile, isLoading]);

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

  const markAllRead = useCallback(async () => {
    try {
      await apiFetch("/api/user/notifications?markAllRead=true", { method: "PUT" });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
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
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center px-4 shadow-sm">
      <div className="flex items-center justify-between w-full max-w-[1400px] 2xl:max-w-[1800px] mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 cursor-pointer"
            aria-label="Toggle menu"
          >
            <IconMenu2 size={20} />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="bg-violet-600 p-2 rounded-lg">
              <IconCapRounded size={20} className="text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 hidden sm:block">
              Guru<span className="text-violet-600">PRO</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar hanya ditampilkan di layar besar/tablet landscape */}
          <div className="hidden lg:flex items-center bg-gray-100 rounded-lg px-3 py-2 w-64">
            <IconSearch size={16} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Cari..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none text-sm flex-1 text-gray-700"
            />
          </div>
          
          <div className="flex items-center gap-2">
            {/* School Switcher — sama di semua ukuran layar */}
            {teacherSchools.length > 0 && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setIsContextDropdownOpen(!isContextDropdownOpen)}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs transition-colors cursor-pointer min-w-0"
                  aria-label="Pilih Sekolah"
                >
                  <IconBuilding size={14} className="text-violet-600 shrink-0" />
                  <span className="hidden sm:inline text-gray-800 font-semibold max-w-[120px] truncate">
                    {teacherSchools.find(s => s.id === activeSchoolId)?.nama_sekolah || "Pilih Sekolah"}
                  </span>
                  <svg
                    className={`w-3 h-3 text-gray-400 transition-transform ${isContextDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isContextDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsContextDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1 animate-fade-in max-h-64 overflow-y-auto">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          Ganti Sekolah Aktif
                        </p>
                      </div>
                      {teacherSchools.map((school) => (
                        <button
                          key={school.id}
                          onClick={() => {
                            setPendingSchool({ id: school.id, name: school.nama_sekolah });
                            setIsContextDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left hover:bg-gray-50 transition-colors cursor-pointer ${
                            activeSchoolId === school.id
                              ? 'bg-violet-50 text-violet-700 font-semibold'
                              : 'text-gray-700'
                          }`}
                        >
                          {school.logo ? (
                            <img src={school.logo} alt={school.nama_sekolah} className="w-4 h-4 shrink-0 object-contain rounded" />
                          ) : (
                            <IconBuilding size={14} className="shrink-0 text-gray-400" />
                          )}
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
                        setStoreActiveSchool(pendingSchool.id);
                        sessionStorage.setItem("gurupro_school_selected", pendingSchool.id);
                        window.dispatchEvent(new Event("gurupro_school_changed"));
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

             {/* Beli Poin Ekstra Quick Button */}
            <button
              onClick={() => setShowTopUp(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-bold transition-all border border-violet-100 cursor-pointer shrink-0"
            >
              <svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Beli Poin</span>
            </button>

            {/* Theme Toggle */}
            <ThemeToggle variant="icon" />

            {/* Fullscreen Toggle Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 relative cursor-pointer"
              aria-label="Toggle Fullscreen"
              title={isFullscreen ? "Keluar Layar Penuh" : "Mode Layar Penuh"}
            >
              {isFullscreen ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  setShowNotif(!showNotif);
                  // Refresh notifications when opening
                  if (!showNotif) fetchNotifications();
                }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 relative cursor-pointer"
                aria-label="Notifications"
              >
                <IconBell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {showNotif && (
                <div
                  ref={notifRef}
                  className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-[420px] overflow-hidden flex flex-col"
                >
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-violet-50 to-indigo-50">
                    <h3 className="font-bold text-gray-900">🔔 Notifikasi</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                      >
                        Tandai semua dibaca
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {isLoadingNotifications ? (
                      <div className="p-8 text-center text-gray-400">
                        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-xs">Memuat...</p>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <span className="text-4xl">📭</span>
                        <p className="text-gray-500 text-sm mt-2">Tidak ada notifikasi</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-4 border-b border-gray-50 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                            !notif.is_read ? "bg-blue-50/50 border-l-2 border-l-indigo-500" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {!notif.is_read && (
                              <span className="w-2 h-2 bg-indigo-500 rounded-full mt-2 shrink-0"></span>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 text-sm">{notif.title}</h4>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notif.body}</p>
                              <p className="text-[10px] text-gray-400 mt-2">
                                {formatTimeAgo(notif.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                {profile?.photo_url || session?.user?.image ? (
                  <img
                    src={profile?.photo_url || session?.user?.image || ""}
                    alt={session?.user?.name || "User"}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold">
                    {initials}
                  </div>
                )}
                <span className="hidden lg:inline text-sm font-medium text-gray-700 max-w-[100px] truncate">
                  {session?.user?.name?.split(" ")[0] || "Pengguna"}
                </span>
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <p className="font-medium text-gray-900 truncate">
                      {session?.user?.name || "Pengguna"}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {session?.user?.email || ""}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setShowDropdown(false); router.push('/profile'); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                    >
                      <IconUser size={16} />
                      Profil Saya
                    </button>
                    <button
                      onClick={() => { setShowDropdown(false); setShowTopUp(true); }}
                      className="w-full text-left px-4 py-2 text-sm text-violet-750 hover:bg-violet-50 flex items-center gap-2 font-semibold cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                       Beli Poin Ekstra
                    </button>
                    <button
                      onClick={() => { setShowDropdown(false); router.push('/settings'); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                    >
                      <IconSettings size={16} />
                      Pengaturan
                    </button>
                    <button
                      onClick={triggerPwaInstall}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                    >
                      <IconCreditCard size={16} />
                      Instal Aplikasi
                    </button>
                    <button
                      onClick={() => { setShowDropdown(false); router.push('/help'); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                    >
                      <IconHelp size={16} />
                      Bantuan
                    </button>
                    <button
                      onClick={async () => {
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
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                    >
                      <IconLogout size={16} />
                      Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showTopUp && (
        <PoinTopUpModal
          open={showTopUp}
          onClose={() => setShowTopUp(false)}
          userId={session?.user?.id || (session as any)?.id || null}
        />
      )}
    </header>
  );
}
