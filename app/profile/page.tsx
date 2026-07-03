"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import EditProfileModal from "@/components/user/EditProfileModal";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
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

  const handleSuccess = () => {
    setToast({ type: "success", message: "Profil berhasil diperbarui!" });
    fetchUserProfile();
    setTimeout(() => setToast(null), 3000);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const getSubscriptionBadge = (status: string) => {
    const badges: Record<string, { label: string; class: string }> = {
      "three_month": { label: "🏆 PRO 3 Bulan", class: "bg-amber-100 text-amber-700 border-amber-200" },
      "six_month": { label: "🏆 PRO 6 Bulan", class: "bg-amber-100 text-amber-700 border-amber-200" },
      "one_year": { label: "🏆 PRO 1 Tahun", class: "bg-amber-100 text-amber-700 border-amber-200" },
      "pro": { label: "🏆 PRO", class: "bg-amber-100 text-amber-700 border-amber-200" },
      "free": { label: "⚡ Free", class: "bg-slate-100 text-slate-600 border-slate-200" },
    };
    return badges[status] || badges.free;
  };

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
          <button
            onClick={fetchUserProfile}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition"
          >
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
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-xl animate-bounce">
          ✅ {toast.message}
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
        <p className="text-gray-500 text-sm mt-1">Kelola informasi profil dan pengaturan akun Anda</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden sticky top-20">
            {/* Profile Header */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-6 text-white text-center">
              <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm mx-auto flex items-center justify-center text-3xl font-bold mb-3">
                {user?.nama_lengkap ? user.nama_lengkap.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "GP"}
              </div>
              <h2 className="text-xl font-bold">{user?.nama_lengkap || "Nama Lengkap"}</h2>
              <p className="text-violet-100 text-sm mt-1">@{user?.username || "username"}</p>
              <div className="mt-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getSubscriptionBadge(user?.status_langganan).class}`}>
                  {getSubscriptionBadge(user?.status_langganan).label}
                </span>
              </div>
            </div>

            {/* Profile Info */}
            <div className="p-4 space-y-4">
              <button
                onClick={() => setShowEditModal(true)}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
              >
                ✏️ Edit Profil
              </button>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
                    📧
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Email</p>
                    <p className="text-sm text-gray-800 truncate">{user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    💬
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">WhatsApp</p>
                    <p className="text-sm text-gray-800 font-mono">
                      {user?.whatsapp ? `+62 ${user.whatsapp.slice(1)}` : "-"}
                    </p>
                  </div>
                </div>

                {user?.nama_sekolah && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      🏫
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Sekolah</p>
                      <p className="text-sm text-gray-800 truncate">{user.nama_sekolah}</p>
                    </div>
                  </div>
                )}

                {user?.jenjang && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                      📚
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Jenjang</p>
                      <p className="text-sm text-gray-800">
                        {user.jenjang === "sd" ? "SD / Sederajat" :
                         user.jenjang === "smp" ? "SMP / Sederajat" :
                         user.jenjang === "sma" ? "SMA / Sederajat" :
                         user.jenjang === "smk" ? "SMK / Sederajat" : user.jenjang}
                      </p>
                    </div>
                  </div>
                )}

                {user?.mata_pelajaran && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
                      📖
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Mata Pelajaran</p>
                      <p className="text-sm text-gray-800">{user.mata_pelajaran}</p>
                    </div>
                  </div>
                )}

                {user?.nip && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                      🆔
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">NIP</p>
                      <p className="text-sm text-gray-800 font-mono">{user.nip}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Account Info */}
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
                  <span className="font-bold text-gray-700 uppercase">
                    {user?.role === "admin" ? "Admin" : "Guru"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Terdaftar</span>
                  <span className="font-bold text-gray-700">{formatDate(user?.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Subscription & Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subscription Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              📦 Langganan & Kuota
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl border border-violet-100">
                <p className="text-[10px] text-violet-600 font-bold uppercase tracking-wide">Kuota Token</p>
                <p className="text-2xl font-black text-violet-700 mt-1">{user?.token_limit?.toLocaleString("id-ID") || 0}</p>
                <p className="text-[10px] text-violet-500 mt-1">Token tersedia</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100">
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Masa Berlangganan</p>
                <p className="text-lg font-black text-emerald-700 mt-1">
                  {user?.subscription_end ? formatDate(user.subscription_end) : "Tidak Aktif"}
                </p>
                <p className="text-[10px] text-emerald-500 mt-1">
                  {user?.subscription_start ? `Awal: ${formatDate(user.subscription_start)}` : "Belum pernah langganan"}
                </p>
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

          {/* Bank Account Card */}
          {(user?.bank_name || user?.bank_account_number) && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                🏦 Informasi Bank
              </h3>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Bank</p>
                    <p className="text-sm font-bold text-gray-800 mt-1 uppercase">{user.bank_name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Nomor Rekening</p>
                    <p className="text-sm font-bold text-gray-800 mt-1 font-mono">{user.bank_account_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Atas Nama</p>
                    <p className="text-sm font-bold text-gray-800 mt-1">{user.bank_account_name || "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              ⚡ Aksi Cepat
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/dashboard/pricing"
                className="p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white hover:shadow-lg transition group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">🚀 Upgrade ke PRO</p>
                    <p className="text-violet-100 text-xs mt-1">Dapatkan fitur premium</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition">→</span>
                </div>
              </Link>
              <Link
                href="/dashboard/administrasi"
                className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white hover:shadow-lg transition group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">📝 Administrasi</p>
                    <p className="text-emerald-100 text-xs mt-1">Kelola administrasi</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition">→</span>
                </div>
              </Link>
              <Link
                href="/dashboard/nilai"
                className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white hover:shadow-lg transition group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">📊 Kelola Nilai</p>
                    <p className="text-blue-100 text-xs mt-1">Input & export nilai</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition">→</span>
                </div>
              </Link>
              <Link
                href="/dashboard"
                className="p-4 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl text-white hover:shadow-lg transition group"
              >
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

          {/* Pricing Info */}
          {user?.pricingConfig && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                💰 Paket Berlangganan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {user.pricingConfig.plans?.map((plan: any) => (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-xl border-2 ${
                      plan.popular
                        ? "border-violet-500 bg-violet-50/50"
                        : "border-gray-100 bg-gray-50"
                    }`}
                  >
                    {plan.popular && (
                      <span className="inline-block px-2 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded-full mb-2">
                        POPULER
                      </span>
                    )}
                    <p className="font-bold text-gray-800">{plan.name}</p>
                    <p className="text-2xl font-black text-violet-600 mt-1">
                      Rp {plan.price.toLocaleString("id-ID")}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{plan.duration}</p>
                    <p className="text-[10px] text-gray-400 mt-2">{plan.token_quota?.toLocaleString("id-ID")} token</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleSuccess}
        currentUser={user}
      />
    </div>
  );
}