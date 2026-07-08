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
        helperText="Pilih 'Manual' jika ingin mengirim sendiri"
        disabled={loading}
      />

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
