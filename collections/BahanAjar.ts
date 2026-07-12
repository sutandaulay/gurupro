import type { CollectionConfig } from "payload";

/**
 * BahanAjar Collection
 * AI-generated teaching materials: slides outline, LKPD, and handout
 * Based on ModulAjar context and aligned with Kurikulum Merdeka/K13
 *
 * Referensi regulasi: Permendikdasmen No. 1 Tahun 2026 tentang Standar Proses
 * Paradigma Pembelajaran Mendalam: berkesadaran, bermakna, menggembirakan
 * Olah pikir, olah hati, olah rasa, olah raga
 */
const BahanAjar: CollectionConfig = {
  slug: "bahan-ajar",
  labels: {
    singular: "Bahan Ajar AI",
    plural: "Bahan Ajar AI",
  },
  admin: {
    useAsTitle: "id",
    group: "AI Generator",
    defaultColumns: ["modulAjar", "guru", "jenisKurikulum", "status", "createdAt"],
    description: "Hasil generasi AI: Slide Outline, LKPD, dan Handout",
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        if (!originalDoc) {
          data.createdAt = new Date().toISOString();
        }
        data.updatedAt = new Date().toISOString();
        return data;
      },
    ],
  },
  fields: [
    // Explicit ID field
    {
      name: "id",
      type: "text",
    },
    // Relasi ke ModulAjar
    {
      name: "modulAjar",
      type: "relationship",
      relationTo: "modul-ajar",
      required: true,
      label: "Modul Ajar",
      admin: {
        description: "Modul Ajar sebagai konteks generasi bahan ajar",
      },
    },
    // Relasi ke Users (Guru)
    {
      name: "guru",
      type: "relationship",
      relationTo: "cms-users",
      required: true,
      label: "Guru",
      admin: {
        description: "Guru yang meminta generasi bahan ajar",
      },
    },
    // ============================================
    // v2 FIELDS - New for Slide/Handout generation
    // ============================================

    // Jenis Output v2
    {
      name: "jenisOutput",
      type: "select",
      label: "Jenis Output",
      options: [
        { label: "Slide", value: "slide" },
        { label: "Handout", value: "handout" },
      ],
      admin: {
        description: "Tipe bahan ajar yang dihasilkan",
      },
    },
    // Jumlah Slide Target (untuk slide)
    {
      name: "jumlahSlideTarget",
      type: "number",
      label: "Jumlah Slide Target",
      admin: {
        description: "Target jumlah slide (±2 diperbolehkan)",
        condition: (data) => data?.jenisOutput === "slide",
      },
    },
    // Gaya Visual (untuk slide)
    {
      name: "gayaVisual",
      type: "select",
      label: "Gaya Visual",
      options: [
        { label: "Minimalis", value: "minimalis" },
        { label: "Ilustratif", value: "ilustratif" },
        { label: "Akademis", value: "akademis" },
      ],
      defaultValue: "minimalis",
      admin: {
        description: "Gaya visual slide presentasi",
        condition: (data) => data?.jenisOutput === "slide",
      },
    },
    // v2 Options - Handout
    {
      name: "handoutVersi",
      type: "select",
      label: "Versi Handout",
      options: [
        { label: "Guru (dengan kunci)", value: "guru" },
        { label: "Siswa (tanpa kunci)", value: "siswa" },
      ],
      defaultValue: "guru",
      admin: {
        description: "Versi handout - guru dengan kunci jawaban",
        condition: (data) => data?.jenisOutput === "handout",
      },
    },

    // ============================================
    // Mode Indicator
    // ============================================
    {
      name: "isStandalone",
      type: "checkbox",
      label: "Standalone Mode",
      defaultValue: false,
      admin: {
        description: "True jika dibuat tanpa Modul Ajar",
      },
    },

    // ============================================
    // LEGACY FIELDS - Still supported for backward compatibility
    // ============================================

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
    // Standar Acuan Version
    {
      name: "standarAcuanVersion",
      type: "text",
      label: "Standar Acuan Version",
      admin: {
        readOnly: true,
        description: "Referensi regulasi yang digunakan (audit trail)",
      },
      defaultValue: "Permendikdasmen No. 1/2026",
    },
    // Status generasi
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
        description: "Status proses generasi AI",
      },
    },
    // v2 Output Fields (new schema)
    {
      name: "slidesOutlineV2",
      type: "json",
      label: "Slide Outline (v2)",
      admin: {
        description: "Struktur outline slide v2 dengan speaker notes",
        editorOptions: {
          height: "300px",
        },
      },
    },
    {
      name: "handoutV2",
      type: "json",
      label: "Handout (v2)",
      admin: {
        description: "Struktur handout v2 dengan poin penting dan soal",
        editorOptions: {
          height: "300px",
        },
      },
    },
    // Legacy Output Fields (still supported)
    {
      name: "slidesOutline",
      type: "json",
      label: "Slide Outline (Legacy)",
      admin: {
        description: "Struktur outline slide legacy",
        editorOptions: {
          height: "300px",
        },
      },
    },
    {
      name: "lkpd",
      type: "json",
      label: "LKPD",
      admin: {
        description: "Lembar Kerja Peserta Didik",
        editorOptions: {
          height: "300px",
        },
      },
    },
    {
      name: "handout",
      type: "richText",
      label: "Handout (Legacy)",
      admin: {
        description: "Bahan ajar cetak/handout dalam format rich text (legacy)",
      },
    },
    // Compliance Checklist
    {
      name: "complianceChecklist",
      type: "json",
      label: "Compliance Checklist",
      admin: {
        description: "Verifikasi kepatuhan terhadap standar Permendikdasmen No. 1/2026",
        editorOptions: {
          height: "200px",
        },
      },
    },
    // Token Cost
    {
      name: "tokenCost",
      type: "number",
      label: "Token Cost",
      admin: {
        readOnly: true,
        description: "Total token yang digunakan untuk generasi ini",
      },
    },
    // Error Message
    {
      name: "errorMessage",
      type: "text",
      label: "Error Message",
      admin: {
        readOnly: true,
        description: "Pesan error jika generasi gagal",
        condition: (data) => data?.status === "failed",
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

export default BahanAjar;
