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
    AddonTokenPackages,
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
        "postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db",
    },
    push: true,
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