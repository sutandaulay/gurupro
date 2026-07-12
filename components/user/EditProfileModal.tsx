"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useProfileStore } from "@/lib/stores";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: any;
}

export default function EditProfileModal({ isOpen, onClose, onSuccess, currentUser }: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    nama_lengkap: "",
    username: "",
    email: "",
    whatsapp: "",
    nip: "",
  });
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileFromStore = useProfileStore(s => s.profile);
  const fetchProfile = useProfileStore(s => s.fetchProfile);

  useEffect(() => {
    if (isOpen) {
      const source = profileFromStore || currentUser;
      if (source) {
        setFormData({
          nama_lengkap: source.nama_lengkap || "",
          username: source.username || "",
          email: source.email || "",
          whatsapp: source.whatsapp || "",
          nip: source.nip || "",
        });
        setPhotoUrl(source.photo_url || null);
        setIsLoading(false);
      } else {
        fetchProfile().then(data => {
          if (data) {
            setFormData({
              nama_lengkap: data.nama_lengkap || "",
              username: data.username || "",
              email: data.email || "",
              whatsapp: data.whatsapp || "",
              nip: data.nip || "",
            });
            setPhotoUrl(data.photo_url || null);
          }
          setIsLoading(false);
        });
      }
    }
  }, [isOpen]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setResult({ success: false, message: "Tipe file tidak didukung. Gunakan JPEG, PNG, WebP, atau GIF." });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setResult({ success: false, message: "Ukuran file maksimal 2MB." });
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setIsUploadingPhoto(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch("/api/user/upload-photo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: "Foto profil berhasil diperbarui!" });
        setPhotoUrl(data.photo_url);
      } else {
        setResult({ success: false, message: data.error || "Gagal mengupload foto." });
        // Revert preview on failure
        const profileData = await fetchProfile();
        setPhotoUrl(profileData?.photo_url || null);
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message || "Gagal mengupload foto." });
    } finally {
      setIsUploadingPhoto(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Auto-format username (lowercase, no spaces)
    if (name === "username") {
      setFormData(prev => ({ ...prev, username: value.toLowerCase().replace(/[^a-z0-9._-]/g, "") }));
    }

    // Auto-format WhatsApp (numbers only, with 62 prefix)
    if (name === "whatsapp") {
      let digits = value.replace(/\D/g, "");
      if (digits.startsWith("0")) digits = "62" + digits.slice(1);
      else if (!digits.startsWith("62")) digits = "62" + digits;
      setFormData(prev => ({ ...prev, whatsapp: digits }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    // Validation
    if (!formData.nama_lengkap.trim()) {
      setResult({ success: false, message: "Nama lengkap wajib diisi!" });
      return;
    }
    if (!formData.username.trim()) {
      setResult({ success: false, message: "Username wajib diisi!" });
      return;
    }
    if (formData.whatsapp && formData.whatsapp.length < 10) {
      setResult({ success: false, message: "Nomor WhatsApp minimal 10 digit!" });
      return;
    }

    setIsSaving(true);
    setResult(null);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message || "Profil berhasil diperbarui!" });
        useProfileStore.getState().fetchProfile();
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setResult({ success: false, message: data.error || "Gagal memperbarui profil!" });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message || "Terjadi kesalahan!" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (!passwordData.current_password) {
      setResult({ success: false, message: "Password saat ini wajib diisi!" });
      return;
    }
    if (!passwordData.new_password) {
      setResult({ success: false, message: "Password baru wajib diisi!" });
      return;
    }
    if (passwordData.new_password.length < 6) {
      setResult({ success: false, message: "Password baru minimal 6 karakter!" });
      return;
    }
    if (passwordData.new_password !== passwordData.confirm_password) {
      setResult({ success: false, message: "Konfirmasi password tidak cocok!" });
      return;
    }

    setIsSaving(true);
    setResult(null);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message || "Password berhasil diubah!" });
        setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
        useProfileStore.getState().fetchProfile();
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setResult({ success: false, message: data.error || "Gagal mengubah password!" });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message || "Terjadi kesalahan!" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                👤 Edit Profil
              </h2>
              <p className="text-violet-100 text-xs mt-1">
                Perbarui informasi profil Anda
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-xl transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => { setActiveTab("profile"); setResult(null); }}
            className={`flex-1 py-3 text-xs font-bold transition ${
              activeTab === "profile"
                ? "text-violet-600 border-b-2 border-violet-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            📝 Informasi Profil
          </button>
          <button
            onClick={() => { setActiveTab("password"); setResult(null); }}
            className={`flex-1 py-3 text-xs font-bold transition ${
              activeTab === "password"
                ? "text-violet-600 border-b-2 border-violet-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            🔐 Ubah Password
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Memuat data...</div>
          ) : activeTab === "profile" ? (
            <div className="space-y-4">
              {/* Avatar Preview with Photo Upload */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-violet-600 flex items-center justify-center text-white text-xl font-bold">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Foto Profil" className="w-full h-full object-cover" />
                    ) : (
                      <span>{formData.nama_lengkap ? formData.nama_lengkap.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "GP"}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-violet-600 text-white rounded-full flex items-center justify-center text-xs shadow-md hover:bg-violet-700 transition disabled:opacity-50 cursor-pointer"
                    title="Ubah Foto"
                  >
                    {isUploadingPhoto ? (
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{formData.nama_lengkap || "Nama Lengkap"}</p>
                  <p className="text-xs text-slate-500">@{formData.username || "username"}</p>
                  <p className="text-xs text-violet-600 font-semibold mt-1">{formData.email}</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nama_lengkap"
                    value={formData.nama_lengkap}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                    placeholder="username"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Hanya huruf kecil, angka, titik, underscore, dan strip</p>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                    placeholder="email@example.com"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Email tidak dapat diubah</p>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                    WhatsApp
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">+62</span>
                    <input
                      type="tel"
                      name="whatsapp"
                      value={formData.whatsapp.replace(/^62/, "")}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                      placeholder="8123456789"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Nomor akan tersimpan dengan kode negara (+62)</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                    NIP
                  </label>
                  <input
                    type="text"
                    name="nip"
                    value={formData.nip}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                    placeholder="NIP"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-xs text-amber-700 font-semibold">
                  💡 Tips: Gunakan password yang kuat dengan kombinasi huruf besar, kecil, angka, dan simbol.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                  Password Saat Ini <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  name="current_password"
                  value={passwordData.current_password}
                  onChange={handlePasswordChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Masukkan password saat ini"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                  Password Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  name="new_password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Masukkan password baru (min. 6 karakter)"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                  Konfirmasi Password Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Ulangi password baru"
                />
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`mt-4 p-4 rounded-2xl ${
              result.success ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"
            }`}>
              <p className={`text-xs font-bold flex items-center gap-2 ${
                result.success ? "text-emerald-700" : "text-rose-700"
              }`}>
                <span className="text-lg">{result.success ? "✅" : "❌"}</span>
                {result.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition"
          >
            Batal
          </button>
          <button
            onClick={activeTab === "profile" ? handleSaveProfile : handleChangePassword}
            disabled={isSaving}
            className="px-6 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Menyimpan...
              </>
            ) : (
              <>
                <span>💾</span> Simpan Perubahan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}