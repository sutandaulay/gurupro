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
  ChevronDown,
  Home,
  School,
  ClipboardList as ClipboardListIcon,
} from "lucide-react";

export type MenuCategory =
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
}

export const categoryThemes: Record<MenuCategory, CategoryTheme> = {
  core: { gradient: ["#8B5CF6", "#6D28D9"] },
  data: { gradient: ["#818CF8", "#4F46E5"] },
  attendance: { gradient: ["#38BDF8", "#0284C7"] },
  admin: { gradient: ["#34D399", "#059669"] },
  monitoring: { gradient: ["#FB923C", "#EA580C"] },
  ai: { gradient: ["#F472B6", "#DB2777"] },
  academic: { gradient: ["#22D3EE", "#0891B2"] },
  raport: { gradient: ["#22D3EE", "#0891B2"] },
  reports: { gradient: ["#A78BFA", "#7C3AED"] },
  growth: { gradient: ["#4ADE80", "#16A34A"] },
  people: { gradient: ["#FB7185", "#E11D48"] },
  achievement: { gradient: ["#FBBF24", "#D97706"] },
  institution: { gradient: ["#94A3B8", "#475569"] },
  finance: { gradient: ["#FCD34D", "#B45309"] },
  settings: { gradient: ["#C084FC", "#9333EA"] },
};

export const iconMap: Record<string, { icon: any; category: MenuCategory }> = {
  "Dasbor": { icon: LayoutDashboard, category: "core" },
  "Master Data": { icon: Database, category: "data" },
  "Presensi": { icon: Clock, category: "attendance" },
  "Presensi Saya": { icon: UserCheck, category: "attendance" },
  "Presensi Mengajar": { icon: Presentation, category: "attendance" },
  "Pengajuan Izin": { icon: FileX, category: "attendance" },
  "Laporan Presensi": { icon: FileSpreadsheet, category: "reports" },
  "Rekap TPG": { icon: FileSpreadsheet, category: "reports" },
  "Administrasi": { icon: FileText, category: "admin" },
  "AI Silabus": { icon: FileText, category: "admin" },
  "Program Tahunan (Prota)": { icon: Calendar, category: "admin" },
  "Program Semester (Prosem)": { icon: Calendar, category: "admin" },
  "ATP Editor": { icon: Pencil, category: "admin" },
  "AI Modul Ajar": { icon: BookOpen, category: "academic" },
  "AI RPP": { icon: FileText, category: "academic" },
  "AI LKPD": { icon: FileText, category: "academic" },
  "AI Bahan Ajar": { icon: BookOpen, category: "academic" },
  "Persetujuan RPP (Kepsek)": { icon: CheckCircle, category: "admin" },
  "Dasbor Eksekutif (Kepsek)": { icon: LayoutDashboard, category: "core" },
  "Buat Soal AI": { icon: Sparkles, category: "ai" },
  "Monitoring": { icon: BarChart3, category: "monitoring" },
  "Jurnal Mengajar": { icon: BookOpen, category: "monitoring" },
  "Kalender Akademik": { icon: Calendar, category: "monitoring" },
  "Supervisi & Analitik": { icon: BarChart3, category: "monitoring" },
  "Tugas Harian": { icon: CheckSquare, category: "core" },
  "Pengingat": { icon: Bell, category: "monitoring" },
  "AI": { icon: Bot, category: "ai" },
  "Chat AI": { icon: MessageCircle, category: "ai" },
  "AI Performance Report": { icon: BarChart3, category: "ai" },
  "Deep Learning": { icon: Brain, category: "ai" },
  "Buku Nilai": { icon: BookOpen, category: "academic" },
  "Laporan": { icon: FileBarChart, category: "reports" },
  "Raport": { icon: ClipboardList, category: "raport" },
  "Laporan Harian & Mengajar": { icon: FileText, category: "reports" },
  "Laporan Kinerja": { icon: FileBarChart, category: "reports" },
  "Evidence": { icon: FolderOpen, category: "reports" },
  "Status Raport": { icon: ClipboardList, category: "raport" },
  "Review Nilai Raport": { icon: FileSearch, category: "raport" },
  "Layout Raport": { icon: LayoutTemplate, category: "raport" },
  "Pemetaan Kolom Raport": { icon: LayoutTemplate, category: "raport" },
  "Pengembangan Diri": { icon: Sprout, category: "growth" },
  "Daftar Kegiatan": { icon: List, category: "growth" },
  "Buat Baru": { icon: Plus, category: "growth" },
  "Sertifikat": { icon: Award, category: "growth" },
  "Wali Kelas": { icon: Users, category: "people" },
  "Dashboard Wali Kelas": { icon: Users, category: "people" },
  "Daftar Siswa": { icon: User, category: "people" },
  "Catatan Wali Kelas": { icon: BookOpen, category: "people" },
  "Laporan Wali Kelas": { icon: FileBarChart, category: "reports" },
  "Pembina Eskul": { icon: Trophy, category: "achievement" },
  "Dashboard Pembina": { icon: Trophy, category: "achievement" },
  "Penilaian": { icon: Star, category: "achievement" },
  "Daftar Kegiatan Eskul": { icon: List, category: "achievement" },
  "Laporan Eskul": { icon: FileBarChart, category: "reports" },
  "Institusi": { icon: Building2, category: "institution" },
  "Overview Institusi": { icon: LayoutDashboard, category: "institution" },
  "Manajemen Institusi": { icon: Building2, category: "institution" },
  "Anggota Institusi": { icon: Users, category: "institution" },
  "Approval / Persetujuan": { icon: CheckCircle, category: "institution" },
  "Langganan & Billing": { icon: CreditCard, category: "institution" },
  "Pengaturan Institusi": { icon: Settings, category: "settings" },
  "Komunitas Guru": { icon: MessageCircle, category: "people" },
  "Keuangan": { icon: Wallet, category: "finance" },
  "Pemasukan": { icon: TrendingUp, category: "finance" },
  "Pengeluaran": { icon: TrendingDown, category: "finance" },
  "Laporan Keuangan": { icon: FileBarChart, category: "reports" },
  "Brankas": { icon: Archive, category: "data" },
  "Pengaturan": { icon: Settings, category: "settings" },
  "Billing": { icon: CreditCard, category: "finance" },
};

export const quickNavCategories: Record<string, MenuCategory> = {
  dashboard: "core",
  presensi: "attendance",
  jurnal: "monitoring",
  nilai: "academic",
};

export function getMenuIcon(label: string) {
  return iconMap[label] || null;
}

export function getMenuCategory(label: string): MenuCategory | null {
  return iconMap[label]?.category || null;
}

export function getGradientForLabel(label: string): [string, string] | null {
  const cat = getMenuCategory(label);
  if (!cat) return null;
  return categoryThemes[cat].gradient;
}
