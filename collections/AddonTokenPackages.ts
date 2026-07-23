import type { CollectionConfig } from "payload";

/**
 * Addon Poin Packages Collection
 * Paket Poin tambahan untuk user yang ingin membeli Poin extra
 */
const AddonTokenPackages: CollectionConfig = {
  slug: "addon-token-packages",
  labels: {
    singular: "Addon Poin Package",
    plural: "Addon Poin Packages",
  },
  admin: {
    useAsTitle: "name",
    group: "Billing",
    defaultColumns: ["name", "poin_amount", "price", "is_active", "sort_order"],
    description: "Kelola paket Poin tambahan yang bisa dibeli user",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: "Package Name",
      admin: {
        description: "Contoh: Paket 10 Poin, Paket 50 Poin",
      },
    },
    {
      name: "poin_amount",
      type: "number",
      required: true,
      label: "Jumlah Poin",
      admin: {
        description: "Jumlah Poin dalam paket ini",
      },
    },
    {
      name: "token_amount",
      type: "number",
      label: "Token Amount (Legacy)",
      admin: {
        description: "Jumlah token legacy. Sudah tidak digunakan.",
        readOnly: true,
      },
    },
    {
      name: "price",
      type: "number",
      required: true,
      label: "Price (IDR)",
    },
    {
      name: "description",
      type: "textarea",
      label: "Description",
      admin: {
        description: "Deskripsi paket untuk ditampilkan ke user",
      },
    },
    {
      name: "is_active",
      type: "checkbox",
      label: "Is Active",
      defaultValue: true,
    },
    {
      name: "sort_order",
      type: "number",
      label: "Sort Order",
      defaultValue: 0,
    },
  ],
};

export default AddonTokenPackages;
