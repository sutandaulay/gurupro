"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import EditProfileModal from "@/components/user/EditProfileModal";
import { useProfileStore } from "@/lib/stores";
import FaceEnrollmentSection from "@/components/settings/FaceEnrollmentSection";
import { Switch } from "@/components/ui/switch";
import { toast as sonnerToast } from "sonner";
import AppIcon from "@/app/components/ui/AppIcon";
import { User, CreditCard, Gift, Settings } from "lucide-react";
import { resolveCategory } from "@/lib/menuConfig";

type TabType = "profil" | "billing" | "referral" | "pengaturan";

interface UserPreferences {
  tema: string;
  zonaWaktu: string;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabFromUrl = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<TabType>("profil");
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [allSchools, setAllSchools] = useState<any[]>([]);
  const [profNama, setProfNama] = useState("");
  const [profUsername, setProfUsername] = useState("");
  const [profSekolah, setProfSekolah] = useState("");
  const [profBankName, setProfBankName] = useState("");
  const [profBankAccountNumber, setProfBankAccountNumber] = useState("");
  const [profBankAccountName, setProfBankAccountName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [referralsList, setReferralsList] = useState<any[]>([]);
  const [exchangeAmount, setExchangeAmount] = useState(10000);
  const [isProcessingReferralAction, setIsProcessingReferralAction] = useState(false);
  const [isShowPayoutModal, setIsShowPayoutModal] = useState(false);
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutBankAccountNumber, setPayoutBankAccountNumber] = useState("");
  const [payoutBankAccountName, setPayoutBankAccountName] = useState("");

  const NOTIF_DEFAULTS: NotificationSettings = { email: true, push: true, sms: false };
  const PREF_DEFAULTS: UserPreferences = { tema: "system", zonaWaktu: "Asia/Jakarta" };

  // Notification preferences
  const [notifications, setNotifications] = useState<NotificationSettings>(NOTIF_DEFAULTS);
  const notificationsRef = useRef(notifications);

  // Preferences
  const [preferences, setPreferences] = useState<UserPreferences>(PREF_DEFAULTS);
  const preferencesRef = useRef(preferences);

  // Preferensi tone notifikasi (Sprint 1.1)
  const TONE_OPTIONS = [
    { value: "hangat", label: "Hangat & Semangat", desc: "Bahasa akrab, seperti teman menyemangati", emoji: "🔥" },
    { value: "formal", label: "Formal & Jelas", desc: "Bahasa resmi, rapi, dan to the point", emoji: "📋" },
    { value: "santai", label: "Santai & Ringan", desc: "Bahasa cair, tidak kaku, enak dibaca", emoji: "😌" },
  ];
  const [notificationTone, setNotificationTone] = useState<string>("hangat");
  const [isSavingTone, setIsSavingTone] = useState(false);

  // Preferensi morning briefing (Sprint 2.2)
  const [morningBriefing, setMorningBriefing] = useState<boolean>(true);
  const [isSavingBriefing, setIsSavingBriefing] = useState(false);

  // Preferensi weekly recap (Sprint 2.1)
  const [weeklyRecap, setWeeklyRecap] = useState<boolean>(true);
  const [isSavingRecap, setIsSavingRecap] = useState(false);

  // Voice briefing preference
  const [voiceBriefingEnabled, setVoiceBriefingEnabled] = useState<boolean>(false);
  const [voiceNamePreference, setVoiceNamePreference] = useState<string>("");
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewingVoice, setPreviewingVoice] = useState<string>("");

  // Load from localStorage after hydration (avoid SSR mismatch)
  useEffect(() => {
    const savedPref = localStorage.getItem("gurupro_user_preferences");
    if (savedPref) {
      try {
        setPreferences(JSON.parse(savedPref));
      } catch (e) { /* ignore */ }
    }
    const savedNotif = localStorage.getItem("gurupro_notification_settings");
    if (savedNotif) {
      try { setNotifications(JSON.parse(savedNotif)); } catch (e) { /* ignore */ }
    }
  }, []);

  // Keep refs in sync with state
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);
  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);

  useEffect(() => {
    if (tabFromUrl === "billing") setActiveTab("billing");
  }, [tabFromUrl]);

  const fetchUserProfile = async () => {
    setIsLoading(true);
    try {
      const [profileRes, schoolsRes] = await Promise.all([
        apiFetch("/api/user/profile"),
        apiFetch("/api/schools"),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setUser(data);
        setProfNama(data.nama_lengkap || "");
        setProfUsername(data.username || "");
        setProfSekolah(data.activeSchool?.nama_sekolah || data.nama_sekolah || "");
        setProfBankName(data.bank_name || "");
        setProfBankAccountNumber(data.bank_account_number || "");
        setProfBankAccountName(data.bank_account_name || "");
      setNotificationTone(data.notification_tone || "hangat");
      setMorningBriefing(data.morning_briefing_enabled !== false);
      setWeeklyRecap(data.weekly_recap_enabled !== false);
      setVoiceBriefingEnabled(data.voice_briefing_enabled === true);
      setVoiceNamePreference(data.voice_name_preference || "");
      useProfileStore.getState().setProfile(data);
      } else {
        const err = await profileRes.json().catch(() => ({ error: "Gagal memuat profil" }));
        setError(err.error || "Gagal memuat profil");
      }
      if (schoolsRes.ok) {
        const schoolsData = await schoolsRes.json();
        setAllSchools(Array.isArray(schoolsData) ? schoolsData : []);
      }
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReferrals = async () => {
    try {
      const res = await apiFetch("/api/user/referrals").then((r) => r.json());
      if (Array.isArray(res)) setReferralsList(res);
    } catch (e) {
      console.error("Gagal mengambil referrals:", e);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchReferrals();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const allVoices = synth.getVoices();
      const idVoices = allVoices.filter((v) => /id/i.test(v.lang));
      setAvailableVoices(idVoices);
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  const fetchVoicePreferences = async () => {
    try {
      const res = await apiFetch("/api/notifications/voice-prefs");
      if (res.ok) {
        const data = await res.json();
        setVoiceBriefingEnabled(data.voice_briefing_enabled === true);
        setVoiceNamePreference(data.voice_name_preference || "");
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchVoicePreferences();
  }, []);

  // Apply theme — re-runs when preferences.tema changes (e.g. after localStorage load)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");

    if (preferences.tema === "dark") {
      root.classList.add("dark");
      document.body.classList.add("dark");
    } else if (preferences.tema === "light") {
      root.classList.add("light");
      document.body.classList.remove("dark");
    } else {
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isSystemDark) {
        root.classList.add("dark");
        document.body.classList.add("dark");
      } else {
        root.classList.add("light");
        document.body.classList.remove("dark");
      }
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const currentPrefs = preferencesRef.current;
        const root = document.documentElement;
        root.classList.remove("dark", "light");

        if (currentPrefs.tema === "dark") {
          root.classList.add("dark");
          document.body.classList.add("dark");
        } else if (currentPrefs.tema === "light") {
          root.classList.add("light");
          document.body.classList.remove("dark");
        } else {
          const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          if (isSystemDark) {
            root.classList.add("dark");
            document.body.classList.add("dark");
          } else {
            root.classList.add("light");
            document.body.classList.remove("dark");
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [preferences.tema]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSuccess = () => {
    showToast("success", "Profil berhasil diperbarui!");
    fetchUserProfile();
  };

  const saveProfile = async () => {
    if (!profNama.trim()) {
      showToast("error", "Nama lengkap wajib diisi!");
      return;
    }
    setIsSavingProfile(true);
    try {
      const response = await apiFetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_lengkap: profNama,
          username: profUsername,
          nama_sekolah: profSekolah,
          bank_name: profBankName,
          bank_account_number: profBankAccountNumber,
          bank_account_name: profBankAccountName
        })
      });
      if (!response.ok) throw new Error("Gagal meng-update profil.");
      const updated = await response.json();
      setUser(updated);
      useProfileStore.getState().setProfile(updated);
      showToast("success", "Profil berhasil diperbarui!");
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleReferralAction = async (
    action: "request_payout" | "exchange_tokens",
    amount: number,
    bankName?: string,
    bankAccNum?: string,
    bankAccName?: string
  ) => {
    setIsProcessingReferralAction(true);
    try {
      const res = await apiFetch("/api/user/referrals/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, amount, bank_name: bankName, bank_account_number: bankAccNum, bank_account_name: bankAccName })
      });
      if (res.ok) {
        const data = await res.json();
        showToast("success", data.message || "Aksi berhasil diproses!");
        fetchUserProfile();
        fetchReferrals();
        setIsShowPayoutModal(false);
      } else {
        const data = await res.json();
        showToast("error", data.error || "Gagal memproses aksi referral");
      }
    } catch (e) {
      showToast("error", "Koneksi gagal saat menghubungi server");
    } finally {
      setIsProcessingReferralAction(false);
    }
  };

  const handleCheckout = async (planType: string) => {
    if (!user) return;
    setIsCheckingOut(true);
    try {
      const response = await apiFetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planType, userId: user.id })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal menginisialisasi pembayaran.");
      }
      const data = await response.json();
      if (typeof window !== "undefined") window.location.assign(data.checkoutUrl);
    } catch (err: any) {
      showToast("error", err.message);
      setIsCheckingOut(false);
    }
  };

  // Notification toggle handler
  const handleNotificationToggle = (key: keyof NotificationSettings) => {
    // Gunakan ref untuk mendapatkan nilai terbaru
    const currentNotifications = notificationsRef.current;
    const newNotifications = { ...currentNotifications, [key]: !currentNotifications[key] };
    setNotifications(newNotifications);
    notificationsRef.current = newNotifications;
    localStorage.setItem("gurupro_notification_settings", JSON.stringify(newNotifications));
    showToast("success", "Pengaturan notifikasi disimpan");
  };

  // Preference change handler — just update state & localStorage, let useEffect apply DOM
  const handlePreferenceChange = (key: keyof UserPreferences, value: string) => {
    const currentPreferences = preferencesRef.current;
    const newPreferences = { ...currentPreferences, [key]: value };
    setPreferences(newPreferences);
    preferencesRef.current = newPreferences;
    localStorage.setItem("gurupro_user_preferences", JSON.stringify(newPreferences));
    syncPreferenceToServer(key, value);
  };

  const syncPreferenceToServer = async (key: keyof UserPreferences, value: string) => {
    const body: Record<string, string> = {};
    if (key === "zonaWaktu") body.timezone = value;
    if (!body.timezone) return;
    try {
      const res = await apiFetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast("success", "Preferensi berhasil disimpan");
      }
    } catch {
      // silent
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric"
    });
  };

  const getSubscriptionBadge = (status: string) => {
    const badges: Record<string, { label: string; class: string }> = {
      three_month: { label: "🏆 PRO 3 Bulan", class: "bg-amber-100 text-amber-700 border-amber-200" },
      six_month: { label: "🏆 PRO 6 Bulan", class: "bg-amber-100 text-amber-700 border-amber-200" },
      one_year: { label: "🏆 PRO 1 Tahun", class: "bg-amber-100 text-amber-700 border-amber-200" },
      pro: { label: "🏆 PRO", class: "bg-amber-100 text-amber-700 border-amber-200" },
      active: { label: "🏆 PRO", class: "bg-amber-100 text-amber-700 border-amber-200" },
      free: { label: "⚡ Free", class: "bg-slate-100 text-slate-600 border-slate-200" },
    };
    if (badges[status]) return badges[status];
    if (status && status !== "free") {
      return badges.pro;
    }
    return badges.free;
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "profil", label: "Profil Saya", icon: <User size={18} /> },
    { id: "billing", label: "Billing & Langganan", icon: <CreditCard size={18} /> },
    { id: "referral", label: "Referral & Cashback", icon: <Gift size={18} /> },
    { id: "pengaturan", label: "Pengaturan", icon: <Settings size={18} /> },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Memuat profil...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 max-w-md">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Terjadi Kesalahan</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button onClick={fetchUserProfile} className="px-4 py-2 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition cursor-pointer">
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-xl dark:shadow-slate-900/50 animate-bounce ${toast.type === "error" ? "bg-rose-600" : "bg-emerald-600"}`}>
          {toast.type === "error" ? "✕" : "✅"} {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <Link href="/dashboard" className="hover:text-violet-600 dark:hover:text-violet-400 transition">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-800 dark:text-gray-200 font-medium">Profil Saya</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profil Saya</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Kelola informasi profil, langganan, dan pengaturan akun Anda</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-1.5 border border-gray-100 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
              activeTab === tab.id
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700"
            }`}
          >
            <AppIcon label={tab.label} size={36} iconSize={18} category={resolveCategory(tab.label)} active={activeTab === tab.id} icon={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB: Profil Saya */}
      {activeTab === "profil" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 overflow-hidden sticky top-20">
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-6 text-white text-center">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-white/20 backdrop-blur-sm mx-auto flex items-center justify-center text-3xl font-bold mb-3">
                  {user?.photo_url ? (
                    <img src={user.photo_url} alt="Foto Profil" className="w-full h-full object-cover" />
                  ) : (
                    <span>{user?.nama_lengkap ? user.nama_lengkap.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "GP"}</span>
                  )}
                </div>
                <h2 className="text-xl font-bold">{user?.nama_lengkap || "Nama Lengkap"}</h2>
                <p className="text-violet-100 text-sm mt-1">@{user?.username || "username"}</p>
                <div className="mt-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getSubscriptionBadge(user?.status_langganan).class}`}>
                    {getSubscriptionBadge(user?.status_langganan).label}
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {/* Quick Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profil Saya
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="py-2 bg-white dark:bg-slate-700 border border-violet-200 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Ganti Foto
                    </button>
                    <button
                      onClick={() => { setShowEditModal(true); }}
                      className="py-2 bg-white dark:bg-slate-700 border border-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Ubah Password
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600">📧</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Email</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600">💬</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">WhatsApp</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-mono">{user?.whatsapp ? `+62 ${user.whatsapp}` : "-"}</p>
                    </div>
                  </div>
                  {user?.nip && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600">🆔</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">NIP</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 font-mono">{user.nip}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-slate-700">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-2">Info Akun</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Status</span>
                    <span className={`font-bold ${user?.is_active === false ? "text-rose-600" : "text-emerald-600"}`}>
                      {user?.is_active === false ? "Nonaktif" : "Aktif"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Role</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300 uppercase">{user?.role === "admin" ? "Admin" : "Guru"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Terdaftar</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{formatDate(user?.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Edit Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active School Detail Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">🏫 Detail Sekolah Terpilih</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Semua sekolah yang Anda daftarkan, baik secara mandiri maupun melalui institusi</p>
              {allSchools.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    const institusi = allSchools.filter((s: any) => !s.is_owner);
                    const mandiri = allSchools.filter((s: any) => s.is_owner);
                    return (
                      <>
                        {institusi.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Via Institusi ({institusi.length})</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {institusi.map((school: any) => (
                                <div key={school.id} className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3 flex items-center justify-between">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                                      {school.nama_sekolah?.charAt(0) || "S"}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{school.nama_sekolah}</p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{school.npsn ? `NPSN: ${school.npsn}` : ""}{school.alamat ? ` • ${school.alamat}` : ""}</p>
                                    </div>
                                  </div>
                                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full text-[9px] font-bold whitespace-nowrap">Institusi</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {mandiri.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Mandiri ({mandiri.length})</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {mandiri.map((school: any) => (
                                <div key={school.id} className="bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3 flex items-center justify-between">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
                                      {school.nama_sekolah?.charAt(0) || "S"}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{school.nama_sekolah}</p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{school.npsn ? `NPSN: ${school.npsn}` : ""}{school.alamat ? ` • ${school.alamat}` : ""}</p>
                                    </div>
                                  </div>
                                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-full text-[9px] font-bold whitespace-nowrap">Mandiri</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>Sumber data: Master Data Sekolah</span>
                    <button
                      onClick={() => router.push('/dashboard?module=sekolah')}
                      className="text-violet-600 hover:text-violet-700 font-bold transition cursor-pointer"
                    >
                      Kelola di Master Data &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-3xl p-6 text-center">
                  <span className="text-2xl mb-2 block">⚠️</span>
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">Belum Ada Sekolah Terdaftar</h4>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 max-w-md mx-auto">
                    Anda belum mendaftarkan sekolah. Silakan daftarkan sekolah baru di menu Master Data.
                  </p>
                  <button
                    onClick={() => router.push('/dashboard?module=sekolah')}
                    className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Buka Master Data Sekolah
                  </button>
                </div>
              )}
            </div>

            {/* Bank Info */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">🏦 Informasi Rekening Bank</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Untuk pencairan cashback referral.</p>
              <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Nama Bank</label>
                  <input
                    type="text"
                    value={profBankName}
                    onChange={(e) => setProfBankName(e.target.value)}
                    placeholder="Contoh: Bank Mandiri, BCA, BRI"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:border-indigo-500 focus:outline-none bg-white dark:bg-slate-700 font-medium text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Nomor Rekening</label>
                  <input
                    type="text"
                    value={profBankAccountNumber}
                    onChange={(e) => setProfBankAccountNumber(e.target.value)}
                    placeholder="Contoh: 1234567890"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:border-indigo-500 focus:outline-none bg-white dark:bg-slate-700 font-medium text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Nama Pemilik Rekening</label>
                  <input
                    type="text"
                    value={profBankAccountName}
                    onChange={(e) => setProfBankAccountName(e.target.value)}
                    placeholder="Contoh: ElHanum"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:border-indigo-500 focus:outline-none bg-white dark:bg-slate-700 font-medium text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={saveProfile}
                disabled={isSavingProfile}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer disabled:opacity-50"
              >
                {isSavingProfile ? "Menyimpan..." : "Simpan Profil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Billing & Langganan */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Subscription Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">📦 Langganan & Kuota</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl border border-violet-100">
                <p className="text-[10px] text-violet-600 font-bold uppercase tracking-wide">Kuota Poin</p>
                <p className="text-2xl font-black text-violet-700 mt-1">{user?.quota_poin_available !== undefined ? user.quota_poin_available.toLocaleString("id-ID") : (user?.token_limit?.toLocaleString("id-ID") || 0)}</p>
                <p className="text-[10px] text-violet-500 mt-1">Poin tersedia</p>
                {user?.token_accumulated > 0 && (
                  <div className="mt-3 pt-3 border-t border-violet-200">
                    <p className="text-[10px] text-violet-500">Token akumulasi</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-violet-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-400 rounded-full transition-all"
                          style={{ width: `${Math.min(100, ((user?.token_accumulated || 0) / (user?.tokens_per_poin || 2000)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-violet-600">
                        {(user?.token_accumulated || 0).toLocaleString("id-ID")} / {(user?.tokens_per_poin || 2000).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <p className="text-[10px] text-violet-400 mt-1">
                      Butuh {(user?.tokens_per_poin || 2000) - (user?.token_accumulated || 0)} token lagi untuk potong 1 Poin
                    </p>
                  </div>
                )}
              </div>
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100">
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Masa Berlangganan</p>
                <p className="text-lg font-black text-emerald-700 mt-1">{user?.subscription_end ? formatDate(user.subscription_end) : "Tidak Aktif"}</p>
                <p className="text-[10px] text-emerald-500 mt-1">{user?.subscription_start ? `Awal: ${formatDate(user.subscription_start)}` : "Belum pernah langganan"}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl border border-amber-100">
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide">Status Paket</p>
                <p className="text-lg font-black text-amber-700 mt-1">
                  {user?.subscription_end && new Date(user.subscription_end) > new Date()
                    ? (user?.status_langganan === "free" ? "Free" :
                       user?.status_langganan === "three_month" ? "3 Bulan" :
                       user?.status_langganan === "six_month" ? "6 Bulan" :
                       user?.status_langganan === "one_year" ? "1 Tahun" :
                       user?.status_langganan === "pro" ? "PRO" : "Aktif")
                    : "Free"}
                </p>
                <p className="text-[10px] text-amber-500 mt-1">
                  {user?.subscription_end && new Date(user.subscription_end) > new Date()
                    ? `Aktif hingga ${Math.ceil((new Date(user.subscription_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} hari lagi`
                    : "Berakhir / Tidak aktif"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">⚡ Aksi Cepat</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/profile?tab=billing" className="p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">🚀 Upgrade ke PRO</p>
                    <p className="text-violet-100 text-xs mt-1">Dapatkan fitur premium</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition">→</span>
                </div>
              </Link>
              <Link href="/dashboard/administrasi" className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">📝 Administrasi</p>
                    <p className="text-emerald-100 text-xs mt-1">Kelola administrasi</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition">→</span>
                </div>
              </Link>
              <Link href="/dashboard?module=nilai" className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">📊 Kelola Nilai</p>
                    <p className="text-blue-100 text-xs mt-1">Input & export nilai</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition">→</span>
                </div>
              </Link>
              <Link href="/dashboard" className="p-4 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">🏠 Dashboard</p>
                    <p className="text-slate-200 text-xs mt-1">Kembali ke dashboard</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition">→</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Pricing Plans */}
          {(user as any)?.pricingPlans?.filter((p: any) => p.price > 0).length > 0 && (() => {
            const currentPlan = user.status_langganan || "free";
            const plans = (user as any).pricingPlans.filter((p: any) => p.price > 0);
            return (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-6" id="subscription-packages-section">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">💰 Paket Berlangganan</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {plans.map((plan: any) => {
                    const isActive = currentPlan === plan.id;
                    return (
                      <div key={plan.id} className={`p-4 rounded-xl border-2 flex flex-col justify-between ${isActive ? "border-violet-500 bg-violet-50/50 dark:bg-violet-900/30" : plan.popular ? "border-violet-300 dark:border-violet-600 bg-violet-50/30 dark:bg-violet-900/20" : "border-gray-100 dark:border-slate-600 bg-gray-50 dark:bg-slate-700"}`}>
                        <div>
                          {plan.popular && !isActive && (
                            <span className="inline-block px-2 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded-full mb-2">POPULER</span>
                          )}
                          {isActive && (
                            <span className="inline-block px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full mb-2">AKTIF</span>
                          )}
                          <p className="font-bold text-gray-800 dark:text-gray-200">{plan.package_name}</p>
                          <p className="text-2xl font-black text-violet-600 mt-1">Rp {plan.price.toLocaleString("id-ID")}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{plan.duration_days} Hari</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">{plan.tokens.toLocaleString("id-ID")} poin</p>
                        </div>
                        <button
                          onClick={() => handleCheckout(plan.id)}
                          disabled={isCheckingOut}
                          className={`w-full py-2 font-bold text-xs rounded-xl mt-4 transition-all duration-200 cursor-pointer disabled:opacity-50 ${isActive ? "bg-violet-600 text-white hover:bg-violet-700" : "bg-violet-600 text-white hover:bg-violet-700 hover:scale-[1.02]"}`}
                        >
                          {isCheckingOut ? "Memproses..." : isActive ? "Perpanjang Paket" : "Pilih Paket"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB: Referral & Cashback */}
      {activeTab === "referral" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">🎁 Program Referral &amp; Cashback</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Undang rekan guru untuk menggunakan GuruPro Premium dan nikmati reward instan! Setiap pembayaran sukses oleh referee akan menambahkan <strong>+20 Poin kuota</strong> ke akun Anda. Untuk paket <strong>6 bulan</strong> atau <strong>1 tahun</strong>, Anda juga mendapat tambahan <strong>Rp10.000 cashback</strong>. Pastikan teman Anda menggunakan kode referral Anda saat mendaftar.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200/80 dark:border-slate-600 rounded-2xl p-4">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block uppercase">Kode Referral Anda</span>
                <span className="text-lg font-black text-indigo-600 font-mono tracking-wider block mt-1">{user?.referral_code || "BELUM ADA"}</span>
              </div>
              <div className="flex flex-col gap-2 mt-3">
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      // Prioritas: env var > window.origin (fallback)
                      // Pastikan URL production di-set saat deploy!
                      const envUrl = process.env.NEXT_PUBLIC_APP_URL;
                      const isPlaceholder = !envUrl || envUrl.includes('your-') || envUrl === 'localhost';
                      const baseUrl = (envUrl && !isPlaceholder) ? envUrl : window.location.origin;
                      const refLink = `${baseUrl}/register?ref=${user?.referral_code}`;
                      navigator.clipboard.writeText(refLink);
                      showToast("success", "Link referral berhasil disalin! Bagikan ke teman dan pastikan mereka pakai kode ini saat mendaftar.");
                    }
                  }}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition text-center cursor-pointer"
                >
                  🔗 Salin Link Referral
                </button>
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      navigator.clipboard.writeText(user?.referral_code || "");
                      showToast("success", "Kode referral berhasil disalin!");
                    }
                  }}
                  className="w-full py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold transition text-center cursor-pointer"
                >
                  📋 Salin Kode Saja
                </button>
              </div>
              <p className="text-[9px] text-slate-400 mt-2 text-center">
                Reward masuk ke akun Anda saat teman bayar langganan.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200/80 dark:border-slate-600 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block uppercase">Total Cashback Terkumpul</span>
                <span className="text-lg font-black text-emerald-600 block mt-1">Rp {(user?.cashback_balance || 0).toLocaleString("id-ID")}</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium block mt-1">Batas minimum penarikan: Rp50.000</span>
              </div>
              <button
                disabled={isProcessingReferralAction || !user?.cashback_balance || user?.cashback_balance < 50000}
                onClick={() => {
                  setPayoutBankName(user?.bank_name || "");
                  setPayoutBankAccountNumber(user?.bank_account_number || "");
                  setPayoutBankAccountName(user?.bank_account_name || "");
                  setIsShowPayoutModal(true);
                }}
                className={`mt-3 w-full py-1.5 rounded-lg text-[10px] font-bold transition text-center cursor-pointer disabled:cursor-not-allowed ${user?.cashback_balance >= 50000 && !isProcessingReferralAction ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-100 dark:shadow-emerald-900/30" : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"}`}
              >
                {isProcessingReferralAction ? "Memproses..." : user?.cashback_balance >= 50000 ? "Cairkan Cashback" : "Cairkan Saldo (Min. Rp50rb)"}
              </button>
            </div>
          </div>

          {/* Token Conversion */}
          <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200/80 dark:border-slate-600 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block uppercase">Tukar Saldo dengan Poin</span>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Nilai Tukar: Rp 1.000 = 1 Poin kuota</p>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-700 px-2 py-0.5 rounded-md dark:text-indigo-300">Hasil: {Math.floor(exchangeAmount / 1000)} Poin</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1000}
                step={1000}
                max={user?.cashback_balance || 0}
                value={exchangeAmount}
                onChange={(e) => setExchangeAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs outline-none bg-slate-50 dark:bg-slate-700 font-bold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-600 focus:border-indigo-400"
                placeholder="Jumlah saldo untuk ditukar"
              />
              <button
                disabled={isProcessingReferralAction || exchangeAmount <= 0 || (user?.cashback_balance || 0) < exchangeAmount}
                onClick={() => handleReferralAction("exchange_tokens", exchangeAmount)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Tukar
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[5000, 10000, 20000, 50000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setExchangeAmount(preset)}
                  disabled={(user?.cashback_balance || 0) < preset}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition border cursor-pointer disabled:cursor-not-allowed ${
                    exchangeAmount === preset
                      ? "bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300"
                      : (user?.cashback_balance || 0) >= preset
                      ? "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                      : "bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600 text-slate-300 dark:text-slate-500"
                  }`}
                >
                  Rp {preset.toLocaleString("id-ID")}
                </button>
              ))}
              <button
                disabled={!(user?.cashback_balance || 0)}
                onClick={() => setExchangeAmount(user?.cashback_balance || 0)}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition border cursor-pointer disabled:cursor-not-allowed ${
                  exchangeAmount === (user?.cashback_balance || 0)
                    ? "bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300"
                    : (user?.cashback_balance || 0) > 0
                    ? "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                    : "bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600 text-slate-300 dark:text-slate-500"
                }`}
              >
                Maksimal
              </button>
            </div>
          </div>

          {/* Referral History */}
          <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200/80 dark:border-slate-600 rounded-2xl p-4">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block uppercase mb-2">Riwayat Undang Teman ({referralsList.length})</span>
            {referralsList.length === 0 ? (
              <div className="text-sm text-slate-400 dark:text-slate-500 italic text-center py-4">Belum ada teman yang terdaftar menggunakan kode referral Anda.</div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {referralsList.map((ref: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl p-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{ref.referee_name}</p>
                      <p className="text-slate-400 dark:text-slate-500 mt-0.5">{ref.referee_email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-indigo-600 dark:text-indigo-400">+{ref.reward_tokens} Poin</p>
                      <p className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5">+Rp {(ref.cashback_amount || 0).toLocaleString("id-ID")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Pengaturan */}
      {activeTab === "pengaturan" && (
        <div className="space-y-6">
          {/* Pendaftaran Wajah */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Pendaftaran Wajah</h3>
                  <p className="text-white/80 text-xs">Verifikasi presensi berbasis wajah</p>
                </div>
              </div>
            </div>
            {/* Card Body */}
            <div className="p-5">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Daftarkan wajah Anda untuk verifikasi presensi berbasis wajah di sekolah.
              </p>
              <FaceEnrollmentSection />
            </div>
          </div>

          {/* Notifikasi */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🔔</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Pengaturan Notifikasi</h3>
                  <p className="text-white/80 text-xs">Kelola cara Anda menerima notifikasi</p>
                </div>
              </div>
            </div>
            {/* Card Body */}
            <div className="p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex items-center justify-center">
                      <span className="text-lg">📧</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Email</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Notifikasi penting dikirim ke email</p>
                    </div>
                  </div>
                  <Switch checked={notifications.email} onCheckedChange={() => handleNotificationToggle("email")} />
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/40 rounded-lg flex items-center justify-center">
                      <span className="text-lg">📱</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Notifikasi Push</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Notifikasi langsung di perangkat</p>
                    </div>
                  </div>
                  <Switch checked={notifications.push} onCheckedChange={() => handleNotificationToggle("push")} />
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center">
                      <span className="text-lg">💬</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">SMS</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Notifikasi melalui pesan teks</p>
                    </div>
                  </div>
                  <Switch checked={notifications.sms} onCheckedChange={() => handleNotificationToggle("sms")} />
                </div>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-4 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg">💡 Pengaturan notifikasi disimpan secara lokal di perangkat ini.</p>
            </div>
          </div>

          {/* Gaya Bahasa Notifikasi */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">💬</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Gaya Bahasa Notifikasi</h3>
                  <p className="text-white/80 text-xs">Pilih tone yang paling nyaman untuk Anda</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TONE_OPTIONS.map((opt) => {
                  const active = notificationTone === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNotificationTone(opt.value)}
                      className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        active
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-200 dark:ring-emerald-700"
                          : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{opt.emoji}</span>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${
                          active ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 dark:border-slate-500 text-transparent"
                        }`}>✓</span>
                      </div>
                      <p className={`text-sm font-bold ${active ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}`}>{opt.label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={async () => {
                    setIsSavingTone(true);
                    try {
                      const res = await apiFetch("/api/user/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ notification_tone: notificationTone }),
                      });
                      if (!res.ok) throw new Error("Gagal menyimpan");
                      showToast("success", "Gaya bahasa notifikasi tersimpan!");
                    } catch {
                      showToast("error", "Gagal menyimpan gaya bahasa");
                    } finally {
                      setIsSavingTone(false);
                    }
                  }}
                  disabled={isSavingTone}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-100 cursor-pointer disabled:opacity-50"
                >
                  {isSavingTone ? "Menyimpan..." : "Simpan Gaya Bahasa"}
                </button>
              </div>
            </div>
          </div>

          {/* Preferensi Morning Briefing (Sprint 2.2) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 overflow-hidden">
            <div className="bg-gradient-to-r from-sky-500 to-indigo-500 p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">☀️</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Briefing Pagi</h3>
                  <p className="text-white/80 text-xs">Ringkasan jadwal & hal penting tiap pagi</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Setiap pagi, GuruPRO mengirimkan ringkasan singkat: jadwal mengajar, materi yang bisa dilanjutkan,
                tugas yang belum dikoreksi, dan siswa yang butuh perhatian. Anda bisa mematikan kapan saja.
              </p>
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Aktifkan Briefing Pagi</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {morningBriefing ? "Anda akan menerima briefing setiap pagi." : "Briefing tidak akan dikirim."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSavingBriefing(true);
                    const next = !morningBriefing;
                    try {
                      const res = await apiFetch("/api/user/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ morning_briefing_enabled: next }),
                      });
                      if (!res.ok) throw new Error("Gagal menyimpan");
                      setMorningBriefing(next);
                      showToast("success", next ? "Briefing pagi diaktifkan!" : "Briefing pagi dimatikan.");
                    } catch {
                      showToast("error", "Gagal menyimpan pengaturan briefing");
                    } finally {
                      setIsSavingBriefing(false);
                    }
                  }}
                  disabled={isSavingBriefing}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                    morningBriefing ? "bg-indigo-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      morningBriefing ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Preferensi Weekly Recap (Sprint 2.1) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🌟</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Rekap Mingguan</h3>
                  <p className="text-white/80 text-xs">Ringkasan kerja keras tiap akhir pekan</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Tiap Minggu malam, GuruPRO mengirimkan rekap hangat: sesi mengajar, siswa yang selesai remedial,
                dan progress kurikulum Anda. Bukan untuk dinilai, murni mengingatkan betapa produktifnya Anda.
              </p>
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Aktifkan Rekap Mingguan</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {weeklyRecap ? "Anda akan menerima recap tiap Minggu malam." : "Recap tidak akan dikirim."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSavingRecap(true);
                    const next = !weeklyRecap;
                    try {
                      const res = await apiFetch("/api/user/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ weekly_recap_enabled: next }),
                      });
                      if (!res.ok) throw new Error("Gagal menyimpan");
                      setWeeklyRecap(next);
                      showToast("success", next ? "Rekap mingguan diaktifkan!" : "Rekap mingguan dimatikan.");
                    } catch {
                      showToast("error", "Gagal menyimpan pengaturan recap");
                    } finally {
                      setIsSavingRecap(false);
                    }
                  }}
                  disabled={isSavingRecap}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                    weeklyRecap ? "bg-orange-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      weeklyRecap ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Voice Briefing */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 overflow-hidden">
            <div className="bg-gradient-to-r from-violet-500 to-purple-500 p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🔊</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Briefing Suara Sebelum Mengajar</h3>
                  <p className="text-white/80 text-xs">Dapatkan pengingat suara 10 menit sebelum jadwal mengajar</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Aktifkan Briefing Suara</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {voiceBriefingEnabled ? "Akan dijalankan otomatis saat mendekati jadwal." : "Briefing suara dimatikan."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSavingVoice(true);
                    const next = !voiceBriefingEnabled;
                    try {
                      const res = await apiFetch("/api/notifications/voice-prefs", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ voice_briefing_enabled: next }),
                      });
                      if (!res.ok) throw new Error("Gagal menyimpan");
                      setVoiceBriefingEnabled(next);
                      showToast("success", next ? "Briefing suara diaktifkan!" : "Briefing suara dimatikan.");
                    } catch {
                      showToast("error", "Gagal menyimpan pengaturan briefing suara");
                    } finally {
                      setIsSavingVoice(false);
                    }
                  }}
                  disabled={isSavingVoice}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                    voiceBriefingEnabled ? "bg-violet-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      voiceBriefingEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🗣️</span>
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Pilihan Suara</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Suara ini dipakai saat briefing dibacakan otomatis.</p>
                  </div>
                </div>
                <select
                  value={voiceNamePreference}
                  onChange={(e) => setVoiceNamePreference(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:border-violet-500 focus:outline-none bg-white dark:bg-slate-700 font-medium dark:text-slate-200"
                >
                  <option value="">— Pilih suara (default) —</option>
                  {availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!voiceNamePreference) {
                        showToast("error", "Pilih suara terlebih dahulu");
                        return;
                      }
                      const voice = availableVoices.find((v) => v.name === voiceNamePreference);
                      if (!voice) {
                        showToast("error", "Suara tidak ditemukan di perangkat ini");
                        return;
                      }
                      setPreviewingVoice(voice.name);
                      const utterance = new SpeechSynthesisUtterance(
                        "Selamat pagi, Bapak/Ibu Guru, 10 menit lagi Anda akan mulai mengajar pada kelas 5A mata pelajaran Matematika, mulai pukul 07.00 sampai pukul 08.30. Semangat Mengajar Pahlawan Masa Depan Bangsa!"
                      );
                      utterance.voice = voice;
                      utterance.lang = "id-ID";
                      window.speechSynthesis.cancel();
                      window.speechSynthesis.speak(utterance);
                      setTimeout(() => setPreviewingVoice(""), 5000);
                    }}
                    disabled={previewingVoice === voiceNamePreference}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    {previewingVoice === voiceNamePreference ? "Memutar..." : "Coba Suara Ini"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsSavingVoice(true);
                      try {
                        const res = await apiFetch("/api/notifications/voice-prefs", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ voice_name_preference: voiceNamePreference || null }),
                        });
                        if (!res.ok) throw new Error("Gagal menyimpan");
                        showToast("success", "Preferensi suara berhasil disimpan!");
                      } catch {
                        showToast("error", "Gagal menyimpan preferensi suara");
                      } finally {
                        setIsSavingVoice(false);
                      }
                    }}
                    disabled={isSavingVoice}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingVoice ? "Menyimpan..." : "Simpan Preferensi Suara"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Preferensi Aplikasi */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-500 p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🎨</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Preferensi Aplikasi</h3>
                  <p className="text-white/80 text-xs">Atur tampilan dan zona waktu aplikasi</p>
                </div>
              </div>
            </div>
            {/* Card Body */}
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🌓</span>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Tema</label>
                  </div>
                  <select
                    value={preferences.tema}
                    onChange={(e) => handlePreferenceChange("tema", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:border-violet-500 focus:outline-none bg-white dark:bg-slate-700 font-medium dark:text-slate-200"
                  >
                    <option value="light">☀️ Terang</option>
                    <option value="dark">🌙 Gelap</option>
                    <option value="system">💻 Sesuai Sistem</option>
                  </select>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🕐</span>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Zona Waktu</label>
                  </div>
                  <select
                    value={preferences.zonaWaktu}
                    onChange={(e) => handlePreferenceChange("zonaWaktu", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:border-violet-500 focus:outline-none bg-white dark:bg-slate-700 font-medium dark:text-slate-200"
                  >
                    <option value="Asia/Jakarta">🕌 WIB (Jakarta)</option>
                    <option value="Asia/Makassar">🕌 WITA (Makassar)</option>
                    <option value="Asia/Jayapura">🕌 WIT (Jayapura)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {isShowPayoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">💸 Konfirmasi Rekening Pencairan</h3>
              <button onClick={() => setIsShowPayoutModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-lg cursor-pointer">✕</button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
              Harap masukkan informasi rekening bank Anda secara akurat untuk memproses penarikan saldo cashback sebesar <strong>Rp {user?.cashback_balance?.toLocaleString("id-ID")}</strong>.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase">Nama Bank</label>
                <input type="text" value={payoutBankName} onChange={(e) => setPayoutBankName(e.target.value)} placeholder="Contoh: Bank Mandiri, BCA, BRI" className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs bg-white dark:bg-slate-700 font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase">Nomor Rekening</label>
                <input type="text" value={payoutBankAccountNumber} onChange={(e) => setPayoutBankAccountNumber(e.target.value)} placeholder="Contoh: 1234567890" className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs bg-white dark:bg-slate-700 font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase">Nama Pemilik Rekening</label>
                <input type="text" value={payoutBankAccountName} onChange={(e) => setPayoutBankAccountName(e.target.value)} placeholder="Contoh: ElHanum" className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs bg-white dark:bg-slate-700 font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500" required />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setIsShowPayoutModal(false)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer">Batal</button>
              <button
                disabled={isProcessingReferralAction || !payoutBankName || !payoutBankAccountNumber || !payoutBankAccountName}
                onClick={() => handleReferralAction("request_payout", user?.cashback_balance, payoutBankName, payoutBankAccountNumber, payoutBankAccountName)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-100 dark:shadow-emerald-900/30 disabled:opacity-50 cursor-pointer"
              >
                {isProcessingReferralAction ? "Memproses..." : "Kirim Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleSuccess}
        currentUser={user}
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Memuat profil...</p>
        </div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}