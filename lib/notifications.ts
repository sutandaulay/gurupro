import nodemailer from "nodemailer";
import { query } from "@/lib/db";
import { getEmailSenderConfig, getWASenderConfig, getNotificationTemplates } from "./settings";
import { sendInAppNotification } from "@/lib/institution-members";

/**
 * Send actual email notification using dynamic settings from database.
 * Falls back to console.log if configuration is not active.
 */
export async function sendEmailNotification(to: string, subject: string, htmlContent: string) {
  try {
    const config = await getEmailSenderConfig();
    
    if (!config.active || config.provider !== "smtp") {
      console.log(`
=========================================
[EMAIL SIMULATOR (INACTIVE OR NONE)] to: ${to}
Subject: ${subject}
-----------------------------------------
${htmlContent.replace(/<[^>]*>/g, " ").substring(0, 300)}...
=========================================
`);
      return { success: true, simulated: true };
    }

    const { host, port, secure, user, pass } = config.smtp;
    
    // Create transport dynamically
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: !!secure,
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: `"${config.sender_name}" <${config.sender_email}>`,
      to,
      subject,
      html: htmlContent
    });

    console.log(`[EMAIL SENT VIA SMTP] MessageId: ${info.messageId} to: ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("Failed to send email notification:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send actual WhatsApp notification using Fonnte or RuangWA.
 * Falls back to console.log if configuration is not active.
 */
export async function sendWhatsAppNotification(to: string, message: string) {
  try {
    const config = await getWASenderConfig();
    const cleanNumber = to.replace(/[^0-9]/g, "");
    
    // Ensure Indonesian prefix format
    let targetPhone = cleanNumber;
    if (targetPhone.startsWith("0")) {
      targetPhone = "62" + targetPhone.substring(1);
    } else if (!targetPhone.startsWith("62")) {
      targetPhone = "62" + targetPhone;
    }

    if (!config.active || config.provider === "none") {
      console.log(`
=========================================
[WHATSAPP SIMULATOR (INACTIVE OR NONE)] to: +${targetPhone}
-----------------------------------------
${message}
=========================================
`);
      return { success: true, simulated: true };
    }

    if (config.provider === "fonnte") {
      const token = config.fonnte.token;
      if (!token) throw new Error("Fonnte API Token is not configured");

      const response = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          "Authorization": token
        },
        body: new URLSearchParams({
          target: targetPhone,
          message: message
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.status) {
        throw new Error(resData.reason || "Fonnte API responded with failure");
      }

      console.log(`[WHATSAPP SENT VIA FONNTE] to: +${targetPhone}`);
      return { success: true, info: resData };
    } else if (config.provider === "ruangwa") {
      const token = config.ruangwa.token;
      if (!token) throw new Error("RuangWA Token is not configured");

      const response = await fetch("https://api.ruangwa.co/send/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          token: token,
          number: targetPhone,
          message: message
        })
      });

      const resData = await response.json();
      if (!response.ok || resData.result !== "success") {
        throw new Error(resData.message || "RuangWA API responded with failure");
      }

      console.log(`[WHATSAPP SENT VIA RUANGWA] to: +${targetPhone}`);
      return { success: true, info: resData };
    }

    throw new Error(`Unsupported WhatsApp provider: ${config.provider}`);
  } catch (error: any) {
    console.error("Failed to send WhatsApp notification:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Interpolates variables inside a template string
 */
export function interpolate(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{${key}}`, "g");
    const valString = value !== undefined && value !== null ? String(value) : "";
    result = result.replace(placeholder, valString);
  }
  return result;
}

/**
 * Sprint 1.1 — Personalisasi tone notifikasi.
 * Murni memodifikasi teks (awalan sapaan) sesuai preferensi guru,
 * TIDAK mengubah logika pengiriman notifikasi.
 * tone: 'hangat' | 'formal' | 'santai'
 */
function applyTone(tone: string | undefined, text: string): string {
  const clean = (text || "").trim();
  if (!clean) return clean;

  const t = tone === "formal" || tone === "santai" ? tone : "hangat";
  const nama = "";

  // Jangan double-prefix jika sudah ada sapaan
  const sudahAdaSapaan = /^(yth\.?|halo|hai|dear|selamat|hi\b|hello\b)/i.test(clean);

  if (sudahAdaSapaan) return clean;

  switch (t) {
    case "formal":
      return `Yth. Bapak/Ibu ${nama}${nama ? " " : ""}${clean.charAt(0).toLowerCase() + clean.slice(1)}`;
    case "santai":
      return `Hai ${nama}${nama ? " " : ""}${clean.charAt(0).toLowerCase() + clean.slice(1)}`;
    case "hangat":
    default:
      return `Halo ${nama}${nama ? " " : ""}${clean.charAt(0).toLowerCase() + clean.slice(1)}`;
  }
}

/**
 * General purpose notification dispatcher for predefined system events
 */
export async function sendEventNotification(
  event: "register" | "forgot_password" | "payout_approved" | "payout_rejected" | "payment_success" | "refund",
  user: { email: string; whatsapp: string; nama_lengkap: string },
  variables: Record<string, any>
) {
  try {
    const templates = await getNotificationTemplates();
    const template = templates[event];
    if (!template) {
      console.warn(`No notification template found for event: ${event}`);
      return;
    }

    const mergeVars = {
      nama_lengkap: user.nama_lengkap,
      email: user.email,
      whatsapp: user.whatsapp,
      ...variables
    };

    // Sprint 1.1 — baca preferensi tone (opsional, default hangat)
    const tone = (variables.tone as string | undefined) || "hangat";

    const jobs: Promise<any>[] = [];

    if (template.email_enabled && user.email) {
      const subject = interpolate(template.email_subject, mergeVars);
      const htmlBody = interpolate(template.email_body, mergeVars);
      jobs.push(sendEmailNotification(user.email, applyTone(tone, subject), htmlBody));
    }

    if (template.wa_enabled && user.whatsapp) {
      const waMsg = interpolate(template.wa_message, mergeVars);
      jobs.push(sendWhatsAppNotification(user.whatsapp, applyTone(tone, waMsg)));
    }

    const results = await Promise.allSettled(jobs);
    results.forEach((result) => {
      if (result.status === "rejected") {
        console.error(`Notification send failed for event ${event}:`, result.reason);
      }
    });

    return results;
  } catch (error) {
    console.error(`Error dispatching event notification ${event}:`, error);
  }
}

export interface TeachingReportNotificationParams {
  guruId: string;
  guruNama: string;
  institutionId: number;
  kelas: string;
  mapel: string;
  tanggal: string;
  kehadiran: string;
  reportUrl: string;
}

export async function sendTeachingReportNotification(params: TeachingReportNotificationParams): Promise<void> {
  const { guruId, guruNama, institutionId, kelas, mapel, tanggal, kehadiran, reportUrl } = params;

  try {
    // Query kepala_sekolah and wakasek from this institution
    const leaders = await query(
      `SELECT u.id, u.email, u.whatsapp, u.nama_lengkap, imr.value as role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       JOIN users u ON u.id = im.user_id
       WHERE im.institution_id = $1
         AND im.status = 'active'
         AND imr.value IN ('kepala_sekolah', 'wakasek')
       ORDER BY imr.value = 'kepala_sekolah' DESC`,
      [institutionId]
    );

    if (leaders.rows.length === 0) return;

    const templates = await getNotificationTemplates();
    const template = templates.teaching_report_completed;

    const mergeVars = {
      guru_nama: guruNama,
      kepala_nama: "", // filled per recipient below
      tanggal,
      kelas,
      mapel,
      kehadiran,
      report_url: reportUrl,
    };

    for (const leader of leaders.rows) {
      const vars = {
        ...mergeVars,
        kepala_nama: leader.nama_lengkap || "Bapak/Ibu",
      };

      const jobs: Promise<any>[] = [];

      if (template.wa_enabled && leader.whatsapp) {
        const waMsg = interpolate(template.wa_message, vars);
        jobs.push(sendWhatsAppNotification(leader.whatsapp, waMsg));
      }

      if (template.email_enabled && leader.email) {
        const subject = interpolate(template.email_subject, vars);
        const htmlBody = interpolate(template.email_body, vars);
        jobs.push(sendEmailNotification(leader.email, subject, htmlBody));
      }

      // Always send in-app notification
      const inAppTitle = "📋 Laporan Mengajar Baru";
      const inAppBody = `Guru ${guruNama} telah menyelesaikan administrasi mengajar ${mapel} kelas ${kelas} pada ${tanggal}.`;
      jobs.push(sendInAppNotification(leader.id, inAppTitle, inAppBody, "teaching_report", "laporan_mengajar", guruId));

      await Promise.allSettled(jobs);
    }
  } catch (error) {
    console.error("[sendTeachingReportNotification] Error:", error);
  }
}
