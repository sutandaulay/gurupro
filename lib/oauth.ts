import { signIn } from "next-auth/react";

export const REFERRAL_STORAGE_KEY = "referral_code";
export const CHECKOUT_PLAN_STORAGE_KEY = "checkout_plan";
export const INVITATION_TOKEN_STORAGE_KEY = "pending_invitation_token";
export const INVITATION_SCHOOL_STORAGE_KEY = "pending_invitation_school";

/**
 * Persist OAuth-related context (referral, checkout plan, invitation) into
 * localStorage so it survives the Google redirect, and initiate signIn with a
 * callbackUrl that carries the checkout plan so auth.config can redirect
 * according to the plan after login.
 */
export function signInWithGoogle(
  searchParams: URLSearchParams,
  extra: { invitationSchoolName?: string | null } = {}
) {
  // Persist referral code
  const ref = searchParams.get("ref");
  if (ref) {
    localStorage.setItem(REFERRAL_STORAGE_KEY, ref.toUpperCase());
  }

  // Persist checkout plan
  const checkout = searchParams.get("checkout");
  if (checkout) {
    localStorage.setItem(CHECKOUT_PLAN_STORAGE_KEY, checkout);
  }

  // Persist invitation info
  const token = searchParams.get("token");
  if (token && extra.invitationSchoolName) {
    localStorage.setItem(INVITATION_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(INVITATION_SCHOOL_STORAGE_KEY, extra.invitationSchoolName);
  }

  // Build callbackUrl that carries the checkout plan and referral code so the
  // server (auth.config signIn callback) can process them after authentication
  // and redirect according to the plan.
  const params = new URLSearchParams();
  if (checkout) params.set("checkout", checkout);
  if (ref) params.set("ref", ref.toUpperCase());
  const callbackUrl = `/dashboard${params.toString() ? `?${params.toString()}` : ""}`;

  return signIn("google", { callbackUrl });
}
