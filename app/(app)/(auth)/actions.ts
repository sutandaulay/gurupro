"use server";

import { redirect } from "next/navigation";
import { performLogin, performRegister } from "@/lib/auth-login";

type AuthResult = {
  error?: string | null;
  requiresOtp?: boolean;
  userId?: string;
  needsSelection?: boolean;
  redirectUrl?: string;
};

export async function handleAuth(
  prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const authMode = formData.get("auth_mode")?.toString() || "login";

  if (authMode === "login") {
    const emailRaw = formData.get("email")?.toString().trim() || "";
    const password = formData.get("password")?.toString() || "";
    const checkoutPlan = formData.get("checkout_plan")?.toString() || "";

    if (!emailRaw || !password) {
      return { error: "Email/Username dan Password wajib diisi!" };
    }

    try {
      const result = await performLogin({ loginId: emailRaw, password, checkoutPlan });
      if (result.error) return result;

      if (result.redirectUrl) {
        redirect(result.redirectUrl);
      }
      return result;
    } catch (err) {
      console.error("handleAuth login error:", err);
      return { error: "Terjadi kesalahan koneksi sistem." };
    }
  }

  // Register flow
  const email = formData.get("email")?.toString().trim() || "";
  const password = formData.get("password")?.toString() || "";
  const confirmPassword = formData.get("confirm_password")?.toString() || "";
  const whatsapp = formData.get("whatsapp")?.toString().trim() || "";
  const namaLengkap = formData.get("nama_lengkap")?.toString().trim() || "Guru Mandiri";
  const username = formData.get("username")?.toString().trim().toLowerCase() || "";
  const pdpConsent = formData.get("pdp_consent")?.toString() === "on";
  const pdpPolicyVersion = formData.get("pdp_policy_version")?.toString() || "1.0";
  const referralCode = formData.get("referral_code")?.toString().trim().toUpperCase() || "";
  const invitationToken = formData.get("invitation_token")?.toString().trim() || "";
  const checkoutPlan = formData.get("checkout_plan")?.toString() || "";

  try {
    const result = await performRegister({
      email, password, confirmPassword, whatsapp,
      namaLengkap, username,
      pdpConsent, pdpPolicyVersion,
      referralCode, invitationToken, checkoutPlan,
    });
    return result;
  } catch (err) {
    console.error("handleAuth register error:", err);
    return { error: "Terjadi kesalahan koneksi sistem." };
  }
}
