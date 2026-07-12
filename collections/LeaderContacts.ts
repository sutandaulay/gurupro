import type { CollectionConfig } from "payload";

const LeaderContacts: CollectionConfig = {
  slug: "leader-contacts",
  labels: {
    singular: "Leader Contact",
    plural: "Leader Contacts",
  },
  admin: {
    useAsTitle: "leaderName",
    group: "Performance Sharing",
    defaultColumns: ["leaderName", "leaderRole", "phoneNumber", "email", "teacherId"],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      return {
        teacherId: { equals: user.id },
      };
    },
    create: ({ req: { user } }) => {
      return !!user;
    },
    update: ({ req: { user }, data }) => {
      return {
        teacherId: { equals: user?.id },
      };
    },
    delete: ({ req: { user }, data }) => {
      return {
        teacherId: { equals: user?.id },
      };
    },
  },
  fields: [
    {
      name: "teacherId",
      type: "text",
      required: true,
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: "leaderName",
      type: "text",
      label: "Nama Pimpinan",
      required: true,
      admin: {
        description: "Nama lengkap pimpinan (Kepala Sekolah, Pengawas, Wali Kelas, dll)",
      },
    },
    {
      name: "leaderRole",
      type: "select",
      label: "Jabatan",
      required: true,
      options: [
        { label: "Kepala Sekolah", value: "kepala_sekolah" },
        { label: "Pengawas", value: "pengawas" },
        { label: "Wali Kelas", value: "wali_kelas" },
        { label: "Lainnya", value: "lainnya" },
      ],
    },
    {
      name: "phoneNumber",
      type: "text",
      label: "Nomor WhatsApp",
      admin: {
        description: "Format: +628123456789 (E.164)",
      },
      hooks: {
        beforeChange: [
          ({ value }) => {
            if (!value) return null;
            return normalizePhoneToE164(value);
          },
        ],
        validate: [
          (_, { value }) => {
            if (!value) return true;
            const normalized = normalizePhoneToE164(value);
            if (!normalized || !/^\+[1-9]\d{7,14}$/.test(normalized)) {
              return "Format nomor WhatsApp tidak valid";
            }
            return true;
          },
        ],
      },
    },
    {
      name: "email",
      type: "text",
      label: "Email",
      admin: {
        description: "Email resmi pimpinan",
      },
      hooks: {
        beforeChange: [
          ({ value }) => {
            if (!value) return null;
            return value.toLowerCase().trim();
          },
        ],
        validate: [
          (_, { value, siblingData }) => {
            if (!value && !siblingData?.phoneNumber) {
              return "Minimal salah satu dari WhatsApp atau Email wajib diisi";
            }
            if (value) {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) {
                return "Format email tidak valid";
              }
            }
            return true;
          },
        ],
      },
    },
    {
      name: "schoolNameRaw",
      type: "text",
      label: "Nama Sekolah (Opsional)",
      admin: {
        description: "Kontekstual saja, tidak dipakai untuk matching",
      },
    },
    {
      name: "optedOut",
      type: "checkbox",
      label: "Berhenti Menerima",
      defaultValue: false,
      admin: {
        description: "Jika dicentang, tidak akan menerima link baru",
      },
    },
    {
      name: "optedOutAt",
      type: "date",
      label: "Tanggal Opt-Out",
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: "lastNotifiedAt",
      type: "date",
      label: "Terakhir Dikirim",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "notificationFrequency",
      type: "select",
      label: "Frekuensi Laporan",
      defaultValue: "manual",
      options: [
        { label: "Manual (Kirim Sendiri)", value: "manual" },
        { label: "Harian (Setiap Hari)", value: "daily" },
        { label: "Mingguan (Setiap Minggu)", value: "weekly" },
        { label: "Bulanan (Setiap Bulan)", value: "monthly" },
      ],
      admin: {
        description: "Pilih frekuensi otomatis mengirim laporan ke pimpinan",
      },
    },
    {
      name: "notificationTime",
      type: "text",
      label: "Jam Kirim Laporan",
      defaultValue: "14:00",
      admin: {
        description: "Jam pengiriman laporan (format 24 jam, contoh: 14:00)",
      },
    },
    {
      name: "notificationDay",
      type: "select",
      label: "Hari Kirim (Mingguan)",
      defaultValue: "5",
      options: [
        { label: "Senin", value: "1" },
        { label: "Selasa", value: "2" },
        { label: "Rabu", value: "3" },
        { label: "Kamis", value: "4" },
        { label: "Jumat", value: "5" },
        { label: "Sabtu", value: "6" },
      ],
      admin: {
        description: "Hari pengiriman untuk laporan mingguan (default: Jumat)",
      },
    },
    {
      name: "notificationDate",
      type: "select",
      label: "Tanggal Kirim (Bulanan)",
      defaultValue: "25",
      options: Array.from({ length: 28 }, (_, i) => ({
        label: `Tanggal ${i + 1}`,
        value: String(i + 1),
      })),
      admin: {
        description: "Tanggal pengiriman untuk laporan bulanan (default: 25)",
      },
    },
    {
      name: "nextScheduledNotification",
      type: "date",
      label: "Notifikasi Berikutnya",
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
  ],
  timestamps: true,
};

function normalizePhoneToE164(input: string): string | null {
  if (!input) return null;

  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("62")) {
    digits = digits.substring(2);
  } else if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }

  if (digits.length < 8 || digits.length > 12) {
    return null;
  }

  return `+62${digits}`;
}

export default LeaderContacts;
