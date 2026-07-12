const Posts = {
    slug: "posts",
    labels: {
        singular: "Artikel",
        plural: "Artikel",
    },
    admin: {
        group: "Blog",
        useAsTitle: "title",
        defaultColumns: ["title", "category", "author", "publishedDate", "status"],
        listSearchableFields: ["title", "excerpt"],
    },
    versions: {
        drafts: true,
    },
    fields: [
        {
            name: "title",
            type: "text",
            label: "Judul Artikel",
            required: true,
        },
        {
            name: "slug",
            type: "text",
            label: "Slug",
            unique: true,
            admin: {
                position: "sidebar",
            },
        },
        {
            name: "author",
            type: "text",
            label: "Penulis",
            defaultValue: "Tim GuruPRO",
            admin: {
                position: "sidebar",
            },
        },
        {
            name: "publishedDate",
            type: "date",
            label: "Tanggal Publikasi",
            admin: {
                position: "sidebar",
                date: {
                    pickerAppearance: "dayAndTime",
                },
            },
        },
        {
            name: "category",
            type: "relationship",
            relationTo: "categories",
            label: "Kategori",
            hasMany: false,
            admin: {
                position: "sidebar",
            },
        },
        {
            name: "featuredImage",
            type: "upload",
            relationTo: "media",
            label: "Gambar Utama",
            admin: {
                position: "sidebar",
            },
        },
        {
            name: "excerpt",
            type: "textarea",
            label: "Ringkasan",
            admin: {
                description: "Ringkasan pendek yang tampil di daftar artikel",
            },
        },
        {
            name: "content",
            type: "richText",
            label: "Konten Artikel",
        },
        {
            name: "status",
            type: "select",
            label: "Status",
            defaultValue: "draft",
            options: [
                { label: "Draft", value: "draft" },
                { label: "Terbit", value: "published" },
            ],
            admin: {
                position: "sidebar",
            },
        },
    ],
};
export default Posts;
