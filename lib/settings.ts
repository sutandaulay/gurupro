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

export interface PricingPlan {
  price: number;
  tokens: number;
  duration_days: number;
}

export interface PricingConfig {
  free: PricingPlan;
  three_month: PricingPlan;
  six_month: PricingPlan;
  one_year: PricingPlan;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const defaults: PricingConfig = {
    free: { price: 0, tokens: 10, duration_days: 30 },
    three_month: { price: 120000, tokens: 500, duration_days: 90 },
    six_month: { price: 220000, tokens: 1100, duration_days: 180 },
    one_year: { price: 400000, tokens: 2500, duration_days: 365 }
  };
  const val = await getSystemSetting<PricingConfig>("pricing_config");
  if (val && val.free && val.three_month && val.six_month && val.one_year) {
    return val;
  }
  return defaults;
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

