import type { CollectionConfig } from "payload";

const InstitutionMembers: CollectionConfig = {
  slug: "institution-members",
  labels: {
    singular: "Institution Member",
    plural: "Institution Members",
  },
  admin: {
    useAsTitle: "id",
    group: "Institution Layer",
    defaultColumns: ["user", "institution", "role", "status", "joinedAt"],
  },
  indexes: [
    {
      fields: ["user", "institution"],
      unique: true,
    },
  ],
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "cms-users",
      required: true,
      label: "User",
    },
    {
      name: "appUserId",
      type: "text",
      label: "App User ID (UUID)",
      admin: {
        readOnly: true,
        description: "Reference to application users table",
      },
    },
    {
      name: "institution",
      type: "relationship",
      relationTo: "institutions",
      required: true,
      label: "Institution",
    },
    {
      name: "role",
      type: "select",
      required: true,
      hasMany: true,
      label: "Roles",
      options: [
        { label: "Kepala Sekolah", value: "kepala_sekolah" },
        { label: "Wakasek", value: "wakasek" },
        { label: "Operator", value: "operator" },
        { label: "Admin Sekolah", value: "admin_sekolah" },
        { label: "Bendahara", value: "bendahara" },
        { label: "Guru", value: "guru" },
        { label: "Wali Kelas", value: "wali_kelas" },
        { label: "Pembina Ekskul", value: "pembina_ekskul" },
      ],
    },
    {
      name: "status",
      type: "select",
      defaultValue: "invited",
      required: true,
      label: "Membership State",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Left", value: "left" },
        { label: "Rejected", value: "rejected" },
      ],
    },
    {
      name: "assignedMapel",
      type: "array",
      label: "Assigned Mapel",
      fields: [
        {
          name: "mapel",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "assignedKelas",
      type: "array",
      label: "Assigned Kelas",
      fields: [
        {
          name: "kelas",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "joinedAt",
      type: "date",
      label: "Joined At",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "subRole",
      type: "select",
      label: "Sub-Role",
      options: [
        { label: "Tidak Ada", value: "" },
        { label: "Wali Kelas", value: "wali_kelas" },
        { label: "Pembina Ekskul", value: "pembina_ekskul" },
      ],
      admin: {
        description: "Penugasan sub-role tambahan di luar role utama",
      },
    },
    {
      name: "waliKelasOf",
      type: "text",
      label: "Wali Kelas Untuk Kelas",
      admin: {
        description: "Nama kelas yang menjadi tanggung jawab Wali Kelas, contoh: VII-A, X-MIPA-1",
      },
    },
    {
      name: "ekskulName",
      type: "text",
      label: "Nama Ekskul",
      admin: {
        description: "Nama ekstrakurikuler yang diasuh oleh Pembina Ekskul",
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        if (data.status === "active" && (!originalDoc || originalDoc.status !== "active")) {
          data.joinedAt = new Date().toISOString();
        }
        return data;
      },
    ],
  },
};

export default InstitutionMembers;
