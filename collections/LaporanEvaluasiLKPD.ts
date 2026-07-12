import type { CollectionConfig } from "payload";

/**
 * Laporan Evaluasi LKPD Collection
 * Evaluation Report for Student Worksheets (LKPD)
 *
 * Designed for school leadership (Principal/Vice Principal) consumption
 * NOT a planning document - formal administrative language
 *
 * Access control:
 * - Principal/Vice Principal/Operator/Admin: full access
 * - Teacher (creator): can create, own records visible
 * - Other teachers: cannot view (access_terbatas)
 *
 * Privacy: No individual student names in narrative - only aggregate data
 */

const LaporanEvaluasiLKPD: CollectionConfig = {
  slug: "laporan-evaluasi-lkpd",
  labels: {
    singular: "Laporan Evaluasi LKPD",
    plural: "Laporan Evaluasi LKPD",
  },
  admin: {
    useAsTitle: "judulLaporan",
    group: "AI Generator",
    defaultColumns: ["judulLaporan", "guru", "mapel", "periodeEvaluasi", "jumlahSiswa", "createdAt"],
    description: "Laporan Evaluasi LKPD untuk Kepala Sekolah/Wakasek - akses terbatas",
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
    // Relasi ke Users (Guru Pengampu)
    {
      name: "guru",
      type: "relationship",
      relationTo: "cms-users",
      required: true,
      label: "Guru Pengampu",
      admin: {
        description: "Guru yang membuat laporan evaluasi",
      },
    },
    // Judul Laporan
    {
      name: "judulLaporan",
      type: "text",
      required: true,
      label: "Judul Laporan",
      admin: {
        description: "Contoh: Laporan Evaluasi LKPD Matematika Kelas 10A - Oktober 2026",
      },
    },
    // Relasi ke LKPD yang dievaluasi
    {
      name: "lkpdRef",
      type: "relationship",
      relationTo: "lkpd",
      required: true,
      label: "LKPD yang Dievaluasi",
      admin: {
        description: "Pilih LKPD yang akan dievaluasi",
      },
    },
    // Jenjang
    {
      name: "jenjang",
      type: "select",
      label: "Jenjang",
      options: [
        { label: "SD", value: "SD" },
        { label: "SMP", value: "SMP" },
        { label: "SMA", value: "SMA" },
        { label: "SMK", value: "SMK" },
      ],
    },
    // Fase
    {
      name: "fase",
      type: "select",
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
    // Periode Evaluasi
    {
      name: "periodeEvaluasi",
      type: "text",
      required: true,
      label: "Periode Evaluasi",
      admin: {
        description: "Contoh: Minggu 3, Oktober 2026",
      },
    },
    // Jumlah Siswa
    {
      name: "jumlahSiswa",
      type: "number",
      required: true,
      label: "Jumlah Siswa",
      admin: {
        description: "Total siswa yang dievaluasi",
      },
    },
    // Metode Input Data
    {
      name: "metodeInputData",
      type: "select",
      required: true,
      label: "Metode Input Data",
      options: [
        { label: "Upload Excel", value: "upload_excel" },
        { label: "Input Manual", value: "input_manual" },
        { label: "Ringkasan Kualitatif", value: "ringkasan_kualitatif" },
      ],
      defaultValue: "ringkasan_kualitatif",
    },
    // Data Laporan (JSON)
    {
      name: "laporanData",
      type: "json",
      label: "Data Laporan",
      admin: {
        description: "Data laporan evaluasi terstruktur sesuai Zod schema",
        editorOptions: {
          height: "500px",
        },
      },
    },
    // Catatan Guru
    {
      name: "catatanGuru",
      type: "textarea",
      label: "Catatan Guru",
      admin: {
        description: "Observasi tambahan dari guru pengampu",
      },
    },
    // Ringkasan Kualitatif (untuk metode ringkasan_kualitatif)
    {
      name: "ringkasanKualitatif",
      type: "textarea",
      label: "Ringkasan Kualitatif",
      admin: {
        description: "Deskripsi kualitatif hasil evaluasi (tanpa angka)",
        condition: (data) => data.metodeInputData === "ringkasan_kualitatif",
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
    // Akses Terbatas (RBAC flag)
    {
      name: "aksesTerbatas",
      type: "checkbox",
      defaultValue: true,
      label: "Akses Terbatas",
      admin: {
        description: "Jika aktif, hanya Kepala Sekolah/Wakasek dan Guru Pengampu yang bisa melihat",
        readOnly: true,
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
      // Admin can see everything
      if (user?.role === "admin") return true;

      // For now, only return documents where user is the creator
      // Full RBAC with institution roles would need additional checks
      if (user?.id) {
        return {
          guru: { equals: user.id },
        };
      }

      return false;
    },
    create: ({ req: { user } }) => {
      // Any authenticated user can create
      return Boolean(user);
    },
    update: ({ req: { user }, id, data }) => {
      if (user?.role === "admin") return true;
      if (!user) return false;
      // Only creator can update
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

export default LaporanEvaluasiLKPD;
