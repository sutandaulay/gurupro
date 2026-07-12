const Categories = {
    slug: "categories",
    labels: {
        singular: "Kategori",
        plural: "Kategori",
    },
    admin: {
        group: "Blog",
        useAsTitle: "title",
        defaultColumns: ["title", "slug", "postCount"],
    },
    fields: [
        {
            name: "title",
            type: "text",
            label: "Nama Kategori",
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
            name: "description",
            type: "textarea",
            label: "Deskripsi",
        },
        {
            name: "postCount",
            type: "number",
            label: "Jumlah Post",
            admin: {
                readOnly: true,
                position: "sidebar",
            },
        },
    ],
};
export default Categories;
