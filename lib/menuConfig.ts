import {
  LayoutDashboard,
  Database,
  Clock,
  FileText,
  BarChart3,
  Bot,
  BookOpen,
  FileBarChart,
  Sprout,
  Users,
  Trophy,
  Building2,
  MessageCircle,
  Wallet,
  Archive,
  Settings,
  CreditCard,
  UserCheck,
  Presentation,
  FileX,
  FileSpreadsheet,
  Calendar,
  Pencil,
  CheckCircle,
  Sparkles,
  Bell,
  Brain,
  FolderOpen,
  ClipboardList,
  FileSearch,
  LayoutTemplate,
  List,
  Plus,
  Award,
  Star,
  User,
  GraduationCap,
  Gift,
  TrendingUp,
  TrendingDown,
  CheckSquare,
} from "lucide-react";

export type MenuItem = {
  label: string;
  href?: string;
  submenu?: { label: string; href: string; desc?: string }[];
};

export type Category = 
  | "core"
  | "data"
  | "attendance"
  | "admin"
  | "monitoring"
  | "ai"
  | "academic"
  | "raport"
  | "reports"
  | "growth"
  | "people"
  | "achievement"
  | "institution"
  | "finance"
  | "settings";

export interface CategoryTheme {
  gradient: [string, string];
  keywords: string[];
}

export const categoryThemes: Record<Category, CategoryTheme> = {
  core: { 
    gradient: ["#8B5CF6", "#6D28D9"],
    keywords: ["dasbor", "dashboard", "home", "ringkasan"]
  },
  data: { 
    gradient: ["#818CF8", "#4F46E5"],
    keywords: ["master data", "database", "siswa", "kelas", "brankas", "arsip", "storage", "data"]
  },
  attendance: { 
    gradient: ["#38BDF8", "#0284C7"],
    keywords: ["presensi", "absensi", "jadwal", "time"]
  },
  admin: { 
    gradient: ["#34D399", "#059669"],
    keywords: ["administrasi", "surat", "dokumen", "arsip", "prota", "prosem", "atp", "silabus", "rpp", "lkpd", "bahan ajar", "persetujuan", "eksekutif", "approval"]
  },
  monitoring: { 
    gradient: ["#FB923C", "#EA580C"],
    keywords: ["monitoring", "analisis", "statistik", "performa", "jurnal", "kalender", "supervisi", "tugas", "pengingat"]
  },
  ai: { 
    gradient: ["#F472B6", "#DB2777"],
    keywords: ["ai", "chatbot", "asisten", "generate", "deep learning"]
  },
  academic: { 
    gradient: ["#22D3EE", "#0891B2"],
    keywords: ["nilai", "soal", "modul", "rpp", "ajar", "mapel", "kelas"]
  },
  raport: { 
    gradient: ["#22D3EE", "#0891B2"],
    keywords: ["raport"]
  },
  reports: { 
    gradient: ["#A78BFA", "#7C3AED"],
    keywords: ["laporan", "rekap", "export", "cetak", "evidence"]
  },
  growth: { 
    gradient: ["#4ADE80", "#16A34A"],
    keywords: ["karakter", "tunas", "pembinaan", "akhlak", "pengembangan diri", "kegiatan", "sertifikat"]
  },
  people: { 
    gradient: ["#FB7185", "#E11D48"],
    keywords: ["guru", "wali kelas", "staff", "pengguna", "user", "siswa", "komunitas", "anggota", "orang"]
  },
  achievement: { 
    gradient: ["#FBBF24", "#D97706"],
    keywords: ["prestasi", "poin", "badge", "reward", "ekskul", "penilaian"]
  },
  institution: { 
    gradient: ["#94A3B8", "#475569"],
    keywords: ["institusi", "yayasan", "sekolah", "cabang", "manajemen"]
  },
  finance: { 
    gradient: ["#FCD34D", "#B45309"],
    keywords: ["bendahara", "keuangan", "tagihan", "spp", "billing", "pemasukan", "pengeluaran", "referral", "cashback"]
  },
  settings: { 
    gradient: ["#C084FC", "##9333EA"],
    keywords: ["pengaturan", "konfigurasi", "setting"]
  },
};

export const institutionSubmenus: MenuItem["submenu"] = [
  { label: "Overview Institusi", href: "/institusi/ID/dashboard", desc: "Ringkasan data institusi" },
  { label: "Manajemen Guru", href: "/institusi/ID/dashboard/guru", desc: "Kelola guru, undang, dan role" },
  { label: "Rekap TPG", href: "/institusi/ID/dashboard/tpg", desc: "Rekap tunjangan profesi guru" },
  { label: "Laporan Mengajar", href: "/institusi/ID/dashboard/laporan-mengajar" },
  { label: "Approval / Persetujuan", href: "/institusi/ID/dashboard/approval" },
  { label: "Langganan & Billing", href: "/institusi/ID/dashboard/langganan" },
  { label: "Pengaturan Institusi", href: "/institusi/ID/dashboard/pengaturan" },
];

export const masterMenus: MenuItem[] = [
  { label: "Dasbor", href: "/dashboard" },
  {
    label: "Master Data",
    href: "/dashboard?module=sekolah",
  },
  {
    label: "Presensi",
    submenu: [
      { label: "Presensi Saya", href: "/dashboard/attendance" },
      { label: "Presensi Mengajar", href: "/dashboard/attendance/teaching" },
      { label: "Pengajuan Izin", href: "/dashboard/attendance/leave" },
      { label: "Laporan Presensi", href: "/dashboard/reports/attendance" },
      { label: "Rekap TPG", href: "/dashboard/reports/tpg" },
    ],
  },
  {
    label: "Administrasi",
    submenu: [
      { label: "AI Silabus", href: "/dashboard/administrasi?tipe=silabus" },
      { label: "Program Tahunan (Prota)", href: "/dashboard/prota" },
      { label: "Program Semester (Prosem)", href: "/dashboard/prosem" },
      { label: "ATP Editor", href: "/dashboard/atp-editor" },
      { label: "AI Modul Ajar", href: "/dashboard/administrasi?tipe=modul_ajar" },
      { label: "AI RPP", href: "/dashboard/administrasi?tipe=rpp" },
      { label: "AI LKPD", href: "/dashboard/administrasi?tipe=lkpd" },
      { label: "AI Bahan Ajar", href: "/dashboard/administrasi?tipe=bahan_ajar" },
      { label: "Persetujuan RPP (Kepsek)", href: "/dashboard/approval-rpp" },
      { label: "Dasbor Eksekutif (Kepsek)", href: "/dashboard/executive-dashboard" },
      { label: "Buat Soal AI", href: "/dashboard?module=soal" },
    ],
  },
  {
    label: "Monitoring",
    submenu: [
      { label: "Jurnal Mengajar", href: "/dashboard?module=jurnal" },
      { label: "Kalender Akademik", href: "/dashboard?module=kalender" },
      { label: "Supervisi & Analitik", href: "/dashboard?module=supervisi_analitik" },
      { label: "Tugas Harian", href: "/dashboard?module=tugas_harian" },
      { label: "Pengingat", href: "/dashboard?module=scheduler" },
    ],
  },
  {
    label: "AI",
    submenu: [
      { label: "Chat AI", href: "/dashboard/chat" },
      { label: "AI Performance Report", href: "/dashboard/ai-performance-report" },
      { label: "Deep Learning", href: "/dashboard" },
    ],
  },
  {
    label: "Buku Nilai",
    href: "/dashboard?module=nilai",
  },
  {
    label: "Laporan",
    submenu: [
      { label: "Laporan Harian & Mengajar", href: "/dashboard/laporan-harian", desc: "Rekap harian resmi + arsip jurnal mengajar" },
      { label: "Laporan Kinerja", href: "/dashboard/laporan-kinerja" },
      { label: "Evidence", href: "/dashboard/evidence" },
    ],
  },
  {
    label: "Raport",
    submenu: [
      { label: "Status Raport", href: "/dashboard/raport-status" },
      { label: "Review Nilai Raport", href: "/dashboard/rapor-review" },
      { label: "Layout Raport", href: "/dashboard/layout-raport" },
      { label: "Pemetaan Kolom Raport", href: "/dashboard/pemetaan-kolom" },
    ],
  },
  {
    label: "Pengembangan Diri",
    submenu: [
      { label: "Daftar Kegiatan", href: "/dashboard/pengembangan-diri" },
      { label: "Buat Baru", href: "/dashboard/pengembangan-diri/tambah" },
      { label: "Sertifikat", href: "/dashboard/pengembangan-diri?tab=documents" },
    ],
  },
  {
    label: "Perpustakaan",
    href: "/dashboard/perpustakaan",
  },
  {
    label: "Wali Kelas",
    submenu: [
      { label: "Dashboard Wali Kelas", href: "/dashboard/wali-kelas" },
      { label: "Daftar Siswa", href: "/dashboard/wali-kelas?tab=siswa" },
      { label: "Catatan Wali Kelas", href: "/dashboard/wali-kelas?tab=catatan" },
      { label: "Laporan Wali Kelas", href: "/dashboard/wali-kelas?tab=laporan" },
    ],
  },
  {
    label: "Pembina Eskul",
    submenu: [
      { label: "Dashboard Pembina", href: "/dashboard/pembina-ekskul" },
      { label: "Daftar Kegiatan", href: "/dashboard/pembina-ekskul?tab=daftar" },
      { label: "Penilaian", href: "/dashboard/pembina-ekskul?tab=penilaian" },
      { label: "Laporan", href: "/dashboard/pembina-ekskul?tab=laporan" },
    ],
  },
  {
    label: "Institusi",
    submenu: institutionSubmenus,
  },
  {
    label: "Komunitas Guru",
    href: "/dashboard/forum",
  },
  {
    label: "Keuangan",
    href: "/dashboard?module=keuangan",
  },
  {
    label: "Brankas",
    href: "/dashboard/brankas",
  },
  {
    label: "Pengaturan",
    href: "/profile?tab=pengaturan",
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
  },
];

export function isInstitutionHref(href?: string): boolean {
  return !!href && (href === "/dashboard/institution" || href.startsWith("/dashboard/institution/"));
}

export interface ActiveContextPayload {
  activeContext?: unknown;
  institutions?: { id: number }[];
}

export function resolveActiveInstitutionId(data: ActiveContextPayload): number | null {
  if (data.activeContext && data.activeContext !== "individual") {
    return (data.activeContext as { institutionId: number }).institutionId;
  }
  return data.institutions?.[0]?.id ?? null;
}

export function resolveInstitutionHref(href: string, institutionId: number | null): string {
  if (!institutionId) return "/dashboard";
  const base = `/institusi/${institutionId}`;
  const institutionMap: Record<string, string> = {
    "/dashboard/institution": `${base}/dashboard`,
    "/dashboard/institution/members": `/dashboard/institution/${institutionId}/operator`,
    "/dashboard/institution/tpg": `${base}/dashboard/tpg`,
    "/dashboard/institution/laporan-mengajar": `/dashboard/institution/${institutionId}/laporan-mengajar`,
    "/dashboard/institution/approval": `${base}/dashboard/approval`,
    "/dashboard/institution/langganan": `${base}/dashboard/langganan`,
    "/dashboard/institution/settings": `${base}/dashboard/pengaturan`,
  };
  return institutionMap[href] ?? href;
}

export function resolveCategory(label: string): Category | null {
  const lower = label.toLowerCase();
  for (const [cat, data] of Object.entries(categoryThemes)) {
    if (data.keywords.some((kw) => lower.includes(kw))) {
      return cat as Category;
    }
  }
  return null;
}

export function resolveGradient(label: string): [string, string] {
  const cat = resolveCategory(label);
  if (!cat) return ["#7C3AED", "#5B21B6"];
  return categoryThemes[cat].gradient;
}

export function getLucideIcon(label: string): any {
  const map: Record<string, any> = {
    "Dasbor": LayoutDashboard,
    "Master Data": Database,
    "Presensi": Clock,
    "Presensi Saya": UserCheck,
    "Presensi Mengajar": Presentation,
    "Pengajuan Izin": FileX,
    "Laporan Presensi": FileSpreadsheet,
    "Rekap TPG": FileSpreadsheet,
    "Administrasi": FileText,
    "AI Silabus": FileText,
    "Program Tahunan (Prota)": Calendar,
    "Program Semester (Prosem)": Calendar,
    "ATP Editor": Pencil,
    "AI Modul Ajar": BookOpen,
    "AI RPP": FileText,
    "AI LKPD": FileText,
    "AI Bahan Ajar": BookOpen,
    "Persetujuan RPP (Kepsek)": CheckCircle,
    "Dasbor Eksekutif (Kepsek)": LayoutDashboard,
    "Buat Soal AI": Sparkles,
    "Monitoring": BarChart3,
    "Jurnal Mengajar": BookOpen,
    "Kalender Akademik": Calendar,
    "Supervisi & Analitik": BarChart3,
    "Tugas Harian": CheckSquare,
    "Pengingat": Bell,
    "AI": Bot,
    "Chat AI": MessageCircle,
    "AI Performance Report": BarChart3,
    "Deep Learning": Brain,
    "Buku Nilai": BookOpen,
    "Laporan": FileBarChart,
    "Raport": ClipboardList,
    "Laporan Harian": FileText,
    "Laporan Kinerja": FileBarChart,
    "Laporan Mengajar": ClipboardList,
    "Evidence": FolderOpen,
    "Status Raport": ClipboardList,
    "Review Nilai Raport": FileSearch,
    "Layout Raport": LayoutTemplate,
    "Pemetaan Kolom Raport": LayoutTemplate,
    "Pengembangan Diri": Sprout,
    "Daftar Kegiatan": List,
    "Buat Baru": Plus,
    "Sertifikat": Award,
    "Wali Kelas": Users,
    "Dashboard Wali Kelas": Users,
    "Daftar Siswa": User,
    "Catatan Wali Kelas": BookOpen,
    "Laporan Wali Kelas": FileBarChart,
    "Pembina Eskul": Trophy,
    "Dashboard Pembina": Trophy,
    "Penilaian": Star,
    "Daftar Kegiatan Eskul": List,
    "Laporan Eskul": FileBarChart,
    "Institusi": Building2,
    "Overview Institusi": LayoutDashboard,
    "Manajemen Institusi": Building2,
    "Anggota Institusi": Users,
    "Approval / Persetujuan": CheckCircle,
    "Langganan & Billing": CreditCard,
    "Pengaturan Institusi": Settings,
    "Komunitas Guru": MessageCircle,
    "Keuangan": Wallet,
    "Pemasukan": TrendingUp,
    "Pengeluaran": TrendingDown,
    "Laporan Keuangan": FileBarChart,
    "Brankas": Archive,
    "Pengaturan": Settings,
    "Billing": CreditCard,
    "Perpustakaan": BookOpen,
  };
  return map[label] || null;
}
