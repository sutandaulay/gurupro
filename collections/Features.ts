import type { CollectionConfig } from "payload";

const Features: CollectionConfig = {
  slug: "cms-features",
  labels: {
    singular: "Fitur Unggulan",
    plural: "Fitur Unggulan",
  },
  admin: {
    group: "CMS",
    useAsTitle: "title",
    defaultColumns: ["title", "isActive", "order"],
  },
  fields: [
    {
      name: "icon",
      type: "text",
      label: "Icon Name (Tabler)",
      defaultValue: "IconSparkles",
      required: true,
    },
    {
      name: "title",
      type: "text",
      label: "Judul Fitur",
      required: true,
    },
    {
      name: "description",
      type: "textarea",
      label: "Deskripsi",
      required: true,
    },
    {
      name: "order",
      type: "number",
      label: "Urutan",
      defaultValue: 0,
    },
    {
      name: "isActive",
      type: "checkbox",
      label: "Aktif",
      defaultValue: true,
    },
  ],
};

export default Features;
