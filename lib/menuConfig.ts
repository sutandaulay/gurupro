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

export type SubMenuItem = {
  label: string;
  href: string;
  desc?: string;
  key: string;
  module?: string;
};

export type MenuItem = {
  key: string;
  label: string;
  href?: string;
  module?: string;
  submenu?: SubMenuItem[];
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
  { label: "Overview Institusi", href: "/institusi/ID/dashboard", desc: "Ringkasan data institusi", key: "overview" },
  { label: "Manajemen Guru", href: "/institusi/ID/dashboard/guru", desc: "Kelola guru, undang, dan role", key: "manajemen_guru" },
  { label: "Rekap TPG", href: "/institusi/ID/dashboard/tpg", desc: "Rekap tunjangan profesi guru", key: "rekap_tpg" },
  { label: "Laporan Mengajar", href: "/institusi/ID/dashboard/laporan-mengajar", key: "laporan_mengajar" },
  { label: "Approval / Persetujuan", href: "/institusi/ID/dashboard/approval", key: "approval" },
  { label: "Langganan & Billing", href: "/institusi/ID/dashboard/langganan", key: "langganan" },
  { label: "Pengaturan Institusi", href: "/institusi/ID/dashboard/pengaturan", key: "pengaturan" },
];

export const masterMenus: MenuItem[] = [
  { key: "dasbor", label: "Dasbor", href: "/dashboard" },
  {
    key: "master_data",
    label: "Master Data",
    href: "/dashboard?module=sekolah",
    module: "sekolah",
  },
  {
    key: "presensi",
    label: "Presensi",
    submenu: [
      { key: "presensi_saya", label: "Presensi Saya", href: "/dashboard/attendance" },
      { key: "presensi_mengajar", label: "Presensi Mengajar", href: "/dashboard/attendance/teaching" },
      { key: "pengajuan_izin", label: "Pengajuan Izin", href: "/dashboard/attendance/leave" },
      { key: "laporan_presensi", label: "Laporan Presensi", href: "/dashboard/reports/attendance" },
      { key: "rekap_tpg", label: "Rekap TPG", href: "/dashboard/reports/tpg" },
    ],
  },
  {
    key: "ai_administrasi",
    label: "AI Administrasi",
    submenu: [
      { key: "silabus", label: "Silabus", href: "/dashboard/administrasi?tipe=silabus", module: "administrasi" },
      { key: "prota", label: "Program Tahunan (Prota)", href: "/dashboard/prota" },
      { key: "prosem", label: "Program Semester (Prosem)", href: "/dashboard/prosem" },
      { key: "atp_editor", label: "ATP Editor", href: "/dashboard/atp-editor" },
      { key: "modul_ajar", label: "Modul Ajar", href: "/dashboard/administrasi?tipe=modul_ajar", module: "administrasi" },
      { key: "rpp", label: "RPP", href: "/dashboard/administrasi?tipe=rpp", module: "administrasi" },
      { key: "lkpd", label: "LKPD", href: "/dashboard/administrasi?tipe=lkpd", module: "administrasi" },
      { key: "bahan_ajar", label: "Bahan Ajar", href: "/dashboard/administrasi?tipe=bahan_ajar", module: "administrasi" },
      { key: "persetujuan_rpp", label: "Persetujuan RPP (Kepsek)", href: "/dashboard/approval-rpp" },
      { key: "dasbor_eksekutif", label: "Dasbor Eksekutif (Kepsek)", href: "/dashboard/executive-dashboard" },
      { key: "buat_soal", label: "Buat Soal", href: "/dashboard?module=soal", module: "soal" },
    ],
  },
  {
    key: "monitoring",
    label: "Monitoring",
    submenu: [
      { key: "jurnal_mengajar", label: "Jurnal Mengajar", href: "/dashboard?module=jurnal", module: "jurnal" },
      { key: "kalender_akademik", label: "Kalender Akademik", href: "/dashboard?module=kalender", module: "kalender" },
      { key: "supervisi_analitik", label: "Supervisi & Analitik", href: "/dashboard?module=supervisi_analitik", module: "supervisi_analitik" },
      { key: "tugas_harian", label: "Tugas Harian", href: "/dashboard?module=tugas_harian", module: "tugas_harian" },
      { key: "pengingat", label: "Pengingat", href: "/dashboard?module=scheduler", module: "scheduler" },
    ],
  },
  {
    key: "ai",
    label: "AI",
    submenu: [
      { key: "chat_ai", label: "Chat AI", href: "/dashboard/chat" },
      { key: "analisis_kinerja_ai", label: "Analisis Kinerja AI", href: "/dashboard/ai-performance-report" },
      { key: "deep_learning", label: "Deep Learning", href: "/dashboard" },
    ],
  },
  {
    key: "buku_nilai",
    label: "Buku Nilai",
    href: "/dashboard?module=nilai",
    module: "nilai",
  },
  {
    key: "laporan",
    label: "Laporan",
    submenu: [
      { key: "laporan_harian", label: "Laporan Harian & Mengajar", href: "/dashboard/laporan-harian", desc: "Rekap harian resmi + arsip jurnal mengajar" },
      { key: "laporan_kinerja", label: "Laporan Kinerja", href: "/dashboard/laporan-kinerja" },
      { key: "evidence", label: "Evidence", href: "/dashboard/evidence" },
    ],
  },
  {
    key: "raport",
    label: "Raport",
    submenu: [
      { key: "status_raport", label: "Status Raport", href: "/dashboard/raport-status" },
      { key: "review_nilai", label: "Review Nilai Raport", href: "/dashboard/rapor-review" },
      { key: "layout_raport", label: "Layout Raport", href: "/dashboard/layout-raport" },
      { key: "pemetaan_kolom", label: "Pemetaan Kolom Raport", href: "/dashboard/pemetaan-kolom" },
    ],
  },
  {
    key: "pengembangan_diri",
    label: "Pengembangan Diri",
    submenu: [
      { key: "daftar_kegiatan", label: "Daftar Kegiatan", href: "/dashboard/pengembangan-diri" },
      { key: "buat_baru", label: "Buat Baru", href: "/dashboard/pengembangan-diri/tambah" },
      { key: "sertifikat", label: "Sertifikat", href: "/dashboard/pengembangan-diri?tab=documents" },
    ],
  },
  {
    key: "perpustakaan",
    label: "Perpustakaan",
    href: "/dashboard/perpustakaan",
  },
  {
    key: "wali_kelas",
    label: "Wali Kelas",
    submenu: [
      { key: "dashboard", label: "Dashboard Wali Kelas", href: "/dashboard/wali-kelas" },
      { key: "daftar_siswa", label: "Daftar Siswa", href: "/dashboard/wali-kelas?tab=siswa" },
      { key: "catatan", label: "Catatan Wali Kelas", href: "/dashboard/wali-kelas?tab=catatan" },
      { key: "laporan", label: "Laporan Wali Kelas", href: "/dashboard/wali-kelas?tab=laporan" },
    ],
  },
  {
    key: "pembina_ekskul",
    label: "Pembina Eskul",
    submenu: [
      { key: "dashboard", label: "Dashboard Pembina", href: "/dashboard/pembina-ekskul" },
      { key: "daftar", label: "Daftar Kegiatan", href: "/dashboard/pembina-ekskul?tab=daftar" },
      { key: "penilaian", label: "Penilaian", href: "/dashboard/pembina-ekskul?tab=penilaian" },
      { key: "laporan", label: "Laporan", href: "/dashboard/pembina-ekskul?tab=laporan" },
    ],
  },
  {
    key: "institusi",
    label: "Institusi",
    submenu: institutionSubmenus,
  },
  {
    key: "komunitas_guru",
    label: "Komunitas Guru",
    href: "/dashboard/forum",
  },
  {
    key: "keuangan",
    label: "Keuangan",
    href: "/dashboard?module=keuangan",
    module: "keuangan",
  },
  {
    key: "brankas",
    label: "Brankas/Folder",
    href: "/dashboard/brankas",
  },
  {
    key: "pengaturan",
    label: "Pengaturan",
    href: "/profile?tab=pengaturan",
  },
  {
    key: "billing",
    label: "Billing",
    href: "/dashboard/billing",
  },
];

export function isInstitutionHref(href?: string): boolean {
  return !!href && (
    href === "/institusi/ID" ||
    href.startsWith("/institusi/ID/") ||
    href === "/dashboard/institution" ||
    href.startsWith("/dashboard/institution/")
  );
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
  if (href === "/institusi/ID" || href.startsWith("/institusi/ID/")) {
    return href.replace("/institusi/ID", `/institusi/${institutionId}`);
  }
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
    "AI Administrasi": FileText,
    "AI Silabus": FileText,
    "Silabus": FileText,
    "Program Tahunan (Prota)": Calendar,
    "Program Semester (Prosem)": Calendar,
    "ATP Editor": Pencil,
    "AI Modul Ajar": BookOpen,
    "Modul Ajar": BookOpen,
    "AI RPP": FileText,
    "RPP": FileText,
    "AI LKPD": FileText,
    "LKPD": FileText,
    "AI Bahan Ajar": BookOpen,
    "Bahan Ajar": BookOpen,
    "Persetujuan RPP (Kepsek)": CheckCircle,
    "Dasbor Eksekutif (Kepsek)": LayoutDashboard,
    "Buat Soal AI": Sparkles,
    "Buat Soal": Sparkles,
    "Monitoring": BarChart3,
    "Jurnal Mengajar": BookOpen,
    "Kalender Akademik": Calendar,
    "Supervisi & Analitik": BarChart3,
    "Tugas Harian": CheckSquare,
    "Pengingat": Bell,
    "AI": Bot,
    "Chat AI": MessageCircle,
    "AI Performance Report": BarChart3,
    "Analisis Kinerja AI": BarChart3,
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
    "Manajemen Guru": Users,
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

// =============================================================
// Katalog Fitur, Modul Dashboard & Role — single source of truth
// untuk konfigurasi visibilitas menu per role (per institusi).
// =============================================================

/** Modul yang dirender di halaman /dashboard (content.tsx). */
export const DASHBOARD_MODULES: { key: string; label: string; href?: string }[] = [
  { key: "sekolah", label: "Master Data", href: "/dashboard?module=sekolah" },
  { key: "administrasi", label: "AI Administrasi", href: "/dashboard/administrasi" },
  { key: "jurnal", label: "Jurnal Mengajar", href: "/dashboard?module=jurnal" },
  { key: "keuangan", label: "Keuangan", href: "/dashboard?module=keuangan" },
  { key: "nilai", label: "Buku Nilai", href: "/dashboard?module=nilai" },
  { key: "kalender", label: "Kalender Akademik", href: "/dashboard?module=kalender" },
  { key: "supervisi_analitik", label: "Supervisi & Analitik", href: "/dashboard?module=supervisi_analitik" },
  { key: "tugas_harian", label: "Tugas Harian", href: "/dashboard?module=tugas_harian" },
  { key: "storage_saya", label: "Storage Saya", href: "/dashboard?module=storage_saya" },
  { key: "scheduler", label: "Pengingat", href: "/dashboard?module=scheduler" },
  { key: "soal", label: "Buat Soal", href: "/dashboard?module=soal" },
  { key: "profil", label: "Profil", href: "/profile" },
];

/** Role institusi (institution-members). */
export const INSTITUTION_ROLES: { value: string; label: string }[] = [
  { value: "kepala_sekolah", label: "Kepala Sekolah" },
  { value: "wakasek", label: "Wakasek" },
  { value: "operator", label: "Operator" },
  { value: "admin_sekolah", label: "Admin Sekolah" },
  { value: "bendahara", label: "Bendahara" },
  { value: "guru", label: "Guru" },
  { value: "wali_kelas", label: "Wali Kelas" },
  { value: "pembina_ekskul", label: "Pembina Ekskul" },
];

/** Role global aplikasi (users.role). */
export const APP_ROLES: { value: string; label: string }[] = [
  { value: "guru", label: "Guru (Akun)" },
  { value: "admin", label: "Admin Platform" },
  { value: "super_admin", label: "Super Admin" },
  { value: "manager", label: "Manager" },
];

/** Role yang TIDAK pernah dibatasi oleh konfigurasi institusi. */
export const UNRESTRICTED_ROLES = new Set(["admin", "super_admin", "manager"]);

/** Awalan (namespace) feature key. */
export const FEATURE_NS = {
  MENU: "m",
  SUBMENU: "s",
  MODULE: "d",
} as const;

export function menuFeatureKey(key: string): string {
  return `${FEATURE_NS.MENU}:${key}`;
}

export function submenuFeatureKey(parentKey: string, childKey: string): string {
  return `${FEATURE_NS.SUBMENU}:${parentKey}.${childKey}`;
}

export function moduleFeatureKey(moduleKey: string): string {
  return `${FEATURE_NS.MODULE}:${moduleKey}`;
}

/**
 * Feature key sebuah menu/submenu.
 * - Item yang terhubung ke modul dashboard (punya `module`) memakai key modul
 *   supaya satu toggle mengatur baik menu maupun modulnya.
 * - Submenu memakai key namespace `s:<parent>.<child>`.
 */
export function getFeatureKeyForMenu(item: MenuItem): string {
  if (item.module) return moduleFeatureKey(item.module);
  return menuFeatureKey(item.key);
}

export function getFeatureKeyForSubmenu(parentKey: string, sub: SubMenuItem): string {
  if (sub.module) return moduleFeatureKey(sub.module);
  return submenuFeatureKey(parentKey, sub.key);
}

/** Pohon fitur untuk UI administrator (menu → submenu). */
export function buildFeatureTree(): {
  key: string;
  label: string;
  href?: string;
  moduleKey?: string;
  isModuleLinked: boolean;
  children: {
    key: string;
    uid: string;
    label: string;
    href: string;
    moduleKey?: string;
    isModuleLinked: boolean;
  }[];
}[] {
  return masterMenus.map((item) => ({
    key: getFeatureKeyForMenu(item),
    label: item.label,
    href: item.href,
    moduleKey: item.module,
    isModuleLinked: !!item.module,
    children: (item.submenu ?? []).map((sub) => ({
      key: getFeatureKeyForSubmenu(item.key, sub),
      uid: submenuFeatureKey(item.key, sub.key),
      label: sub.label,
      href: sub.href,
      moduleKey: sub.module,
      isModuleLinked: !!sub.module,
    })),
  }));
}

/** Daftar feature key yang bisa disembunyikan (menu, submenu, modul). */
export function getAllFeatureKeys(): string[] {
  const keys: string[] = [];
  for (const item of masterMenus) {
    keys.push(getFeatureKeyForMenu(item));
    for (const sub of item.submenu ?? []) {
      keys.push(getFeatureKeyForSubmenu(item.key, sub));
    }
  }
  for (const mod of DASHBOARD_MODULES) {
    keys.push(moduleFeatureKey(mod.key));
  }
  return Array.from(new Set(keys));
}

// =============================================================
// Pemetaan URL → feature key untuk akses (guard) sisi client.
// Menormalisasi URL sehingga id institusi (angka atau token "ID")
// tidak membedakan rute: /institusi/42/dashboard == /institusi/ID/dashboard
// =============================================================

/** Normalisasi href agar bisa dibandingkan dengan pathname aktif. */
export function normalizeFeatureHref(raw: string): string {
  const [pathPart, qsPart] = raw.split("?");
  let path = (pathPart || "/")
    .replace(/\/institusi\/(ID|\d+)/g, "/institusi/{id}")
    .replace(/\/dashboard\/institution\/(ID|\d+)/g, "/dashboard/institution/{id}")
    .replace(/\/+$/, "");
  if (!path) path = "/";

  let query = "";
  if (qsPart) {
    query = qsPart
      .split("&")
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf("=");
        return i < 0 ? p : `${p.slice(0, i)}=${p.slice(i + 1)}`;
      })
      .sort()
      .join("&");
  }
  return query ? `${path}?${query}` : path;
}

/** Normalisasi lokasi saat ini (pathname + query) untuk dibandingkan. */
export function normalizeCurrentPath(
  pathname: string,
  searchParams: URLSearchParams | null
): string {
  const qs = searchParams ? searchParams.toString() : "";
  return normalizeFeatureHref(qs ? `${pathname}?${qs}` : pathname);
}

/** Kumpulkan rute (URL normal) milik feature yang tersembunyi. */
export function getHiddenFeatureHrefs(hiddenKeys: string[]): Set<string> {
  const out = new Set<string>();
  const hidden = new Set(hiddenKeys);
  for (const group of buildFeatureTree()) {
    if (hidden.has(group.key)) {
      if (group.href) out.add(normalizeFeatureHref(group.href));
      for (const child of group.children) out.add(normalizeFeatureHref(child.href));
    } else {
      for (const child of group.children) {
        if (hidden.has(child.key)) out.add(normalizeFeatureHref(child.href));
      }
    }
  }
  for (const mod of DASHBOARD_MODULES) {
    if (hidden.has(moduleFeatureKey(mod.key)) && mod.href) {
      out.add(normalizeFeatureHref(mod.href));
    }
  }
  return out;
}

/** Feature key sebuah URL (atau null bila bukan rute fitur yang dikonfigurasi). */
export function featureKeyForHref(rawHref: string): string | null {
  const norm = normalizeFeatureHref(rawHref);
  for (const group of buildFeatureTree()) {
    if (group.href && normalizeFeatureHref(group.href) === norm) return group.key;
    for (const child of group.children) {
      if (normalizeFeatureHref(child.href) === norm) return child.key;
    }
  }
  for (const mod of DASHBOARD_MODULES) {
    if (mod.href && normalizeFeatureHref(mod.href) === norm) {
      return moduleFeatureKey(mod.key);
    }
  }
  return null;
}
