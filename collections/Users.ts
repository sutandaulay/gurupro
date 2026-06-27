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
      name: "email",
      type: "email",
      label: "Email",
      required: true,
      unique: true,
    },
    {
      name: "password",
      type: "text",
      label: "Password",
      required: true,
      admin: {
        hidden: true,
      },
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
      name: "avatar",
      type: "upload",
      label: "Avatar",
      relationTo: "media",
    },
  ],
};

export default Users;
