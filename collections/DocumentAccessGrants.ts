import type { CollectionConfig } from "payload";
import { ALLOWED_DOCUMENT_CATEGORIES } from "./config";

const DocumentAccessGrants: CollectionConfig = {
  slug: "document-access-grants",
  labels: {
    singular: "Document Access Grant",
    plural: "Document Access Grants",
  },
  admin: {
    useAsTitle: "documentCategory",
    group: "Performance Sharing",
    defaultColumns: ["performanceShareLinkId", "documentCategory", "otpVerified", "grantedAt", "revokedAt"],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      return {
        teacherId: { equals: user.id },
      };
    },
    create: ({ req: { user } }) => {
      return !!user;
    },
    update: ({ req: { user }, data }) => {
      if (!user) return false;
      return {
        teacherId: { equals: user.id },
      };
    },
    delete: ({ req: { user }, data }) => {
      if (!user) return false;
      return {
        teacherId: { equals: user.id },
      };
    },
  },
  fields: [
    {
      name: "performanceShareLinkId",
      type: "text",
      required: true,
      label: "Share Link",
      admin: {
        description: "ID share link terkait",
      },
    },
    {
      name: "teacherId",
      type: "text",
      required: true,
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: "documentCategory",
      type: "select",
      required: true,
      label: "Kategori Dokumen",
      options: ALLOWED_DOCUMENT_CATEGORIES.map((cat) => ({
        label: cat.label,
        value: cat.value,
      })),
      admin: {
        description: "Kategori yang diizinkan untuk dilihat pimpinan",
      },
      hooks: {
        validate: [
          (_, { value }) => {
            if (!value) return "Kategori dokumen wajib dipilih";
            const allowedValues = ALLOWED_DOCUMENT_CATEGORIES.map((c) => c.value);
            if (!allowedValues.includes(value)) {
              return "Kategori tidak valid - hanya kategori mengajar yang diizinkan";
            }
            return true;
          },
        ],
      },
    },
    {
      name: "otpVerified",
      type: "checkbox",
      label: "OTP Terverifikasi",
      defaultValue: false,
      admin: {
        readOnly: true,
        description: "Pimpinan harus verifikasi OTP sebelum bisa melihat dokumen",
      },
    },
    {
      name: "otpVerifiedAt",
      type: "date",
      label: "Tanggal Verifikasi OTP",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "grantedAt",
      type: "date",
      label: "Tanggal Pemberian Izin",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "revokedAt",
      type: "date",
      label: "Dicabut Pada",
      admin: {
        readOnly: true,
      },
    },
  ],
  timestamps: true,
};

export default DocumentAccessGrants;
