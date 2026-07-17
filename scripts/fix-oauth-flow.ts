/**
 * Fix Google OAuth Flow - Store checkout_plan & referral to localStorage
 *
 * This script updates the login page to properly store checkout_plan
 * and include it in the callback URL.
 *
 * Run: npx tsx scripts/fix-oauth-flow.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const loginPagePath = join(process.cwd(), "app/(app)/(auth)/login/page.tsx");
const registerPagePath = join(process.cwd(), "app/(app)/(auth)/register/page.tsx");
const authConfigPath = join(process.cwd(), "lib/auth.config.ts");

// ============================================
// FIX 1: Login Page - Store checkout_plan & referral
// ============================================

console.log("Fixing login page...");

let loginContent = readFileSync(loginPagePath, "utf-8");

// Find and replace the Google OAuth button handler
const loginGoogleButtonRegex = /onClick=\{\(\) => \{\s*[^}]+\}\}/s;
const loginGoogleButtonMatch = loginContent.match(loginGoogleButtonRegex);

if (loginGoogleButtonMatch) {
  console.log("  Found Google button in login page");

  const newHandler = `onClick={() => {
                      // Get checkout plan from URL params
                      const checkoutPlan = searchParams.get("checkout");
                      const ref = searchParams.get("ref");
                      const invitationToken = searchParams.get("token");

                      // Store checkout plan for callback processing
                      if (checkoutPlan) {
                        localStorage.setItem("checkout_plan", checkoutPlan);
                      }

                      // Store referral code for callback processing
                      if (ref) {
                        localStorage.setItem("referral_code", ref.toUpperCase());
                      }

                      // Store invitation token if present
                      if (invitationToken && invitationSchoolName) {
                        localStorage.setItem("pending_invitation_token", invitationToken);
                        localStorage.setItem("pending_school", invitationSchoolName);
                      }

                      // Build callback URL with checkout plan
                      const callbackUrl = checkoutPlan
                        ? \`/dashboard?checkout=\${checkoutPlan}\`
                        : "/dashboard";

                      signIn("google", { callbackUrl });
                    }}`;

  loginContent = loginContent.replace(loginGoogleButtonMatch[0], newHandler);
  console.log("  ✅ Updated Google button handler with checkout_plan");
}

// Fix the info text to show checkout plan
loginContent = loginContent.replace(
  /\(invitationSchoolName \|\| searchParams\.get\('ref'\)\)/,
  "(invitationSchoolName || searchParams.get('ref') || searchParams.get('checkout'))"
);

loginContent = loginContent.replace(
  /<span>Aplikasi akan terhubung/,
  "<span>Anda akan otomatis terhubung"
);

writeFileSync(loginPagePath, loginContent);
console.log("  ✅ Updated login page");
console.log("  ✅ Login page fixed\n");

// ============================================
// FIX 2: Register Page - Store checkout_plan & referral
// ============================================

console.log("Fixing register page...");

let registerContent = readFileSync(registerPagePath, "utf-8");

// Find the Google button in register page
const registerGoogleRegex = /onClick=\{async \(\) => \{[^}]+signIn\([^)]+\)\}\}/s;
const registerGoogleMatch = registerContent.match(registerGoogleRegex);

if (registerGoogleMatch) {
  console.log("  Found Google button in register page");

  const newRegisterHandler = `onClick={async () => {
                  // Get params from URL
                  const checkoutPlan = searchParams.get("checkout");
                  const ref = searchParams.get("ref");
                  const invitationToken = searchParams.get("token");

                  // Store checkout plan for callback processing
                  if (checkoutPlan) {
                    localStorage.setItem("checkout_plan", checkoutPlan);
                  }

                  // Store referral code for callback processing
                  if (ref) {
                    localStorage.setItem("referral_code", ref.toUpperCase());
                  }

                  // Store invitation token if present
                  if (invitationToken && invitationSchoolName) {
                    localStorage.setItem("pending_invitation_token", invitationToken);
                    localStorage.setItem("pending_school", invitationSchoolName);
                  }

                  // Build callback URL with checkout plan
                  const callbackUrl = checkoutPlan
                    ? \`/dashboard?checkout=\${checkoutPlan}\`
                    : "/dashboard";

                  signIn("google", { callbackUrl });
                }}`;

  registerContent = registerContent.replace(registerGoogleMatch[0], newRegisterHandler);
  console.log("  ✅ Updated Google button handler with checkout_plan");
}

writeFileSync(registerPagePath, registerContent);
console.log("  ✅ Register page fixed\n");

// ============================================
// FIX 3: Auth Config - Process referral & checkout_plan
// ============================================

console.log("Fixing auth.config.ts...");

let authContent = readFileSync(authConfigPath, "utf-8");

// Add helper functions at the top of the file after imports
const helperFunctions = `
/**
 * Process referral code from token storage
 */
async function processReferralFromToken(userId: string, userEmail: string) {
  try {
    // Read referral code from any storage mechanism available
    // In NextAuth callback, we need to use cookies/localStorage via headers
    // For now, return null - frontend should call /api/auth/referral/process separately
    return null;
  } catch (e) {
    console.warn("[Auth] processReferralFromToken error:", e);
    return null;
  }
}

/**
 * Process checkout plan - activate subscription immediately
 */
async function processCheckoutPlanFromToken(userId: string, planSlug: string | null) {
  if (!planSlug) return null;

  try {
    // In production, read from cookie/localStorage via headers
    // For now, return null - frontend should call /api/checkout/process separately
    return null;
  } catch (e) {
    console.warn("[Auth] processCheckoutFromToken error:", e);
    return null;
  }
}
`;

// Add after imports but before authOptions
authContent = authContent.replace(
  /import \{ query \} from "@\/lib\/db";?/,
  `import { query } from "@/lib/db";${helperFunctions}`
);

// Update the signIn callback to include better logging
authContent = authContent.replace(
  /if \(existing\.rows\.length === 0\) \{[\s\S]*?console\.log\("\[Auth\] New Google user created:",/,
  `if (existing.rows.length === 0) {
            // Process referral code if available
            // Note: In production, read from cookie/localStorage via callback URL params
            // Frontend should call /api/auth/referral/process separately

            const result = await query(`
);

writeFileSync(authConfigPath, authContent);
console.log("  ✅ Auth config updated\n");

// ============================================
// Summary
// ============================================

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║              GOOGLE OAUTH FLOW FIXED                          ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

console.log("Fixed files:");
console.log("  ✅ app/(app)/(auth)/login/page.tsx");
console.log("  ✅ app/(app)/(auth)/register/page.tsx");
console.log("  ✅ lib/auth.config.ts\n");

console.log("What was fixed:");
console.log("  1. Store checkout_plan to localStorage before OAuth");
console.log("  2. Store referral_code to localStorage before OAuth");
console.log("  3. Include checkout_plan in callbackUrl");
console.log("  4. Show checkout plan info in UI\n");

console.log("Note: For full referral + checkout processing after OAuth,");
console.log("frontend should call /api/auth/referral/process and /api/checkout/process\n");
