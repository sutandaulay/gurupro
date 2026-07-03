"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.id) setUser(data);
      }
    } catch {}
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfile();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password baru minimal 6 karakter" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Konfirmasi password tidak cocok" });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ type: "success", text: "Password berhasil diubah!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMsg({ type: "error", text: data.error || "Gagal mengubah password" });
      }
    } catch {
      setPasswordMsg({ type: "error", text: "Terjadi kesalahan koneksi" });
    } finally {
      setChangingPassword(false);
    }
  };

  const isGoogleUser = user?.password === null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Kembali
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Pengaturan</h1>
        </div>

        {!user ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400">
            Memuat pengaturan...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Informasi Akun */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Informasi Akun</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Nama</span>
                  <span className="text-slate-800 font-semibold">{user.nama_lengkap || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
                  <span className="text-slate-800 font-semibold">{user.email || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Role</span>
                  <span className="text-slate-800 font-semibold capitalize">{user.role || "guru"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">WhatsApp</span>
                  <span className="text-slate-800 font-semibold">{user.whatsapp ? `+${user.whatsapp}` : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Metode Login</span>
                  <span className="text-slate-800 font-semibold">{isGoogleUser ? "Google" : "Email / Password"}</span>
                </div>
              </div>
            </div>

            {/* Ubah Password */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Ubah Password</h2>
              {isGoogleUser ? (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
                  Akun Anda menggunakan login Google, tidak perlu password.
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Password Saat Ini</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Password Baru</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        minLength={6}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Konfirmasi</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>
                  {passwordMsg && (
                    <div className={`text-xs font-semibold px-3 py-2 rounded-xl ${passwordMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {passwordMsg.text}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    {changingPassword ? "Menyimpan..." : "Simpan Password"}
                  </button>
                </form>
              )}
            </div>

            {/* Preferensi Default */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Preferensi</h2>
              <p className="text-xs text-slate-400">
                Pengaturan tambahan akan tersedia di pembaruan berikutnya.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
