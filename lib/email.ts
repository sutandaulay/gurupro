import nodemailer from 'nodemailer';
import { query } from '@/lib/db';

interface EmailSenderConfig {
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

let cachedConfig: EmailSenderConfig | null = null;

async function getEmailConfig(): Promise<EmailSenderConfig | null> {
  if (cachedConfig) return cachedConfig;
  try {
    const result = await query(
      `SELECT value FROM system_settings WHERE key = 'email_sender'`
    );
    if (result.rows.length > 0) {
      cachedConfig = result.rows[0].value as EmailSenderConfig;
      return cachedConfig;
    }
  } catch {
    // system_settings may not exist yet
  }
  return null;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const config = await getEmailConfig();
  if (!config || !config.active) {
    console.warn('Email sender not configured or inactive. Email not sent.');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });

    await transporter.sendMail({
      from: `"${config.sender_name}" <${config.sender_email}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}
