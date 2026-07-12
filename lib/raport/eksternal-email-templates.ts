import { LINK_VALIDITY_HOURS } from './kontak-eksternal-repository';

export interface KontakEksternalEmailData {
  kontakNama: string;
  guruMapelNama: string;
  kelasNama: string;
  linkUrl: string;
}

export interface KontakEksternalOtpData {
  kontakNama: string;
  otpCode: string;
}

export function generateKontakEksternalLinkEmail(data: KontakEksternalEmailData) {
  const subject = `Raport Siswa ${data.kelasNama} dari ${data.guruMapelNama} - GuruPRO AI`;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f9fafb;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:32px;text-align:center;">
        <h1 style="color:#ffffff;font-size:24px;font-weight:bold;margin:0;">GuruPRO AI</h1>
        <p style="color:#d1fae5;font-size:14px;margin:8px 0 0 0;">Raport Siswa - Akses Eksternal</p>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#111827;font-size:20px;font-weight:600;margin:0 0 16px 0;">
          Yth. ${data.kontakNama},
        </h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px 0;">
          <strong>${data.guruMapelNama}</strong> telah membagikan data raport
          untuk kelas <strong>${data.kelasNama}</strong> melalui GuruPRO AI.
        </p>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
          Anda dapat melihat data raport, mendownload PDF, dan mengexport Excel
          melalui link di bawah ini:
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${data.linkUrl}" style="display:inline-block;background-color:#059669;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">
            Lihat Data Raport
          </a>
        </div>
        <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0;text-align:center;">
          Link berlaku selama ${LINK_VALIDITY_HOURS} jam demi keamanan data siswa.<br>
          Jika tombol tidak berfungsi, salin link berikut:<br>
          <a href="${data.linkUrl}" style="color:#059669;word-break:break-all;">${data.linkUrl}</a>
        </p>
      </div>
      <div style="background-color:#f9fafb;padding:24px;border-top:1px solid #e5e7eb;">
        <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0 0 12px 0;text-align:center;">
          Email ini dikirim karena <strong>${data.guruMapelNama}</strong> memilih untuk membagikan
          data raport kepada Anda melalui GuruPRO AI.
        </p>
      </div>
    </div>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin:24px 0 0 0;">
      &copy; ${new Date().getFullYear()} GuruPRO AI. Hak cipta dilindungi.
    </p>
  </div>
</body>
</html>`;

  return { subject, html };
}

export function generateKontakEksternalOtpWA(namaKontak: string, otpCode: string): string {
  return `Yth. ${namaKontak},

Kode verifikasi akses raport GuruPRO AI Anda:

*${otpCode}*

Kode ini berlaku 10 menit. Jangan sebarkan kode ini kepada siapa pun.

Terima kasih.`;
}
