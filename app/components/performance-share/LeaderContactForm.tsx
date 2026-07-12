"use client";

import { useState } from "react";
import { Input, Select, Label } from "@/app/components/ui/form";
import { IconUser, IconMail, IconPhone, IconSchool } from "@tabler/icons-react";

interface LeaderContact {
  id?: string;
  leaderName: string;
  leaderRole: string;
  phoneNumber?: string;
  email?: string;
  schoolNameRaw?: string;
  notificationFrequency?: string;
  notificationTime?: string;
  notificationDay?: string;
  notificationDate?: string;
}

interface LeaderContactFormProps {
  initialData?: LeaderContact;
  onSubmit: (data: LeaderContact) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

const ROLE_OPTIONS = [
  { value: "", label: "Pilih Jabatan" },
  { value: "kepala_sekolah", label: "Kepala Sekolah" },
  { value: "pengawas", label: "Pengawas" },
  { value: "wali_kelas", label: "Wali Kelas" },
  { value: "lainnya", label: "Lainnya" },
];

const FREQUENCY_OPTIONS = [
  { value: "", label: "Pilih Frekuensi" },
  { value: "manual", label: "Manual - Kirim sendiri" },
  { value: "daily", label: "Harian - Setiap hari" },
  { value: "weekly", label: "Mingguan - Setiap minggu" },
  { value: "monthly", label: "Bulanan - Setiap bulan" },
];

const DAY_OPTIONS = [
  { value: "1", label: "Senin" },
  { value: "2", label: "Selasa" },
  { value: "3", label: "Rabu" },
  { value: "4", label: "Kamis" },
  { value: "5", label: "Jumat" },
  { value: "6", label: "Sabtu" },
];

const DATE_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `Tanggal ${i + 1}`,
}));

export default function LeaderContactForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: LeaderContactFormProps) {
  const [formData, setFormData] = useState<LeaderContact>({
    leaderName: initialData?.leaderName || "",
    leaderRole: initialData?.leaderRole || "",
    phoneNumber: initialData?.phoneNumber || "",
    email: initialData?.email || "",
    schoolNameRaw: initialData?.schoolNameRaw || "",
    notificationFrequency: initialData?.notificationFrequency || "manual",
    notificationTime: initialData?.notificationTime || "14:00",
    notificationDay: initialData?.notificationDay || "5",
    notificationDate: initialData?.notificationDate || "25",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.leaderName.trim()) {
      newErrors.leaderName = "Nama pimpinan wajib diisi";
    }

    if (!formData.leaderRole) {
      newErrors.leaderRole = "Jabatan wajib dipilih";
    }

    if (!formData.phoneNumber?.trim() && !formData.email?.trim()) {
      newErrors.phoneNumber = "Minimal salah satu dari WhatsApp atau Email wajib diisi";
      newErrors.email = "Minimal salah satu dari WhatsApp atau Email wajib diisi";
    }

    if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Format email tidak valid";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nama Pimpinan"
        placeholder="Contoh: Dr. Ahmad Wijaya"
        value={formData.leaderName}
        onChange={(e) => setFormData({ ...formData, leaderName: e.target.value })}
        icon={IconUser}
        error={errors.leaderName}
        required
        disabled={loading}
      />

      <Select
        label="Jabatan"
        options={ROLE_OPTIONS}
        value={formData.leaderRole}
        onChange={(e) => setFormData({ ...formData, leaderRole: e.target.value })}
        error={errors.leaderRole}
        required
        disabled={loading}
      />

      <Input
        label="Nomor WhatsApp"
        placeholder="08xxxxxxxxxx atau +628xxxxxxxxxx"
        value={formData.phoneNumber || ""}
        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
        icon={IconPhone}
        error={errors.phoneNumber}
        helperText="Contoh: 081234567890 atau +6281234567890"
        disabled={loading}
      />

      <Input
        label="Email"
        placeholder="email@sekolah.sch.id"
        type="email"
        value={formData.email || ""}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        icon={IconMail}
        error={errors.email}
        disabled={loading}
      />

      <Input
        label="Nama Sekolah (Opsional)"
        placeholder="Contoh: SDN 1 Surabaya"
        value={formData.schoolNameRaw || ""}
        onChange={(e) => setFormData({ ...formData, schoolNameRaw: e.target.value })}
        icon={IconSchool}
        helperText="Kontekstual saja, tidak dipakai untuk pencocokan"
        disabled={loading}
      />

      <Select
        label="Frekuensi Laporan Otomatis"
        options={FREQUENCY_OPTIONS}
        value={formData.notificationFrequency || "manual"}
        onChange={(e) => setFormData({ ...formData, notificationFrequency: e.target.value })}
        disabled={loading}
      />
      <p className="text-xs text-gray-500 -mt-2">
        Pilih 'Manual' jika ingin mengirim sendiri
      </p>

      {/* Conditional fields based on frequency */}
      {formData.notificationFrequency === "daily" && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Jam Kirim Laporan Harian
          </label>
          <input
            type="time"
            value={formData.notificationTime || "14:00"}
            onChange={(e) => setFormData({ ...formData, notificationTime: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Rekomendasi: Jam 14:00-15:00 (setelah jam mengajar selesai)
          </p>
        </div>
      )}

      {formData.notificationFrequency === "weekly" && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hari Kirim Laporan Mingguan
            </label>
            <Select
              options={DAY_OPTIONS}
              value={formData.notificationDay || "5"}
              onChange={(e) => setFormData({ ...formData, notificationDay: e.target.value })}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jam Kirim
            </label>
            <input
              type="time"
              value={formData.notificationTime || "14:00"}
              onChange={(e) => setFormData({ ...formData, notificationTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <p className="text-xs text-gray-500">
            Rekomendasi: Jumat Jam 15:00 (akhir jam kerja sebelum weekend)
          </p>
        </div>
      )}

      {formData.notificationFrequency === "monthly" && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Kirim Laporan Bulanan
            </label>
            <Select
              options={DATE_OPTIONS}
              value={formData.notificationDate || "25"}
              onChange={(e) => setFormData({ ...formData, notificationDate: e.target.value })}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jam Kirim
            </label>
            <input
              type="time"
              value={formData.notificationTime || "10:00"}
              onChange={(e) => setFormData({ ...formData, notificationTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <p className="text-xs text-gray-500">
            Rekomendasi: Tanggal 25-28 Jam 10:00 (untuk laporan bulanan yang lebih akurat)
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 rounded-lg bg-violet-600 text-white font-medium text-sm hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Menyimpan..." : initialData?.id ? "Simpan Perubahan" : "Tambah Kontak"}
        </button>
      </div>
    </form>
  );
}
