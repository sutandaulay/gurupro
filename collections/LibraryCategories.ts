import type { CollectionConfig } from "payload";

const LibraryCategories: CollectionConfig = {
  slug: "library-categories",
  labels: {
    singular: "Kategori Perpustakaan",
    plural: "Kategori Perpustakaan",
  },
  admin: {
    group: "Perpustakaan Digital",
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "icon", "displayOrder"],
    description: "Kategori buku dan audiobook di Perpustakaan Digital",
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "Nama Kategori",
      required: true,
      maxLength: 100,
    },
    {
      name: "slug",
      type: "text",
      label: "Slug (URL)",
      required: true,
      maxLength: 100,
      admin: {
        description: "Huruf kecil, angka, dan strip. Contoh: pedagogi, pengembangan-karir",
      },
    },
    {
      name: "icon",
      type: "text",
      label: "Icon (nama lucide)",
      maxLength: 50,
      admin: {
        description: "Nama icon lucide-react, contoh: BookOpen, GraduationCap",
      },
    },
    {
      name: "displayOrder",
      type: "number",
      label: "Urutan Tampilan",
      defaultValue: 0,
      admin: {
        description: "Angka kecil muncul lebih dulu",
      },
    },
  ],
};

export default LibraryCategories;
