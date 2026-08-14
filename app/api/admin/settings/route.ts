import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAllSystemSettings,
  resolvePaymentGatewayConfig,
  resolveEmailSenderConfig,
  resolveWASenderConfig,
  resolveNotificationTemplates,
  resolveAIConfig,
  resolveAppBrandingConfig,
  resolveFaqConfig,
  resolveReferralConfig,
  updateSystemSetting,
  getSystemSetting
} from "@/lib/settings";
import { sendEmailNotification, sendWhatsAppNotification } from "@/lib/notifications";
import { generateAIContent } from "@/lib/ai";
import { getActivePricingPlans } from "@/lib/settings";
import { updateTokensPerPoinRatio, getTokensPerPoin } from "@/src/config/ratio-cache";
import { parseSessionCookie } from "@/lib/session-sign";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function GET() {
  try {
    await verifyAdmin();

    // Batch query: 1 round-trip instead of 9
    const allSettings = await getAllSystemSettings();
    const paymentGateway = resolvePaymentGatewayConfig(allSettings);
    const emailSender = resolveEmailSenderConfig(allSettings);
    const waSender = resolveWASenderConfig(allSettings);
    const templates = resolveNotificationTemplates(allSettings);
    const aiConfig = resolveAIConfig(allSettings);
    const pricingConfig = await getActivePricingPlans();
    const appBranding = resolveAppBrandingConfig(allSettings);
    const faqConfig = resolveFaqConfig(allSettings);
    const referralConfig = resolveReferralConfig(allSettings);
    const privacy_policy = allSettings["privacy_policy"] ? (typeof allSettings["privacy_policy"] === "string" ? JSON.parse(allSettings["privacy_policy"]) : allSettings["privacy_policy"]) : null;
    const terms_conditions = allSettings["terms_conditions"] ? (typeof allSettings["terms_conditions"] === "string" ? JSON.parse(allSettings["terms_conditions"]) : allSettings["terms_conditions"]) : null;
    const refund_policy = allSettings["refund_policy"] ? (typeof allSettings["refund_policy"] === "string" ? JSON.parse(allSettings["refund_policy"]) : allSettings["refund_policy"]) : null;

    // Ambil rasio Poin saat ini (dari cache/DB)
    const tokensPerPoin = await getTokensPerPoin();

    return NextResponse.json({
      paymentGateway,
      emailSender,
      waSender,
      templates,
      aiConfig,
      pricingConfig,
      appBranding,
      faqConfig,
      referralConfig,
      privacy_policy,
      terms_conditions,
      refund_policy,
      tokensPerPoin,
    });
  } catch (error: any) {
    console.error("GET Admin Settings error:", error);
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyAdmin();
    const adminUserId = session.id;
    const body = await req.json();
    const { action, data } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    // ── Rasio Token per Poin (items 2 & 3) ──────────────────────────────
    if (action === "update_tokens_per_poin") {
      const newRatio = Number(data?.ratio);
      if (!Number.isFinite(newRatio) || newRatio <= 0) {
        return NextResponse.json({ error: "Rasio harus angka positif lebih dari 0" }, { status: 400 });
      }
      try {
        const result = await updateTokensPerPoinRatio(adminUserId, newRatio, data?.note);
        return NextResponse.json({
          success: true,
          message: `Rasio berhasil diubah dari ${result.oldRatio} ke ${result.newRatio}`,
          oldRatio: result.oldRatio,
          newRatio: result.newRatio,
        });
      } catch (updateErr: any) {
        console.error("[Admin Settings] update_tokens_per_poin failed:", updateErr);
        return NextResponse.json({ error: updateErr.message || "Gagal update rasio" }, { status: 500 });
      }
    }

    // ── Existing actions ───────────────────────────────────────────────
    if (action === "update_payment_gateway") {
      const success = await updateSystemSetting("payment_gateway", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Pengaturan Payment Gateway berhasil diperbarui!" });
    }

    if (action === "update_email_sender") {
      const success = await updateSystemSetting("email_sender", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Pengaturan Email Sender berhasil diperbarui!" });
    }

    if (action === "update_wa_sender") {
      const success = await updateSystemSetting("wa_sender", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Pengaturan WhatsApp Sender berhasil diperbarui!" });
    }

    if (action === "update_templates") {
      const success = await updateSystemSetting("notification_templates", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Template Notifikasi berhasil diperbarui!" });
    }

    if (action === "update_ai_config") {
      const success = await updateSystemSetting("ai_config", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Pengaturan Vendor AI berhasil diperbarui!" });
    }

    if (action === "update_app_branding") {
      const success = await updateSystemSetting("app_branding", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Pengaturan Branding Aplikasi berhasil diperbarui!" });
    }

    if (action === "update_faq_config") {
      const success = await updateSystemSetting("faq_config", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "FAQ berhasil diperbarui!" });
    }

    if (action === "update_referral_config") {
      const success = await updateSystemSetting("referral_config", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Pengaturan Program Referral berhasil diperbarui!" });
    }

    if (action === "update_privacy_policy") {
      const success = await updateSystemSetting("privacy_policy", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Kebijakan Privasi berhasil diperbarui!" });
    }

    if (action === "update_terms_conditions") {
      const success = await updateSystemSetting("terms_conditions", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Syarat & Ketentuan berhasil diperbarui!" });
    }

    if (action === "update_refund_policy") {
      const success = await updateSystemSetting("refund_policy", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Kebijakan Refund berhasil diperbarui!" });
    }

    if (action === "test_email") {
      const { to, subject, body: emailBody } = data;
      if (!to) {
        return NextResponse.json({ error: "Email tujuan wajib diisi!" }, { status: 400 });
      }
      
      const result = await sendEmailNotification(
        to, 
        subject || "Uji Coba Pengiriman Email GuruPRO", 
        emailBody || "<div style='font-family:sans-serif;padding:20px;'><h2 style='color:#4f46e5;'>Uji Coba Berhasil!</h2><p>Ini adalah email uji coba dari halaman konfigurasi sistem GuruPRO.</p></div>"
      );

      if (result.success) {
        return NextResponse.json({ 
          success: true, 
          message: result.simulated 
            ? "Simulasi pengiriman berhasil! (Pengirim tidak aktif/none, pesan dicetak ke log server)"
            : "Email uji coba berhasil dikirim!" 
        });
      } else {
        return NextResponse.json({ error: result.error || "Gagal mengirim email" }, { status: 500 });
      }
    }

    if (action === "test_wa") {
      const { to, message } = data;
      if (!to) {
        return NextResponse.json({ error: "Nomor WhatsApp tujuan wajib diisi!" }, { status: 400 });
      }

      const result = await sendWhatsAppNotification(
        to,
        message || "Uji coba pengiriman pesan WhatsApp dari dashboard admin GuruPRO. Koneksi terhubung dengan sukses!"
      );

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: result.simulated
            ? "Simulasi pengiriman berhasil! (Pengirim tidak aktif/none, pesan dicetak ke log server)"
            : "WhatsApp uji coba berhasil dikirim!"
        });
      } else {
        return NextResponse.json({ error: result.error || "Gagal mengirim WhatsApp" }, { status: 500 });
      }
    }

    if (action === "test_ai") {
      try {
        const reply = await generateAIContent(
          "Katakan 'Koneksi API AI Anda Sukses Terhubung!' dalam Bahasa Indonesia secara singkat dan ramah.",
          undefined,
          false
        );
        return NextResponse.json({ success: true, message: `Tes AI Sukses! Balasan: "${reply}"` });
      } catch (err: any) {
        return NextResponse.json({ error: `Gagal memanggil API AI: ${err.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST Admin Settings error:", error);
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
