import type { CollectionConfig } from "payload";

const AddonTokenPackages: CollectionConfig = {
  slug: "addon-token-packages",
  labels: {
    singular: "Addon Token Package",
    plural: "Addon Token Packages",
  },
  admin: {
    useAsTitle: "name",
    group: "Billing",
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
    },
    {
      name: "token_amount",
      type: "number",
      required: true,
      label: "Token Amount",
    },
    {
      name: "price",
      type: "number",
      required: true,
      label: "Price (IDR)",
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
