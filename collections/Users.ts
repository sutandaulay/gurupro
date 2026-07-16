import type { CollectionConfig } from "payload";

const Users: CollectionConfig = {
  slug: "cms-users",
  labels: {
    singular: "User",
    plural: "Users",
  },
  auth: {
    tokenExpiration: 7200,
    verify: false,
    maxLoginAttempts: 5,
    lockTime: 600000,
  },
  admin: {
    useAsTitle: "email",
    group: "Admin",
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "Nama Lengkap",
      required: true,
    },

    {
      name: "role",
      type: "select",
      label: "Role",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Viewer", value: "viewer" },
      ],
      defaultValue: "editor",
      required: true,
    },
    {
      name: "phone",
      type: "text",
      label: "Nomor Telepon",
    },
    {
      name: "pdpConsent",
      type: "group",
      label: "Persetujuan UU PDP",
      fields: [
        {
          name: "given",
          type: "checkbox",
          label: "Persetujuan Diberikan",
          required: true,
          defaultValue: false,
        },
        {
          name: "version",
          type: "text",
          label: "Versi Kebijakan",
          required: true,
        },
        {
          name: "consentedAt",
          type: "date",
          label: "Tanggal Persetujuan",
          required: true,
        },
      ],
    },
    {
      name: "phoneVerified",
      type: "checkbox",
      label: "No. HP Terverifikasi",
      defaultValue: false,
    },
    {
      name: "emailVerified",
      type: "checkbox",
      label: "Email Terverifikasi",
      defaultValue: false,
    },
    {
      name: "accountType",
      type: "select",
      label: "Tipe Akun",
      options: [
        { label: "Individual", value: "individual" },
        { label: "Institutional", value: "institutional" },
      ],
      defaultValue: "individual",
    },
    {
      name: "avatar",
      type: "upload",
      label: "Avatar",
      relationTo: "media",
    },
    {
      name: "institutionMemberships",
      type: "join",
      collection: "institution-members",
      on: "user",
    },
  ],
};

export default Users;
