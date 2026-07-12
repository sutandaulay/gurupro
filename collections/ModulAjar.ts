import type { CollectionConfig } from "payload";

/**
 * ModulAjar Collection
 * Represents a teaching module (Modul Ajar) that serves as context for Bahan Ajar generation.
 *
 * Referensi regulasi: Permendikdasmen No. 1 Tahun 2026 tentang Standar Proses
 * Paradigma Pembelajaran Mendalam: berkesadaran, bermakna, menggembirakan
 */
const ModulAjar: CollectionConfig = {
  slug: "modul-ajar",
  labels: {
    singular: "Modul Ajar",
    plural: "Modul Ajar",
  },
  admin: {
    useAsTitle: "namaModul",
    group: "AI Generator",
    defaultColumns: ["namaModul", "guru", "mapel", "jenjang", "status", "createdAt"],
    description: "Modul Ajar sebagai konteks untuk generasi Bahan Ajar AI",
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
        description: "Guru yang membuat modul ajar",
      },
    },
    // Nama Modul Ajar
    {
      name: "namaModul",
      type: "text",
      required: true,
      label: "Nama Modul Ajar",
      admin: {
        description: "Judul/nama modul ajar",
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
      defaultValue: "SD",
    },
    // Fase
    {
      name: "fase",
      type: "select",
      label: "Fase",
      options: [
        { label: "Fase A", value: "A" },
        { label: "Fase B", value: "B" },
        { label: "Fase C", value: "C" },
        { label: "Fase D", value: "D" },
        { label: "Fase E", value: "E" },
      ],
      admin: {
        description: "Fase pembelajaran (untuk SD-SMA)",
      },
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
        description: "Contoh: Kelas 4, Kelas 7 IPA",
      },
    },
    // Jenis Kurikulum
    {
      name: "jenisKurikulum",
      type: "select",
      required: true,
      label: "Jenis Kurikulum",
      options: [
        { label: "Kurikulum Merdeka", value: "kurikulum_merdeka" },
        { label: "Kurikulum 2013 (K13)", value: "k13" },
      ],
      defaultValue: "kurikulum_merdeka",
    },
    // Capaian Pembelajaran (CP)
    {
      name: "cp",
      type: "textarea",
      label: "Capaian Pembelajaran (CP)",
      admin: {
        description: "Capaian Pembelajaran dari kurikulum",
      },
    },
    // Tujuan Pembelajaran (TP)
    {
      name: "tp",
      type: "json",
      label: "Tujuan Pembelajaran (TP)",
      admin: {
        description: "Array tujuan pembelajaran",
        editorOptions: {
          height: "200px",
        },
      },
    },
    // Alur Tujuan Pembelajaran (ATP)
    {
      name: "atp",
      type: "json",
      label: "Alur Tujuan Pembelajaran (ATP)",
      admin: {
        description: "ATP dengan detail pertemuan",
        editorOptions: {
          height: "300px",
        },
      },
    },
    // Topik
    {
      name: "topik",
      type: "text",
      label: "Topik Pembelajaran",
      admin: {
        description: "Topik utama pembelajaran",
      },
    },
    // Materi Pokok
    {
      name: "materiPokok",
      type: "json",
      label: "Materi Pokok",
      admin: {
        description: "Array materi pokok",
        editorOptions: {
          height: "200px",
        },
      },
    },
    // Jumlah Pertemuan
    {
      name: "jumlahPertemuan",
      type: "number",
      label: "Jumlah Pertemuan",
      defaultValue: 4,
      admin: {
        description: "Total pertemuan untuk modul ini",
      },
    },
    // Alokasi Waktu per Pertemuan
    {
      name: "alokasiWaktu",
      type: "text",
      label: "Alokasi Waktu per Pertemuan",
      admin: {
        description: "Contoh: 35 menit, 2 x 40 menit",
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
      admin: {
        description: "Status modul ajar",
      },
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

export default ModulAjar;
