import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { query } from "@/lib/db";

// Default token allocation for new users (matching register flow)
const DEFAULT_TOKEN_ALLOCATION = 5;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      console.log("[Auth] signIn callback:", { provider: account?.provider, email: user?.email });
      if (account?.provider === "google" && user.email) {
        try {
          const existing = await query(
            "SELECT id FROM users WHERE email = $1",
            [user.email.toLowerCase()]
          );
          console.log("[Auth] Existing user check:", { found: existing.rows.length });

          // Determine display name: prefer user.name, fallback to email prefix
          const displayName = user.name?.trim()
            || (user.email && user.email.split("@")[0])
            || "GuruPRO User";

          if (existing.rows.length === 0) {
            // Generate self referral code for new Google users
            const selfRefCode = "GPRO-" + Math.random().toString(36).substring(2, 7).toUpperCase();

            const result = await query(
              `INSERT INTO users (
                 email, nama_lengkap, role, is_active, created_at,
                 email_verified, phone_verified,
                 referral_code, token_limit,
                 subscription_start, subscription_end, status_langganan,
                 account_type
               )
               VALUES ($1, $2, 'guru', true, NOW(), true, false, $3, $4,
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'free',
                 'individual')
               RETURNING id`,
              [user.email.toLowerCase(), displayName, selfRefCode, DEFAULT_TOKEN_ALLOCATION]
            );
            user.id = result.rows[0].id;
            console.log("[Auth] New Google user created:", { id: user.id, tokens: DEFAULT_TOKEN_ALLOCATION });

            // Create audit trail for new Google user
            await query(
              `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
               VALUES ($1, $2, $3, $4)`,
              [user.id, 'Registrasi Google OAuth', 'Akun baru dibuat via Google Sign-In', 'system']
            );
          } else {
            user.id = existing.rows[0].id;
            console.log("[Auth] Existing user:", { id: user.id });
          }
          return true;
        } catch (err) {
          console.error("[Auth] signIn error:", err);
          return true; // Allow sign in anyway, don't block
        }
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // url is the callbackUrl provided at sign-in, which carries the
      // checkout plan (and referral code) as query params.
      try {
        const target = new URL(url, baseUrl);
        const checkoutPlan = target.searchParams.get("checkout");
        if (checkoutPlan) {
          // Land the user on the billing page with the plan preselected.
          // Preserve the referral param so it can still be processed.
          target.pathname = "/dashboard/billing";
          return target.toString();
        }
      } catch {
        /* fall through to default behaviour */
      }
      // Default: only allow same-origin URLs.
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async jwt({ token, account, user }) {
      if (account && user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
