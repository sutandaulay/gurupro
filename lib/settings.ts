import { query } from "./db";

export async function getSystemSetting<T = any>(key: string): Promise<T | null> {
  try {
    const res = await query("SELECT value FROM system_settings WHERE key = $1", [key]);
    if (res.rows.length > 0) {
      return res.rows[0].value as T;
    }
    return null;
  } catch (error) {
    console.error(`Error getting system setting ${key}:`, error);
    return null;
  }
}

export async function getAllSystemSettings(): Promise<Record<string, any>> {
  try {
    const res = await query("SELECT key, value FROM system_settings");
    const map: Record<string, any> = {};
    for (const row of res.rows) {
      map[row.key] = row.value;
    }
    return map;
  } catch (error) {
    console.error("Error getting all system settings:", error);
    return {};
  }
}

export async function updateSystemSetting(key: string, value: any): Promise<boolean> {
  try {
    await query(
      `INSERT INTO system_settings (key, value, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) 
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
    return true;
  } catch (error) {
    console.error(`Error updating system setting ${key}:`, error);
    return false;
  }
}

export interface PaymentGatewayConfig {
  default_gateway: "xendit" | "midtrans" | "duitku" | "mock";
  xendit: {
    api_key: string;
    verification_token: string;
    is_sandbox: boolean;
  };
  midtrans: {
    merchant_id: string;
    client_key: string;
    server_key: string;
    is_sandbox: boolean;
  };
  duitku: {
    merchant_code: string;
    api_key: string;
    is_sandbox: boolean;
  };
}

export interface EmailSenderConfig {
  provider: "smtp" | "none";
  active: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  sender_name: string;
  sender_email: string;
}

export interface WASenderConfig {
  provider: "fonnte" | "ruangwa" | "none";
  active: boolean;
  fonnte: {
    token: string;
    sender_number: string;
  };
  ruangwa: {
    token: string;
    sender_number: string;
  };
}

export interface NotificationTemplate {
  email_enabled: boolean;
  wa_enabled: boolean;
  email_subject: string;
  email_body: string;
  wa_message: string;
}

export interface NotificationTemplates {
  register: NotificationTemplate;
  forgot_password: NotificationTemplate;
  payout_approved: NotificationTemplate;
  payout_rejected: NotificationTemplate;
  payment_success: NotificationTemplate;
  refund: NotificationTemplate;
  teaching_report_completed: NotificationTemplate;
}

export async function getPaymentGatewayConfig(): Promise<PaymentGatewayConfig> {
  const defaults: PaymentGatewayConfig = {
    default_gateway: "mock",
    xendit: { api_key: "", verification_token: "", is_sandbox: true },
    midtrans: { merchant_id: "", client_key: "", server_key: "", is_sandbox: true },
    duitku: { merchant_code: "", api_key: "", is_sandbox: true }
  };
  const val = await getSystemSetting<PaymentGatewayConfig>("payment_gateway");
  return val ? { ...defaults, ...val } : defaults;
}

export async function getEmailSenderConfig(): Promise<EmailSenderConfig> {
  const defaults: EmailSenderConfig = {
    provider: "none",
    active: false,
    smtp: { host: "smtp.mailtrap.io", port: 2525, secure: false, user: "", pass: "" },
    sender_name: "GuruPRO Support",
    sender_email: "no-reply@gurupro.id"
  };
  const val = await getSystemSetting<EmailSenderConfig>("email_sender");
  return val ? { ...defaults, ...val } : defaults;
}

export async function getWASenderConfig(): Promise<WASenderConfig> {
  const defaults: WASenderConfig = {
    provider: "none",
    active: false,
    fonnte: { token: "", sender_number: "" },
    ruangwa: { token: "", sender_number: "" }
  };
  const val = await getSystemSetting<WASenderConfig>("wa_sender");
  return val ? { ...defaults, ...val } : defaults;
}

export async function getNotificationTemplates(): Promise<NotificationTemplates> {
  const defaults: NotificationTemplates = {
    register: {
      email_enabled: true,
      wa_enabled: true,
      email_subject: "Selamat Datang di GuruPRO!",
      email_body: "",
      wa_message: ""
    },
    forgot_password: {
      email_enabled: true,
      wa_enabled: true,
      email_subject: "Kode OTP Masuk GuruPRO",
      email_body: "",
      wa_message: ""
    },
    payout_approved: {
      email_enabled: true,
      wa_enabled: true,
      email_subject: "Pencairan Cashback GuruPRO Berhasil!",
      email_body: "",
      wa_message: ""
    },
    payout_rejected: {
      email_enabled: true,
      wa_enabled: true,
      email_subject: "Pencairan Cashback GuruPRO Ditolak",
      email_body: "",
      wa_message: ""
    },
    payment_success: {
      email_enabled: true,
      wa_enabled: true,
      email_subject: "Pembayaran Langganan GuruPRO Berhasil",
      email_body: "",
      wa_message: ""
    },
    teaching_report_completed: {
      email_enabled: true,
      wa_enabled: true,
      email_subject: "Laporan Mengajar Baru - {guru_nama}",
      email_body: "",
      wa_message: ""
    }
  };
  const val = await getSystemSetting<NotificationTemplates>("notification_templates");
  return val ? { ...defaults, ...val } : defaults;
}

export interface AIConfig {
  default_vendor: "gemini" | "openai" | "claude" | "deepseek" | "mock";
  gemini: {
    api_key: string;
    model_name: string;
  };
  openai: {
    api_key: string;
    model_name: string;
  };
  claude: {
    api_key: string;
    model_name: string;
  };
  deepseek: {
    api_key: string;
    model_name: string;
  };
}

export async function getAIConfig(): Promise<AIConfig> {
  const defaults: AIConfig = {
    default_vendor: "mock",
    gemini: { api_key: "", model_name: "gemini-2.5-flash" },
    openai: { api_key: "", model_name: "gpt-4o-mini" },
    claude: { api_key: "", model_name: "claude-3-5-sonnet-20241022" },
    deepseek: { api_key: "", model_name: "deepseek-chat" }
  };
  const val = await getSystemSetting<AIConfig>("ai_config");
  return val ? { ...defaults, ...val } : defaults;
}

export interface PricingPlanItem {
  id: string;
  package_name: string;
  price: number;
  tokens: number;
  duration_days: number;
  features: string[];
  popular: boolean;
  is_active: boolean;
  sort_order: number;
}

export async function getActivePricingPlans(): Promise<PricingPlanItem[]> {
  try {
    const res = await query(
      "SELECT * FROM pricing_plans WHERE is_active = true ORDER BY sort_order ASC"
    );
    if (res.rows.length === 0) return [];
    return res.rows.map((row: any) => ({
      id: row.id,
      package_name: row.package_name,
      price: typeof row.price === "string" ? parseFloat(row.price) : Number(row.price),
      tokens: typeof row.tokens === "string" ? parseInt(row.tokens) || 0 : row.tokens || 0,
      duration_days: row.duration_days,
      features: typeof row.features === "string" ? JSON.parse(row.features) : row.features || [],
      popular: row.popular || false,
      is_active: row.is_active !== false,
      sort_order: row.sort_order || 0,
    }));
  } catch (e) {
    console.error("getActivePricingPlans error:", e);
    return [];
  }
}

export interface AppBrandingConfig {
  app_name: string;
  app_logo: string;
  accent_color: string;
  contact_email: string;
  contact_whatsapp: string;
}

export async function getAppBrandingConfig(): Promise<AppBrandingConfig> {
  const defaults: AppBrandingConfig = {
    app_name: "GuruPRO",
    app_logo: "",
    accent_color: "#4f46e5",
    contact_email: "support@gurupro.id",
    contact_whatsapp: ""
  };
  const val = await getSystemSetting<AppBrandingConfig>("app_branding");
  return val ? { ...defaults, ...val } : defaults;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ReferralBenefit {
  icon: string;
  title: string;
  description: string;
}

export interface ReferralConfig {
  badge: string;
  title: string;
  description: string;
  benefits: ReferralBenefit[];
  ctaText: string;
  ctaLink: string;
}

export async function getFaqConfig(): Promise<FaqItem[]> {
  const defaults: FaqItem[] = [
    {
      question: "Bagaimana cara kerja perhitungan Poin kuota?",
      answer: "Setiap kali Anda menekan tombol generate paket butir soal baru, sistem akan memotong 1 Poin dari sisa batas limit poin Anda. Poin ini akan otomatis diperbarui setiap masa tagihan bulanan berjalan.",
    },
    {
      question: "Apakah metode pembayaran mendukung e-Wallet lokal?",
      answer: "Ya! Pembayaran SaaS GuruPRO sangat fleksibel terintegrasi menggunakan QRIS, GoPay, OVO, Dana, serta transfer Virtual Account bank terkemuka di Indonesia.",
    },
  ];
  const val = await getSystemSetting<FaqItem[]>("faq_config");
  if (val && Array.isArray(val) && val.length > 0) return val;
  return defaults;
}

export async function getReferralConfig(): Promise<ReferralConfig> {
  const defaults: ReferralConfig = {
    badge: "🎁 Program Kemitraan Guru",
    title: "Bagikan GuruPro, Dapatkan Cashback & Poin!",
    description: "Dapatkan cashback senilai Rp10.000 tunai dan +20 Poin kuota untuk setiap guru yang mendaftar dan berlangganan menggunakan kode referral unik Anda! Teman Anda juga akan mendapatkan bonus +10 Poin saat mendaftar.",
    benefits: [
      {
        icon: "💰",
        title: "Cashback Saldo Dompet",
        description: "Saldo cashback sebesar Rp10.000 ditambahkan ke dompet akun Anda setiap kali teman Anda meng-upgrade status akun menjadi PRO. Saldo ini dapat dicairkan langsung ke rekening bank.",
      },
      {
        icon: "⚡",
        title: "Poin Kuota Tambahan",
        description: "Dapatkan +20 Poin kuota ekstra gratis untuk generator soal Anda, sementara teman Anda mendapatkan +10 Poin kuota tambahan saat mendaftar!",
      },
    ],
    ctaText: "Mulai Undang Teman",
    ctaLink: "",
  };
  const val = await getSystemSetting<ReferralConfig>("referral_config");
  return val ? { ...defaults, ...val, benefits: val.benefits || defaults.benefits } : defaults;
}

// --- Defaults & resolve helpers (for batch query) ---

const defaultPaymentGateway: PaymentGatewayConfig = {
  default_gateway: "mock",
  xendit: { api_key: "", verification_token: "", is_sandbox: true },
  midtrans: { merchant_id: "", client_key: "", server_key: "", is_sandbox: true },
  duitku: { merchant_code: "", api_key: "", is_sandbox: true }
};

const defaultEmailSender: EmailSenderConfig = {
  provider: "none",
  active: false,
  smtp: { host: "smtp.mailtrap.io", port: 2525, secure: false, user: "", pass: "" },
  sender_name: "GuruPRO Support",
  sender_email: "no-reply@gurupro.id"
};

const defaultWASender: WASenderConfig = {
  provider: "none",
  active: false,
  fonnte: { token: "", sender_number: "" },
  ruangwa: { token: "", sender_number: "" }
};

const defaultNotificationTemplates: NotificationTemplates = {
  register: { email_enabled: true, wa_enabled: true, email_subject: "Selamat Datang di GuruPRO!", email_body: "", wa_message: "" },
  forgot_password: { email_enabled: true, wa_enabled: true, email_subject: "Kode OTP Masuk GuruPRO", email_body: "", wa_message: "" },
  payout_approved: { email_enabled: true, wa_enabled: true, email_subject: "Pencairan Cashback GuruPRO Berhasil!", email_body: "", wa_message: "" },
  payout_rejected: { email_enabled: true, wa_enabled: true, email_subject: "Pencairan Cashback GuruPRO Ditolak", email_body: "", wa_message: "" },
  payment_success: { email_enabled: true, wa_enabled: true, email_subject: "Pembayaran Langganan GuruPRO Berhasil", email_body: "", wa_message: "" },
  refund: { email_enabled: true, wa_enabled: true, email_subject: "Refund Pembayaran GuruPRO", email_body: "", wa_message: "" },
  teaching_report_completed: { email_enabled: true, wa_enabled: true, email_subject: "Laporan Mengajar Baru - {guru_nama}", email_body: "", wa_message: "" }
};

const defaultAIConfig: AIConfig = {
  default_vendor: "mock",
  gemini: { api_key: "", model_name: "gemini-2.5-flash" },
  openai: { api_key: "", model_name: "gpt-4o-mini" },
  claude: { api_key: "", model_name: "claude-3-5-sonnet-20241022" },
  deepseek: { api_key: "", model_name: "deepseek-chat" }
};

const defaultBranding: AppBrandingConfig = {
  app_name: "GuruPRO",
  app_logo: "",
  accent_color: "#4f46e5",
  contact_email: "support@gurupro.id",
  contact_whatsapp: ""
};

const defaultFaq: FaqItem[] = [
  { question: "Bagaimana cara kerja perhitungan Poin kuota?", answer: "Setiap kali Anda menekan tombol generate paket butir soal baru, sistem akan memotong 1 Poin dari sisa batas limit poin Anda." },
  { question: "Apakah metode pembayaran mendukung e-Wallet lokal?", answer: "Ya! Pembayaran SaaS GuruPRO sangat fleksibel terintegrasi menggunakan QRIS, GoPay, OVO, Dana, serta transfer Virtual Account bank terkemuka di Indonesia." },
];

const defaultReferral: ReferralConfig = {
  badge: "🎁 Program Kemitraan Guru",
  title: "Bagikan GuruPro, Dapatkan Cashback & Poin!",
  description: "Dapatkan cashback senilai Rp10.000 tunai dan +20 Poin kuota untuk setiap guru yang mendaftar.",
  benefits: [
    { icon: "💰", title: "Cashback Saldo Dompet", description: "Saldo cashback sebesar Rp10.000 ditambahkan ke dompet akun Anda." },
    { icon: "⚡", title: "Poin Kuota Tambahan", description: "Dapatkan +20 Poin kuota ekstra gratis untuk generator soal Anda." },
  ],
  ctaText: "Mulai Undang Teman",
  ctaLink: "",
};

function readSetting<T>(map: Record<string, any>, key: string, defaults: T): T {
  const raw = map[key];
  if (raw === undefined || raw === null) return defaults;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function resolvePaymentGatewayConfig(cache: Record<string, any>): PaymentGatewayConfig {
  return readSetting(cache, "payment_gateway", defaultPaymentGateway);
}

export function resolveEmailSenderConfig(cache: Record<string, any>): EmailSenderConfig {
  return readSetting(cache, "email_sender", defaultEmailSender);
}

export function resolveWASenderConfig(cache: Record<string, any>): WASenderConfig {
  return readSetting(cache, "wa_sender", defaultWASender);
}

export function resolveNotificationTemplates(cache: Record<string, any>): NotificationTemplates {
  return readSetting(cache, "notification_templates", defaultNotificationTemplates);
}

export function resolveAIConfig(cache: Record<string, any>): AIConfig {
  return readSetting(cache, "ai_config", defaultAIConfig);
}

export function resolveAppBrandingConfig(cache: Record<string, any>): AppBrandingConfig {
  return readSetting(cache, "app_branding", defaultBranding);
}

export function resolveFaqConfig(cache: Record<string, any>): FaqItem[] {
  const raw = cache["faq_config"];
  if (!raw) return defaultFaq;
  try {
    const val = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(val) && val.length > 0) return val;
    return defaultFaq;
  } catch {
    return defaultFaq;
  }
}

export function resolveReferralConfig(cache: Record<string, any>): ReferralConfig {
  return readSetting(cache, "referral_config", defaultReferral);
}

