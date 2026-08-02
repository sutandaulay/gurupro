import type { CollectionConfig } from "payload";

const LibraryItems: CollectionConfig = {
  slug: "library-items",
  labels: {
    singular: "Item Perpustakaan",
    plural: "Item Perpustakaan",
  },
  admin: {
    group: "Perpustakaan Digital",
    useAsTitle: "title",
    defaultColumns: ["title", "type", "status", "createdAt"],
    listSearchableFields: ["title", "author"],
    description: "Admin Perpustakaan Digital. Upload file via /admin/library/upload, paste R2 key-nya di sini.",
  },
  fields: [
    {
      name: "title",
      type: "text",
      label: "Judul",
      required: true,
      maxLength: 255,
    },
    {
      name: "author",
      type: "text",
      label: "Penulis",
      maxLength: 150,
    },
    {
      name: "type",
      type: "select",
      label: "Tipe",
      required: true,
      options: [
        { label: "PDF (Buku)", value: "pdf" },
        { label: "Audiobook", value: "audiobook" },
      ],
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "library-categories",
      label: "Kategori",
      required: true,
    },
    {
      name: "synopsis",
      type: "textarea",
      label: "Sinopsis",
      maxLength: 500,
      admin: { rows: 3 },
    },
    {
      name: "coverImageKey",
      type: "text",
      label: "R2 Key — Cover",
      admin: {
        description: "Key object cover image di R2. Contoh: covers/{id}/cover.webp",
      },
    },
    {
      name: "fileKey",
      type: "text",
      label: "R2 Key — File",
      admin: {
        description: "Key object file di R2. Contoh: pdf/{id}/file.pdf atau audio/{id}/file.mp3",
      },
    },
    {
      name: "pageCount",
      type: "number",
      label: "Jumlah Halaman",
      admin: {
        condition: (_, siblingData) => siblingData?.type === "pdf",
      },
    },
    {
      name: "durationSeconds",
      type: "number",
      label: "Durasi (detik)",
      admin: {
        condition: (_, siblingData) => siblingData?.type === "audiobook",
      },
    },
    {
      name: "status",
      type: "select",
      label: "Status",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Terbit", value: "published" },
        { label: "Diarsipkan", value: "archived" },
      ],
    },
  ],
};

export default LibraryItems;
