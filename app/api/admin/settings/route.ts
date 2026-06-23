import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { 
  getPaymentGatewayConfig, 
  getEmailSenderConfig, 
  getWASenderConfig, 
  getNotificationTemplates,
  getAIConfig,
  getPricingConfig,
  getAppBrandingConfig,
  updateSystemSetting
} from "@/lib/settings";
import { sendEmailNotification, sendWhatsAppNotification } from "@/lib/notifications";
import { generateAIContent } from "@/lib/ai";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }
  const session = JSON.parse(sessionCookie);
  if (session.role !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function GET() {
  try {
    await verifyAdmin();

    const paymentGateway = await getPaymentGatewayConfig();
    const emailSender = await getEmailSenderConfig();
    const waSender = await getWASenderConfig();
    const templates = await getNotificationTemplates();
    const aiConfig = await getAIConfig();
    const pricingConfig = await getPricingConfig();
    const appBranding = await getAppBrandingConfig();

    return NextResponse.json({
      paymentGateway,
      emailSender,
      waSender,
      templates,
      aiConfig,
      pricingConfig,
      appBranding
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
    await verifyAdmin();
    const body = await req.json();
    const { action, data } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

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

    if (action === "update_pricing_config") {
      const success = await updateSystemSetting("pricing_config", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Pengaturan Paket Berlangganan & Token berhasil diperbarui!" });
    }

    if (action === "update_app_branding") {
      const success = await updateSystemSetting("app_branding", data);
      if (!success) throw new Error("Database update failed");
      return NextResponse.json({ success: true, message: "Pengaturan Branding Aplikasi berhasil diperbarui!" });
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
