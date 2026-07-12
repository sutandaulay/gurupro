"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EditProfileModal from "@/components/user/EditProfileModal";
import { useProfileStore } from "@/lib/stores";

type TabType = "profil" | "billing" | "referral" | "role";

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<TabType>("profil");
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

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

  useEffect(() => {
    if (tabFromUrl === "billing") setActiveTab("billing");
  }, [tabFromUrl]);

  const fetchUserProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setProfNama(data.nama_lengkap || "");
        setProfUsername(data.username || "");
        setProfSekolah(data.nama_sekolah || "");
        setProfBankName(data.bank_name || "");
        setProfBankAccountNumber(data.bank_account_number || "");
        setProfBankAccountName(data.bank_account_name || "");
        useProfileStore.getState().setProfile(data);
      } else {
        const err = await res.json();
        setError(err.error || "Gagal memuat profil");
      }
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReferrals = async () => {
    try {
      const res = await fetch("/api/user/referrals").then((r) => r.json());
      if (Array.isArray(res)) setReferralsList(res);
    } catch (e) {
      console.error("Gagal mengambil referrals:", e);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchReferrals();
  }, []);

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
      const response = await fetch("/api/user/profile", {
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

  const handleRoleChange = async (newRole: string) => {
    try {
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama_lengkap: profNama, nama_sekolah: profSekolah, role: newRole })
      });
      if (!response.ok) throw new Error("Gagal mengubah peran.");
      const updated = await response.json();
      setUser(updated);
      useProfileStore.getState().setProfile(updated);
      showToast("success", `Simulasi Peran Aktif: ${newRole.toUpperCase()}`);
      window.location.reload();
    } catch (err: any) {
      showToast("error", err.message);
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
      const res = await fetch("/api/user/referrals/payout", {
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
      const response = await fetch("/api/checkout", {
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
      free: { label: "⚡ Free", class: "bg-slate-100 text-slate-600 border-slate-200" },
    };
    return badges[status] || badges.free;
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "profil", label: "Profil Saya", icon: "👤" },
    { id: "billing", label: "Billing & Langganan", icon: "💳" },
    { id: "referral", label: "Referral & Cashback", icon: "🎁" },
    { id: "role", label: "Simulasi Peran", icon: "🔄" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Memuat profil...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm max-w-md">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Terjadi Kesalahan</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={fetchUserProfile} className="px-4 py-2 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition cursor-pointer">
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-xl animate-bounce ${toast.type === "error" ? "bg-rose-600" : "bg-emerald-600"}`}>
          {toast.type === "error" ? "✕" : "✅"} {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/dashboard" className="hover:text-violet-600 transition">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-800 font-medium">Profil Saya</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Profil Saya</h1>
        <p className="text-gray-500 text-sm mt-1">Kelola informasi profil, langganan, dan pengaturan akun Anda</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 bg-white rounded-2xl shadow-sm p-1.5 border border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
              activeTab === tab.id
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Profil Saya */}
      {activeTab === "profil" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden sticky top-20">
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
                <button
                  onClick={() => setShowEditModal(true)}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  ✏️ Edit Profil
                </button>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">📧</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Email</p>
                      <p className="text-sm text-gray-800 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">💬</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">WhatsApp</p>
                      <p className="text-sm text-gray-800 font-mono">{user?.whatsapp ? `+62 ${user.whatsapp}` : "-"}</p>
                    </div>
                  </div>
                  {user?.nip && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">🆔</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">NIP</p>
                        <p className="text-sm text-gray-800 font-mono">{user.nip}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Info Akun</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`font-bold ${user?.is_active === false ? "text-rose-600" : "text-emerald-600"}`}>
                      {user?.is_active === false ? "Nonaktif" : "Aktif"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Role</span>
                    <span className="font-bold text-gray-700 uppercase">{user?.role === "admin" ? "Admin" : "Guru"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Terdaftar</span>
                    <span className="font-bold text-gray-700">{formatDate(user?.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Edit Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">✏️ Edit Profil</h3>
              <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Username (untuk Login)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">@</span>
                    <input
                      type="text"
                      value={profUsername}
                      onChange={(e) => setProfUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                      placeholder="username"
                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">Huruf kecil, angka, titik, garis bawah, atau strip. Minimal 3 karakter.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Nama Lengkap &amp; Gelar</label>
                  <input
                    type="text"
                    value={profNama}
                    onChange={(e) => setProfNama(e.target.value)}
                    placeholder="Contoh: ElHanum, S.Pd."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-600 block mb-1">Nama Sekolah / Instansi</label>
                  <input
                    type="text"
                    value={profSekolah}
                    onChange={(e) => setProfSekolah(e.target.value)}
                    placeholder="Contoh: SMA Negeri 1 Jakarta"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Bank Info */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">🏦 Informasi Rekening Bank</h3>
              <p className="text-xs text-slate-500 mb-4">Untuk pencairan cashback referral.</p>
              <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Nama Bank</label>
                  <input
                    type="text"
                    value={profBankName}
                    onChange={(e) => setProfBankName(e.target.value)}
                    placeholder="Contoh: Bank Mandiri, BCA, BRI"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Nomor Rekening</label>
                  <input
                    type="text"
                    value={profBankAccountNumber}
                    onChange={(e) => setProfBankAccountNumber(e.target.value)}
                    placeholder="Contoh: 1234567890"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Nama Pemilik Rekening</label>
                  <input
                    type="text"
                    value={profBankAccountName}
                    onChange={(e) => setProfBankAccountName(e.target.value)}
                    placeholder="Contoh: ElHanum"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
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
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">📦 Langganan & Kuota</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl border border-violet-100">
                <p className="text-[10px] text-violet-600 font-bold uppercase tracking-wide">Kuota Token</p>
                <p className="text-2xl font-black text-violet-700 mt-1">{user?.token_limit?.toLocaleString("id-ID") || 0}</p>
                <p className="text-[10px] text-violet-500 mt-1">Token tersedia</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100">
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Masa Berlangganan</p>
                <p className="text-lg font-black text-emerald-700 mt-1">{user?.subscription_end ? formatDate(user.subscription_end) : "Tidak Aktif"}</p>
                <p className="text-[10px] text-emerald-500 mt-1">{user?.subscription_start ? `Awal: ${formatDate(user.subscription_start)}` : "Belum pernah langganan"}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl border border-amber-100">
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide">Status Paket</p>
                <p className="text-lg font-black text-amber-700 mt-1">
                  {user?.status_langganan === "free" ? "Free" :
                   user?.status_langganan === "three_month" ? "3 Bulan" :
                   user?.status_langganan === "six_month" ? "6 Bulan" :
                   user?.status_langganan === "one_year" ? "1 Tahun" :
                   user?.status_langganan === "pro" ? "PRO" : "Free"}
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
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">⚡ Aksi Cepat</h3>
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
              <div className="bg-white rounded-2xl shadow-sm p-6" id="subscription-packages-section">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">💰 Paket Berlangganan</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {plans.map((plan: any) => {
                    const isActive = currentPlan === plan.id;
                    return (
                      <div key={plan.id} className={`p-4 rounded-xl border-2 flex flex-col justify-between ${isActive ? "border-violet-500 bg-violet-50/50" : plan.popular ? "border-violet-300 bg-violet-50/30" : "border-gray-100 bg-gray-50"}`}>
                        <div>
                          {plan.popular && !isActive && (
                            <span className="inline-block px-2 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded-full mb-2">POPULER</span>
                          )}
                          {isActive && (
                            <span className="inline-block px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full mb-2">AKTIF</span>
                          )}
                          <p className="font-bold text-gray-800">{plan.package_name}</p>
                          <p className="text-2xl font-black text-violet-600 mt-1">Rp {plan.price.toLocaleString("id-ID")}</p>
                          <p className="text-xs text-gray-500 mt-1">{plan.duration_days} Hari</p>
                          <p className="text-[10px] text-gray-400 mt-2">{plan.tokens.toLocaleString("id-ID")} token</p>
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
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">🎁 Program Referral &amp; Cashback</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Undang rekan guru untuk menggunakan GuruPro Premium dan nikmati reward instan! Setiap pendaftaran sukses akan menambahkan <strong>+20 Token kuota</strong> dan saldo cashback <strong>Rp10.000</strong> ke akun Anda. Teman yang diundang juga akan langsung mendapatkan bonus <strong>+10 Token</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Kode Referral Anda</span>
                <span className="text-lg font-black text-indigo-600 font-mono tracking-wider block mt-1">{user?.referral_code || "BELUM ADA"}</span>
              </div>
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const refLink = `${window.location.origin}/login?ref=${user?.referral_code}`;
                    navigator.clipboard.writeText(refLink);
                    showToast("success", "Link referral berhasil disalin ke clipboard!");
                  }
                }}
                className="mt-3 w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition text-center cursor-pointer"
              >
                Salin Link Referral
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Cashback Terkumpul</span>
                <span className="text-lg font-black text-emerald-600 block mt-1">Rp {(user?.cashback_balance || 0).toLocaleString("id-ID")}</span>
                <span className="text-[9px] text-slate-400 font-medium block mt-1">Batas minimum penarikan: Rp50.000</span>
              </div>
              <button
                disabled={isProcessingReferralAction || !user?.cashback_balance || user?.cashback_balance < 50000}
                onClick={() => {
                  setPayoutBankName(user?.bank_name || "");
                  setPayoutBankAccountNumber(user?.bank_account_number || "");
                  setPayoutBankAccountName(user?.bank_account_name || "");
                  setIsShowPayoutModal(true);
                }}
                className={`mt-3 w-full py-1.5 rounded-lg text-[10px] font-bold transition text-center cursor-pointer disabled:cursor-not-allowed ${user?.cashback_balance >= 50000 && !isProcessingReferralAction ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-100" : "bg-slate-100 text-slate-400"}`}
              >
                {isProcessingReferralAction ? "Memproses..." : user?.cashback_balance >= 50000 ? "Cairkan Cashback" : "Cairkan Saldo (Min. Rp50rb)"}
              </button>
            </div>
          </div>

          {/* Token Conversion */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Tukar Saldo dengan Token</span>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">Nilai Tukar: Rp 1.000 = 1 Token kuota</p>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">Hasil: {Math.floor(exchangeAmount / 1000)} Token</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1000}
                step={1000}
                max={user?.cashback_balance || 0}
                value={exchangeAmount}
                onChange={(e) => setExchangeAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-slate-50 font-bold text-slate-800 focus:bg-white focus:border-indigo-400"
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
                      ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                      : (user?.cashback_balance || 0) >= preset
                      ? "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                      : "bg-slate-50 border-slate-100 text-slate-300"
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
                    ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                    : (user?.cashback_balance || 0) > 0
                    ? "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                    : "bg-slate-50 border-slate-100 text-slate-300"
                }`}
              >
                Maksimal
              </button>
            </div>
          </div>

          {/* Referral History */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <span className="text-[10px] text-slate-400 font-bold block uppercase mb-2">Riwayat Undang Teman ({referralsList.length})</span>
            {referralsList.length === 0 ? (
              <div className="text-sm text-slate-400 italic text-center py-4">Belum ada teman yang terdaftar menggunakan kode referral Anda.</div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {referralsList.map((ref: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-white border border-slate-100 rounded-xl p-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{ref.referee_name}</p>
                      <p className="text-slate-400 mt-0.5">{ref.referee_email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-indigo-600">+{ref.reward_tokens} Token</p>
                      <p className="font-black text-emerald-600 mt-0.5">+Rp {(ref.cashback_amount || 0).toLocaleString("id-ID")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Simulasi Peran */}
      {activeTab === "role" && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">🔄 Simulasi Peran Aktif (Multi-Role)</h3>
          <p className="text-sm text-slate-500">Mengubah pilihan di bawah akan menyimulasikan tampilan dasbor, navigasi, dan hak akses sesuai peran yang dipilih.</p>
          <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6">
            <select
              value={user?.role || "guru"}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-400 focus:outline-none bg-white font-bold text-slate-800 w-full sm:w-72"
            >
              <option value="guru">Guru (Default)</option>
              <option value="kepala_sekolah">Kepala Sekolah / Wakasek</option>
              <option value="pengawas">Pengawas Sekolah (Read-Only)</option>
              <option value="operator">Operator Sekolah (Jadwal & Data)</option>
              <option value="admin">Administrator Platform</option>
            </select>
            <p className="text-xs text-slate-400 mt-3">Halaman akan di-reload setelah perubahan peran.</p>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {isShowPayoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">💸 Konfirmasi Rekening Pencairan</h3>
              <button onClick={() => setIsShowPayoutModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
            </div>
            <p className="text-xs text-slate-500 leading-normal">
              Harap masukkan informasi rekening bank Anda secara akurat untuk memproses penarikan saldo cashback sebesar <strong>Rp {user?.cashback_balance?.toLocaleString("id-ID")}</strong>.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Nama Bank</label>
                <input type="text" value={payoutBankName} onChange={(e) => setPayoutBankName(e.target.value)} placeholder="Contoh: Bank Mandiri, BCA, BRI" className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Nomor Rekening</label>
                <input type="text" value={payoutBankAccountNumber} onChange={(e) => setPayoutBankAccountNumber(e.target.value)} placeholder="Contoh: 1234567890" className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Nama Pemilik Rekening</label>
                <input type="text" value={payoutBankAccountName} onChange={(e) => setPayoutBankAccountName(e.target.value)} placeholder="Contoh: ElHanum" className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 outline-none focus:border-indigo-500" required />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setIsShowPayoutModal(false)} className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer">Batal</button>
              <button
                disabled={isProcessingReferralAction || !payoutBankName || !payoutBankAccountNumber || !payoutBankAccountName}
                onClick={() => handleReferralAction("request_payout", user?.cashback_balance, payoutBankName, payoutBankAccountNumber, payoutBankAccountName)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-100 disabled:opacity-50 cursor-pointer"
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