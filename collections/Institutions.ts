import type { CollectionConfig } from "payload";

const Institutions: CollectionConfig = {
  slug: "institutions",
  labels: {
    singular: "Institution",
    plural: "Institutions",
  },
  admin: {
    useAsTitle: "name",
    group: "Institution Layer",
    defaultColumns: ["name", "npsn", "jenjang", "naungan", "status"],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: "Nama Lembaga",
    },
    {
      name: "npsn",
      type: "text",
      unique: true,
      label: "NPSN",
    },
    {
      name: "jenjang",
      type: "select",
      required: true,
      label: "Jenjang",
      options: [
        { label: "SD", value: "SD" },
        { label: "MI", value: "MI" },
        { label: "SMP", value: "SMP" },
        { label: "MTs", value: "MTs" },
        { label: "SMA", value: "SMA" },
        { label: "MA", value: "MA" },
        { label: "SMK", value: "SMK" },
        { label: "Pesantren", value: "Pesantren" },
        { label: "Lainnya", value: "Lainnya" },
      ],
    },
    {
      name: "naungan",
      type: "select",
      required: true,
      label: "Naungan",
      options: [
        { label: "Kemendikbud", value: "Kemendikbud" },
        { label: "Kemenag", value: "Kemenag" },
        { label: "Swasta Lainnya", value: "Swasta Lainnya" },
      ],
    },
    {
      name: "subscriptionTier",
      type: "select",
      defaultValue: "trial",
      label: "Subscription Tier",
      options: [
        { label: "Trial", value: "trial" },
        { label: "Basic", value: "basic" },
        { label: "Premium", value: "premium" },
        { label: "Enterprise", value: "enterprise" },
      ],
    },
    {
      name: "academicYearActive",
      type: "text",
      label: "Tahun Akademik Aktif",
      admin: {
        placeholder: "2025/2026",
      },
    },
    {
      name: "approvalLayerConfig",
      type: "select",
      defaultValue: "single",
      label: "Approval Layer Config",
      options: [
        { label: "Single (Langsung ke Kepala Sekolah)", value: "single" },
        { label: "Double (Via Wakasek dulu)", value: "double" },
      ],
    },
    {
      name: "status",
      type: "select",
      defaultValue: "trial",
      label: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Trial", value: "trial" },
      ],
    },
    {
      name: "location",
      type: "group",
      fields: [
        {
          name: "latitude",
          type: "number",
          required: false,
          label: "Latitude",
        },
        {
          name: "longitude",
          type: "number",
          required: false,
          label: "Longitude",
        },
      ],
    },
    {
      name: "attendanceSettings",
      type: "group",
      label: "Pengaturan Presensi",
      fields: [
        {
          name: "attendanceRadiusMeters",
          type: "number",
          required: false,
          defaultValue: 100,
          label: "Radius Presensi (meter)",
        },
        {
          name: "classSessionRadiusMeters",
          type: "number",
          required: false,
          defaultValue: 150,
          label: "Radius Presensi Mengajar (meter)",
        },
        {
          name: "lateToleranceMinutes",
          type: "number",
          required: false,
          defaultValue: 10,
          label: "Toleransi Keterlambatan (menit)",
        },
        {
          name: "duplicateCheckMinutes",
          type: "number",
          required: false,
          defaultValue: 5,
          label: "Interval Cek Duplikat (menit)",
        },
        {
          name: "qrCodeEnabled",
          type: "checkbox",
          required: false,
          defaultValue: false,
          label: "Aktifkan Verifikasi QR Code",
        },
        {
          name: "qrCodeToken",
          type: "text",
          required: false,
          label: "Token QR Code Harian",
        },
      ],
    },
  ],
};

export default Institutions;