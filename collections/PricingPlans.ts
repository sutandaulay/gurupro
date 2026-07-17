import type { CollectionConfig } from "payload";

/**
 * PricingPlans Collection
 * Manages subscription packages for GuruPRO AI
 * Source of truth for landing page pricing display
 *
 * Access: Read by all users, Write by admin only
 */
const PricingPlans: CollectionConfig = {
  slug: "pricing-plans",
  labels: {
    singular: "Paket Langganan",
    plural: "Paket Langganan",
  },
  admin: {
    useAsTitle: "packageName",
    group: "CMS Landing",
    defaultColumns: ["packageName", "price", "poin", "durationDays", "isActive", "sortOrder"],
    description: "Kelola paket langganan yang ditampilkan di landing page dan halaman billing",
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // Auto-generate slug if not provided
        if (!data.slug && data.packageName) {
          data.slug = data.packageName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        }
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
    // Basic Info
    {
      name: "packageName",
      type: "text",
      required: true,
      label: "Nama Paket",
      admin: {
        description: "Contoh: Gratis, 3 Bulan, 6 Bulan, 1 Tahun",
      },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      label: "Slug",
      admin: {
        description: "ID unik untuk paket. Contoh: free, three_month, six_month, one_year",
      },
    },
    // Pricing
    {
      name: "price",
      type: "number",
      required: true,
      label: "Harga (Rp)",
      admin: {
        description: "Harga paket dalam Rupiah. 0 untuk paket gratis.",
      },
    },
    {
      name: "poin",
      type: "number",
      required: true,
      label: "Jumlah Poin",
      admin: {
        description: "Jumlah Poin yang diberikan per paket. 1 Poin = 2000 token AI.",
      },
    },
    {
      name: "durationDays",
      type: "number",
      required: true,
      label: "Durasi (Hari)",
      admin: {
        description: "Durasi paket dalam hari. 30 = 1 bulan",
      },
    },
    // Features
    {
      name: "features",
      type: "array",
      label: "Fitur Paket",
      admin: {
        description: "Daftar fitur yang termasuk dalam paket ini",
      },
      fields: [
        {
          name: "feature",
          type: "text",
          required: true,
          label: "Fitur",
        },
      ],
    },
    // Display Options
    {
      name: "isActive",
      type: "checkbox",
      defaultValue: true,
      label: "Aktif",
      admin: {
        description: "Paket akan ditampilkan di landing page",
      },
    },
    {
      name: "isPopular",
      type: "checkbox",
      defaultValue: false,
      label: "Tandai sebagai Populer",
      admin: {
        description: "Paket akan menampilkan badge 'Paling Populer'",
      },
    },
    {
      name: "sortOrder",
      type: "number",
      defaultValue: 0,
      label: "Urutan Tampilan",
      admin: {
        description: "Semakin kecil angka, semakin di depan",
      },
    },
    // Additional Info
    {
      name: "gracePeriodDays",
      type: "number",
      defaultValue: 7,
      label: "Masa Tenggang (Hari)",
      admin: {
        description: "Jumlah hari grace period setelah subscription berakhir",
      },
    },
    {
      name: "description",
      type: "textarea",
      label: "Deskripsi Singkat",
      admin: {
        description: "Deskripsi singkat untuk tooltip atau badge",
      },
    },
    // Timestamps
    {
      name: "createdAt",
      type: "date",
      label: "Created At",
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: "updatedAt",
      type: "date",
      label: "Updated At",
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
  ],
  access: {
    read: () => true, // Public read
    create: ({ req: { user } }) => {
      return user?.role === "admin";
    },
    update: ({ req: { user } }) => {
      return user?.role === "admin";
    },
    delete: ({ req: { user } }) => {
      return user?.role === "admin";
    },
  },
};

export default PricingPlans;
