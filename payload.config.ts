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
import Institutions from "./collections/Institutions";
import InstitutionMembers from "./collections/InstitutionMembers";
import ModulAjar from "./collections/ModulAjar";
import BahanAjar from "./collections/BahanAjar";
import Silabus from "./collections/Silabus";
import LKPD from "./collections/LKPD";
import LaporanEvaluasiLKPD from "./collections/LaporanEvaluasiLKPD";
import LeaderContacts from "./collections/LeaderContacts";
import PerformanceShareLinks from "./collections/PerformanceShareLinks";
import DocumentAccessGrants from "./collections/DocumentAccessGrants";
import OtpVerifications from "./collections/OtpVerifications";
import Invitations from "./collections/Invitations";
// Import koleksi presensi baru
import {
  TeacherInstitutionAssignments,
  AttendanceDevices,
  AttendanceLogs,
  AttendanceSummary,
  LeaveRequests
} from "./collections/Attendance";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const REQUIRED_PAYLOAD_DB_ENV_VARS = [
  'DB_USER',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_NAME',
  'DB_PORT',
] as const;

const hasDirectUrl = !!process.env.DATABASE_URL;
const hasComponentVars = REQUIRED_PAYLOAD_DB_ENV_VARS.every((key) => !!process.env[key]);

if (!hasDirectUrl && !hasComponentVars) {
  const missing = REQUIRED_PAYLOAD_DB_ENV_VARS.filter((key) => !process.env[key]);
  throw new Error(
    `Payload CMS startup aborted: database configuration is incomplete. ` +
    `Set DATABASE_URL, or provide all required variables: ${missing.join(', ')}. ` +
    `Please configure them in your .env before starting the app.`
  );
}

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
    admin: "/admin",
  },

  collections: [
    Users,
    Media,
    Features,
    WhyPoints,
    Categories,
    Posts,
    Institutions,
    InstitutionMembers,
    ModulAjar,
    BahanAjar,
    Silabus,
    LKPD,
    LaporanEvaluasiLKPD,
    LeaderContacts,
    PerformanceShareLinks,
    DocumentAccessGrants,
    OtpVerifications,
    Invitations,
    // Koleksi presensi baru
    TeacherInstitutionAssignments,
    AttendanceDevices,
    AttendanceLogs,
    AttendanceSummary,
    LeaveRequests,
  ],

  globals: [LandingPage, FooterContent, ChatbotConfig],

  editor: lexicalEditor(),

  secret: process.env.PAYLOAD_SECRET || "",

  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URL ||
        `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    },
    // Disable automatic schema push at runtime. Auto-push triggers an
    // interactive prompt when schema drift is detected, which hangs `next dev`
    // (no TTY) and blocks every page from loading. Run schema migration
    // manually with `npx payload migrate` / `npx payload generate:types`
    // when collections change.
    push: false,
    schemaName: "payload",
  }),

  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },

  cors: [
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ],

  csrf: [
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ],

  upload: {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  },

});