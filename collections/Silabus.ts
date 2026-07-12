import type { CollectionConfig } from "payload";

/**
 * Silabus Collection
 * Represents a Silabus/ATP (Alur Tujuan Pembelajaran) document
 *
 * Referensi regulasi:
 * - Permendikdasmen No. 1 Tahun 2026 (Standar Proses)
 * - Permendikdasmen No. 13 Tahun 2025 (Deep Learning)
 *
 * Output: JSON terstruktur sesuai Zod schema
 */

const Silabus: CollectionConfig = {
  slug: "silabus",
  labels: {
    singular: "Silabus/ATP",
    plural: "Silabus/ATP",
  },
  admin: {
    useAsTitle: "namaSilabus",
    group: "AI Generator",
    defaultColumns: ["namaSilabus", "guru", "mapel", "jenjang", "fase", "semester", "createdAt"],
    description: "Silabus / Alur Tujuan Pembelajaran (ATP) untuk satu semester",
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // Auto-set timestamps
        if (!originalDoc) {
          data.createdAt = new Date().toISOString();
        }
        data.updatedAt = new Date().toISOString();
        return data;
      },
    ],
  },
  fields: [
    // Relasi ke Users (Guru)
    {
      name: "guru",
      type: "relationship",
      relationTo: "cms-users",
      required: true,
      label: "Guru",
      admin: {
        description: "Guru yang membuat silabus",
      },
    },
    // Nama Silabus
    {
      name: "namaSilabus",
      type: "text",
      required: true,
      label: "Nama Silabus",
      admin: {
        description: "Judul/nama silabus, contoh: Silabus Matematika Kelas 10 Fase E Semester 1",
      },
    },
    // Jenjang
    {
      name: "jenjang",
      type: "select",
      required: true,
      label: "Jenjang",
      options: [
        { label: "SD", value: "SD" },
        { label: "SMP", value: "SMP" },
        { label: "SMA", value: "SMA" },
        { label: "SMK", value: "SMK" },
      ],
      defaultValue: "SMA",
    },
    // Fase
    {
      name: "fase",
      type: "select",
      required: true,
      label: "Fase",
      options: [
        { label: "Fase A (SD Kelas 1-2)", value: "A" },
        { label: "Fase B (SD Kelas 3)", value: "B" },
        { label: "Fase C (SD Kelas 4-6)", value: "C" },
        { label: "Fase D (SMP Kelas 7-9)", value: "D" },
        { label: "Fase E (SMA Kelas 10-11)", value: "E" },
        { label: "Fase F (SMA/SMK Kelas 12)", value: "F" },
      ],
    },
    // Mata Pelajaran
    {
      name: "mapel",
      type: "text",
      required: true,
      label: "Mata Pelajaran",
      admin: {
        description: "Nama mata pelajaran",
      },
    },
    // Kelas
    {
      name: "kelas",
      type: "text",
      label: "Kelas",
      admin: {
        description: "Contoh: Kelas 10, Kelas 7 IPA",
      },
    },
    // Semester
    {
      name: "semester",
      type: "select",
      required: true,
      label: "Semester",
      options: [
        { label: "Semester 1 (Ganjil)", value: "1" },
        { label: "Semester 2 (Genap)", value: "2" },
      ],
    },
    // Tahun Ajaran
    {
      name: "tahunAjaran",
      type: "text",
      label: "Tahun Ajaran",
      admin: {
        description: "Contoh: 2025/2026",
      },
    },
    // Jenis Kurikulum
    {
      name: "jenisKurikulum",
      type: "select",
      required: true,
      label: "Jenis Kurikulum",
      options: [
        { label: "Kurikulum Merdeka", value: "merdeka" },
        { label: "Kurikulum 2013 (K13)", value: "k13" },
        { label: "Kurikulum Berbasis Cinta (KBC)", value: "kbc" },
      ],
      defaultValue: "merdeka",
    },
    // Capaian Pembelajaran
    {
      name: "capaianPembelajaran",
      type: "textarea",
      label: "Capaian Pembelajaran (CP)",
      admin: {
        description: "Capaian Pembelajaran dari kurikulum (opsional - bisa diinfer dari fase+mapel)",
      },
    },
    // Jumlah Minggu Efektif
    {
      name: "jumlahMingguEfektif",
      type: "number",
      label: "Jumlah Minggu Efektif",
      defaultValue: 18,
      admin: {
        description: "Jumlah minggu efektif dalam semester (default: 18)",
      },
    },
    // Dimensi Profil Lulusan
    {
      name: "dimensi8",
      type: "select",
      label: "8 Dimensi Profil Lulusan",
      hasMany: true,
      options: [
        { label: "1. Beriman, Bertakwa, Berakhlak Mulia", value: "imtaq" },
        { label: "2. Berkebinekaan Global", value: "berkebinekaan_global" },
        { label: "3. Gotong Royong", value: "bergotong_royong" },
        { label: "4. Merdeka", value: "merdeka" },
        { label: "5. Kreatif", value: "kreatif" },
        { label: "6. Bernalar Kritis", value: "bernalar_kritis" },
        { label: "7. Mengakar pada Budi Pekerti Luhur", value: "budi_pekerti_luhur" },
        { label: "8. Kreativitas (Deep Learning)", value: "kreativitas" },
      ],
      admin: {
        description: "Pilih dimensi yang relevan dengan mata pelajaran ini",
      },
    },
    // Deep Learning (3 Pengalaman Belajar)
    {
      name: "tigaPengalaman",
      type: "checkbox",
      label: "Gunakan Deep Learning (3 Pengalaman Belajar)",
      defaultValue: false,
      admin: {
        description: "Aktifkan pendekatan Memahami-Mengaplikasi-Merefleksikan",
      },
    },
    // PAI Mode
    {
      name: "paiMode",
      type: "select",
      label: "Mode PAI",
      options: [
        { label: "Tidak适用", value: "none" },
        { label: "Integrasi Spiritual", value: "spiritual_only" },
        { label: "Hybrid KBC", value: "hybrid_kbc" },
      ],
      defaultValue: "none",
      admin: {
        description: "Untuk mata pelajaran PAI dan Budi Pekerti",
      },
    },
    // Data ATP (JSON)
    {
      name: "silabusData",
      type: "json",
      label: "Data Silabus/ATP",
      admin: {
        description: "Data ATP terstruktur (JSON)",
        editorOptions: {
          height: "400px",
        },
      },
    },
    // File URLs
    {
      name: "pdfUrl",
      type: "text",
      label: "URL PDF",
      admin: {
        description: "Link download PDF",
        readOnly: true,
      },
    },
    {
      name: "docxUrl",
      type: "text",
      label: "URL DOCX",
      admin: {
        description: "Link download DOCX",
        readOnly: true,
      },
    },
    // Status
    {
      name: "status",
      type: "select",
      required: true,
      label: "Status",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Generating", value: "generating" },
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
      ],
      defaultValue: "draft",
    },
    // Timestamps
    {
      name: "createdAt",
      type: "date",
      label: "Created At",
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: "default",
        },
      },
    },
    {
      name: "updatedAt",
      type: "date",
      label: "Updated At",
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: "default",
        },
      },
    },
  ],
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === "admin") return true;
      return Boolean(user);
    },
    create: ({ req: { user } }) => {
      return Boolean(user);
    },
    update: ({ req: { user }, id, data }) => {
      if (user?.role === "admin") return true;
      if (!user) return false;
      if (id && data?.guru === user.id) {
        return true;
      }
      return false;
    },
    delete: ({ req: { user } }) => {
      return user?.role === "admin";
    },
  },
};

export default Silabus;
