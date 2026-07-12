const FooterContent = {
    slug: "footer-content",
    label: "Footer Content",
    admin: {
        group: "CMS",
    },
    fields: [
        {
            name: "description",
            type: "textarea",
            label: "Deskripsi Footer",
            defaultValue: "Platform administrasi guru berbasis AI untuk membantu guru Indonesia membuat RPP, absensi, jurnal mengajar, hingga rapor dalam satu platform.",
        },
        {
            name: "links",
            type: "array",
            label: "Navigasi Links",
            fields: [
                {
                    name: "label",
                    type: "text",
                    label: "Label",
                    required: true,
                },
                {
                    name: "url",
                    type: "text",
                    label: "URL",
                    required: true,
                },
                {
                    name: "column",
                    type: "select",
                    label: "Kolom",
                    options: [
                        { label: "Links", value: "links" },
                        { label: "Untuk Sekolah", value: "sekolah" },
                    ],
                    defaultValue: "links",
                    required: true,
                },
            ],
        },
        {
            name: "contactEmail",
            type: "text",
            label: "Email Kontak",
            defaultValue: "support@gurupro.id",
        },
        {
            name: "contactWhatsapp",
            type: "text",
            label: "WhatsApp CS",
            defaultValue: "+62 812-8396-0337",
        },
        {
            name: "socialLinks",
            type: "array",
            label: "Social Media Links",
            fields: [
                {
                    name: "platform",
                    type: "select",
                    label: "Platform",
                    options: [
                        { label: "Facebook", value: "facebook" },
                        { label: "Instagram", value: "instagram" },
                        { label: "YouTube", value: "youtube" },
                        { label: "TikTok", value: "tiktok" },
                        { label: "LinkedIn", value: "linkedin" },
                    ],
                    required: true,
                },
                {
                    name: "url",
                    type: "text",
                    label: "URL",
                    required: true,
                },
            ],
        },
        {
            name: "copyrightText",
            type: "text",
            label: "Copyright Text",
            defaultValue: "GuruPRO AI © 2026. All rights reserved.",
        },
    ],
};
export default FooterContent;
