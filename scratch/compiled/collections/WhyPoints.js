const WhyPoints = {
    slug: "why-points",
    labels: {
        singular: "Why Point",
        plural: "Why Points",
    },
    admin: {
        group: "CMS",
        useAsTitle: "point",
        defaultColumns: ["point", "isActive", "order"],
    },
    fields: [
        {
            name: "point",
            type: "text",
            label: "Poin Keunggulan",
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
export default WhyPoints;
