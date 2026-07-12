import { OTP_VALIDITY_MINUTES } from "@/collections/config";

export interface ShareLinkEmailData {
  teacherName: string;
  leaderName: string;
  shareUrl: string;
  period: string;
}

export interface OtpEmailData {
  recipientName: string;
  otpCode: string;
  categoryName: string;
  expiresInMinutes: number;
}

export interface ShareLinkEmailHtml {
  subject: string;
  html: string;
}

export interface OtpEmailHtml {
  subject: string;
  html: string;
}

export function generateShareLinkEmail(data: ShareLinkEmailData): ShareLinkEmailHtml {
  const subject = `${data.teacherName} Membagikan Ringkasan Kinerja melalui GuruPRO AI`;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%); padding: 32px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 24px; font-weight: bold; margin: 0;">GuruPRO AI</h1>
        <p style="color: #e9d5ff; font-size: 14px; margin: 8px 0 0 0;">Ringkasan Kinerja Mengajar</p>
      </div>

      <!-- Content -->
      <div style="padding: 32px;">
        <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
          Halo ${data.leaderName},
        </h2>

        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          <strong>${data.teacherName}</strong> telah membagikan ringkasan kinerja mengajar
          melalui GuruPRO AI untuk periode <strong>${data.period}</strong>.
        </p>

        <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
          Anda dapat melihat ringkasan tersebut melalui link di bawah ini:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.shareUrl}" style="display: inline-block; background-color: #7C3AED; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Lihat Ringkasan Kinerja
          </a>
        </div>

        <p style="color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
          Jika tombol di atas tidak berfungsi, salin dan tempelkan link berikut ke browser Anda:<br>
          <a href="${data.shareUrl}" style="color: #7C3AED; word-break: break-all;">${data.shareUrl}</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 24px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0 0 12px 0; text-align: center;">
          Email ini dikirim karena <strong>${data.teacherName}</strong> memilih untuk membagikan
          ringkasan kinerja kepada Anda melalui GuruPRO AI.
        </p>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
          Jika Anda tidak ingin menerima email seperti ini di masa mendatang, silakan:
        </p>
        <p style="text-align: center; margin: 8px 0 0 0;">
          <a href="${data.shareUrl.replace('/leader-view/', '/opt-out?contact=')}" style="color: #ef4444; font-size: 11px; text-decoration: underline;">
            Berhenti menerima link seperti ini
          </a>
        </p>
      </div>
    </div>

    <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 24px 0 0 0;">
      &copy; ${new Date().getFullYear()} GuruPRO AI. Hak cipta dilindungi.
    </p>
  </div>
</body>
</html>
`;

  return { subject, html };
}

export function generateOtpEmail(data: OtpEmailData): OtpEmailHtml {
  const subject = `Kode Verifikasi GuruPRO AI - ${data.categoryName}`;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%); padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 20px; font-weight: bold; margin: 0;">GuruPRO AI</h1>
        <p style="color: #e9d5ff; font-size: 13px; margin: 6px 0 0 0;">Verifikasi Akses Dokumen</p>
      </div>

      <!-- Content -->
      <div style="padding: 32px; text-align: center;">
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          Halo <strong>${data.recipientName}</strong>,
        </p>

        <p style="color: #4b5563; font-size: 14px; margin: 0 0 24px 0;">
          Anda akan mengakses dokumen<br>
          <strong style="color: #7C3AED;">${data.categoryName}</strong>
        </p>

        <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">Masukkan kode verifikasi berikut:</p>
          <p style="color: #111827; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
            ${data.otpCode}
          </p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0 0;">
          Kode ini berlaku selama <strong>${data.expiresInMinutes} menit</strong>.
        </p>

        <div style="margin-top: 24px; padding: 16px; background-color: #fef3c7; border-radius: 8px;">
          <p style="color: #92400e; font-size: 12px; margin: 0;">
            <strong>Perhatian:</strong> Jika Anda tidak merasa meminta kode ini, abaikan email ini.
            Seseorang mungkin mencoba mengakses dokumen Anda secara tidak sah.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
          GuruPRO AI - Platform Kinerja Mengajar Berbasis AI
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  return { subject, html };
}

export function generateOptOutConfirmationEmail(leaderName: string): {
  subject: string;
  html: string;
} {
  const subject = "Konfirmasi Berhenti Menerima - GuruPRO AI";

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%); padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 20px; font-weight: bold; margin: 0;">GuruPRO AI</h1>
      </div>

      <div style="padding: 32px; text-align: center;">
        <div style="width: 64px; height: 64px; background-color: #fef3c7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <svg width="32" height="32" fill="none" stroke="#f59e0b" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
          Berhenti Menerima Link?
        </h2>

        <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
          Apakah Anda yakin ingin berhenti menerima link ringkasan kinerja dari GuruPRO AI?
        </p>

        <p style="color: #6b7280; font-size: 12px; margin: 0 0 24px 0;">
          Anda tidak akan lagi menerima email atau WhatsApp berisi link untuk melihat
          ringkasan kinerja mengajar dari guru yang membagikan kepada Anda.
        </p>

        <p style="color: #6b7280; font-size: 12px; margin: 0 0 24px 0;">
          Catatan: Decision ini hanya berlaku untuk kontak Anda. Guru lain tetap bisa
          membagikan ringkasan kepada Anda dengan kontak lain.
        </p>

        <p style="color: #9ca3af; font-size: 12px;">
          Permintaan opt-out ini diproses secara otomatis.
        </p>
      </div>

      <div style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
          GuruPRO AI - Platform Kinerja Mengajar Berbasis AI
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  return { subject, html };
}
