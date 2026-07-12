const LandingPage = {
    slug: "landing-page",
    label: "Landing Page",
    admin: {
        group: "CMS",
    },
    fields: [
        {
            type: "tabs",
            tabs: [
                {
                    label: "Hero",
                    fields: [
                        {
                            name: "heroBadgeText",
                            type: "text",
                            label: "Hero Badge Text",
                            defaultValue: "✨ Didukung VideaClass AI",
                        },
                        {
                            name: "heroHeadline",
                            type: "text",
                            label: "Hero Headline",
                            defaultValue: "Administrasi Guru Lebih Cepat dengan AI",
                        },
                        {
                            name: "heroSubheadline",
                            type: "textarea",
                            label: "Hero Subheadline",
                            defaultValue: "GuruPRO AI hadir untuk membantu guru membuat RPP, absensi, jurnal mengajar, hingga rapor — semua dalam satu platform, didukung kecerdasan buatan.",
                        },
                        {
                            type: "group",
                            name: "heroCTAPrimary",
                            label: "Primary CTA Button",
                            fields: [
                                {
                                    name: "label",
                                    type: "text",
                                    label: "Label",
                                    defaultValue: "Mulai Gratis Sekarang",
                                },
                                {
                                    name: "url",
                                    type: "text",
                                    label: "URL",
                                    defaultValue: "/login?mode=register",
                                },
                            ],
                        },
                        {
                            type: "group",
                            name: "heroCTASecondary",
                            label: "Secondary CTA Button",
                            fields: [
                                {
                                    name: "label",
                                    type: "text",
                                    label: "Label",
                                    defaultValue: "Lihat Demo",
                                },
                                {
                                    name: "url",
                                    type: "text",
                                    label: "URL",
                                    defaultValue: "#demo",
                                },
                            ],
                        },
                        {
                            name: "heroStats",
                            type: "array",
                            label: "Hero Stats",
                            fields: [
                                {
                                    name: "number",
                                    type: "text",
                                    label: "Number",
                                    defaultValue: "50.000+",
                                },
                                {
                                    name: "label",
                                    type: "text",
                                    label: "Label",
                                    defaultValue: "Guru Aktif",
                                },
                            ],
                        },
                    ],
                },
                {
                    label: "SEO",
                    fields: [
                        {
                            name: "seoTitle",
                            type: "text",
                            label: "SEO Title",
                        },
                        {
                            name: "seoDescription",
                            type: "textarea",
                            label: "SEO Description",
                        },
                        {
                            name: "ogImage",
                            type: "upload",
                            label: "OG Image",
                            relationTo: "media",
                        },
                    ],
                },
            ],
        },
    ],
};
export default LandingPage;
