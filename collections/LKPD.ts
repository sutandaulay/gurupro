import type { CollectionConfig } from "payload";

/**
 * LKPD Collection
 * Lembar Kerja Peserta Didik - Student Worksheet
 *
 * Referensi regulasi:
 * - Permendikdasmen No. 1 Tahun 2026 (Standar Proses)
 * - Permendikdasmen No. 13 Tahun 2025 (Deep Learning)
 *
 * Output: JSON terstruktur sesuai Zod schema
 * Designed for print-ready export
 */

const LKPD: CollectionConfig = {
  slug: "lkpd",
  labels: {
    singular: "LKPD",
    plural: "LKPD",
  },
  admin: {
    useAsTitle: "namaLkpd",
    group: "AI Generator",
    defaultColumns: ["namaLkpd", "guru", "mapel", "jenjang", "fase", "jenisAktivitas", "createdAt"],
    description: "Lembar Kerja Peserta Didik - untuk aktivitas memahami & mengaplikasi siswa",
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
        description: "Guru yang membuat LKPD",
      },
    },
    // Nama LKPD
    {
      name: "namaLkpd",
      type: "text",
      required: true,
      label: "Nama LKPD",
      admin: {
        description: "Judul/nama LKPD, contoh: LKPD Tema 8 Subtema 2 Pembelajaran 1",
      },
    },
    // Sumber Data
    {
      name: "sumberData",
      type: "select",
      required: true,
      label: "Sumber Data",
      options: [
        { label: "Dari Modul Ajar", value: "dari_modul_ajar" },
        { label: "Input Manual", value: "manual" },
      ],
      defaultValue: "manual",
    },
    // Relasi ke Modul Ajar (jika dari_modul_ajar)
    {
      name: "modulAjar",
      type: "relationship",
      relationTo: "modul-ajar",
      label: "Modul Ajar Referensi",
      admin: {
        description: "Modul Ajar yang menjadi sumber kegiatan pembelajaran",
        condition: (data) => data.sumberData === "dari_modul_ajar",
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
    // Topik
    {
      name: "topik",
      type: "text",
      label: "Topik",
      admin: {
        description: "Topik utama LKPD",
      },
    },
    // Jenis Aktivitas
    {
      name: "jenisAktivitas",
      type: "select",
      required: true,
      label: "Jenis Aktivitas",
      options: [
        { label: "Individu", value: "individu" },
        { label: "Kelompok", value: "kelompok" },
      ],
      defaultValue: "individu",
    },
    // Tahap Fokus
    {
      name: "tahapFokus",
      type: "select",
      required: true,
      label: "Tahap Fokus",
      options: [
        { label: "Memahami", value: "memahami" },
        { label: "Mengaplikasi", value: "mengaplikasi" },
        { label: "Gabungan", value: "gabungan" },
      ],
      defaultValue: "gabungan",
      admin: {
        description: "Tahap pembelajaran yang difokuskan di LKPD",
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
      ],
      defaultValue: "merdeka",
    },
    // Data LKPD (JSON)
    {
      name: "lkpdData",
      type: "json",
      label: "Data LKPD",
      admin: {
        description: "Data LKPD terstruktur sesuai Zod schema",
        editorOptions: {
          height: "500px",
        },
      },
    },
    // File URLs
    {
      name: "pdfUrl",
      type: "text",
      label: "URL PDF",
      admin: {
        description: "Link download PDF (print-ready)",
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
        description: "Pilih dimensi yang relevan dengan LKPD ini",
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

export default LKPD;
