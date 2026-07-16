import type { CollectionConfig } from "payload";

const Invitations: CollectionConfig = {
  slug: "invitations",
  labels: {
    singular: "Invitation",
    plural: "Invitations",
  },
  admin: {
    useAsTitle: "token",
    group: "Institution Layer",
    defaultColumns: ["institution", "invitedEmail", "invitedPhone", "status", "expiresAt"],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => false,
  },
  fields: [
    {
      name: "institution",
      type: "relationship",
      relationTo: "institutions",
      required: true,
      label: "Institution",
    },
    {
      name: "invitedEmail",
      type: "text",
      required: true,
      label: "Invited Email",
    },
    {
      name: "invitedPhone",
      type: "text",
      required: true,
      label: "Invited Phone (WhatsApp)",
    },
    {
      name: "token",
      type: "text",
      required: true,
      unique: true,
      label: "Invitation Token",
    },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      label: "Expires At",
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      label: "Status",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Used", value: "used" },
        { label: "Expired", value: "expired" },
      ],
    },
    {
      name: "invitedBy",
      type: "relationship",
      relationTo: "cms-users",
      required: true,
      label: "Invited By",
    },
  ],
  timestamps: true,
};

export default Invitations;
