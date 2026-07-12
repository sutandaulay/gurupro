import type { CollectionConfig } from "payload";
import { COLLECTIONS } from "./config";

const PerformanceShareLinks: CollectionConfig = {
  slug: "performance-share-links",
  labels: {
    singular: "Performance Share Link",
    plural: "Performance Share Links",
  },
  admin: {
    useAsTitle: "shareToken",
    group: "Performance Sharing",
    defaultColumns: ["teacherId", "leaderContactId", "accessLevel", "viewCount", "expiresAt"],
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
      name: "teacherId",
      type: "text",
      required: true,
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: "leaderContactId",
      type: "text",
      required: true,
      label: "Kontak Pimpinan",
      admin: {
        description: "ID kontak pimpinan terkait",
      },
    },
    {
      name: "shareToken",
      type: "text",
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        description: "Token unik untuk link publik",
      },
    },
    {
      name: "accessLevel",
      type: "select",
      label: "Level Akses",
      defaultValue: "level1_summary_only",
      options: [
        { label: "Level 1 - Status Ringkas", value: "level1_summary_only" },
        { label: "Level 2 - Akses Dokumen", value: "level2_document_access" },
      ],
      admin: {
        readOnly: true,
      },
    },
    {
      name: "aggregatedStats",
      type: "json",
      label: "Statistik Agregat",
      admin: {
        description: "Data yang dishare ke pimpinan (Level 1)",
        readOnly: true,
      },
    },
    {
      name: "expiresAt",
      type: "date",
      label: "Berlaku Hingga",
      admin: {
        description: "Default 30 hari dari pembuatan",
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
    {
      name: "viewCount",
      type: "number",
      label: "Jumlah Dilihat",
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
  ],
  timestamps: true,
};

export default PerformanceShareLinks;
