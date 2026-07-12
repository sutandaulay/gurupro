import path from "path";
const Media = {
    slug: "media",
    labels: {
        singular: "Media",
        plural: "Media",
    },
    admin: {
        group: "CMS",
    },
    upload: {
        staticDir: path.resolve(process.cwd(), "public/uploads"),
        mimeTypes: ["image/*", "application/pdf"],
        imageSizes: [
            {
                name: "thumbnail",
                width: 400,
                height: 300,
                position: "centre",
            },
            {
                name: "card",
                width: 768,
                height: 576,
                position: "centre",
            },
            {
                name: "hero",
                width: 1920,
                height: 1080,
                position: "centre",
            },
        ],
        adminThumbnail: "thumbnail",
    },
    fields: [
        {
            name: "alt",
            type: "text",
            label: "Alt Text",
            required: true,
        },
        {
            name: "caption",
            type: "text",
            label: "Caption",
        },
        {
            name: "fileSize",
            type: "number",
            label: "File Size (bytes)",
            admin: {
                readOnly: true,
            },
        },
    ],
};
export default Media;
