import type { CollectionConfig } from "payload";
import crypto from "crypto";

const OtpVerifications: CollectionConfig = {
  slug: "otp-verifications",
  labels: {
    singular: "OTP Verification",
    plural: "OTP Verifications",
  },
  admin: {
    useAsTitle: "sentTo",
    group: "Performance Sharing",
    defaultColumns: ["performanceShareLinkId", "channel", "sentTo", "expiresAt", "verifiedAt", "attemptCount"],
  },
  access: {
    read: () => false,
    create: () => true,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "performanceShareLinkId",
      type: "text",
      required: false,
      label: "Share Link",
      admin: {
        description: "ID share link terkait (kosong jika untuk verifikasi akun/reset password)",
      },
    },
    {
      name: "purpose",
      type: "select",
      required: true,
      defaultValue: "document_access",
      label: "Purpose",
      options: [
        { label: "Document Access", value: "document_access" },
        { label: "Account Verification", value: "account_verification" },
        { label: "Password Reset", value: "password_reset" },
      ],
    },
    {
      name: "otpHash",
      type: "text",
      required: true,
      label: "OTP Hash",
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: "channel",
      type: "select",
      required: true,
      label: "Channel",
      options: [
        { label: "WhatsApp", value: "whatsapp" },
        { label: "Email", value: "email" },
      ],
    },
    {
      name: "sentTo",
      type: "text",
      required: true,
      label: "Dikirim Ke",
      admin: {
        description: "Nomor/email yang dikirimi OTP",
      },
    },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      label: "Berlaku Hingga",
      admin: {
        description: "Default 10 menit dari pembuatan",
      },
    },
    {
      name: "verifiedAt",
      type: "date",
      label: "Terverifikasi Pada",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "attemptCount",
      type: "number",
      label: "Jumlah Percobaan",
      defaultValue: 0,
      admin: {
        description: "Max 5 percobaan sebelum OTP invalid",
      },
    },
  ],
  timestamps: true,
};

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export function verifyOtpHash(otp: string, hash: string): boolean {
  const inputHash = hashOtp(otp);
  return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(hash));
}

export default OtpVerifications;
