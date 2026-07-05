import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { buildConfig } from "payload";
import { fileURLToPath } from "url";

import Users from "./collections/Users";
import Media from "./collections/Media";
import LandingPage from "./collections/LandingPage";
import Features from "./collections/Features";
import WhyPoints from "./collections/WhyPoints";
import FooterContent from "./collections/FooterContent";
import ChatbotConfig from "./collections/ChatbotConfig";
import Categories from "./collections/Categories";
import Posts from "./collections/Posts";
import AddonTokenPackages from "./collections/AddonTokenPackages";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
    admin: {
      user: Users.slug,
      meta: {
      titleSuffix: " - GuruPRO Admin",
      icons: [
        { rel: "icon", url: "/favicon.ico" },
      ],
      openGraph: {
        images: "/og-image.png",
      },
    },
    components: {
      beforeLogin: [],
      afterLogin: [],
    },
    avatar: "gravatar",
  },

  routes: {
    admin: "/cms",
  },

  collections: [Users, Media, Features, WhyPoints, Categories, Posts, AddonTokenPackages],

  globals: [LandingPage, FooterContent, ChatbotConfig],

  editor: lexicalEditor(),

  secret: process.env.PAYLOAD_SECRET || "",

  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db",
    },
    push: true,
  }),

  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },

  cors: [
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ],

  csrf: [
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ],

  upload: {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  },

});
