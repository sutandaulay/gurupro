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

      // If user object has no id, we can't proceed reliably
      // Let NextAuth create the session anyway; jwt/session callbacks handle the rest
      if (!user) return true;

      if (account?.provider === "google" && user.email) {
        try {
          const existing = await query(
            "SELECT id FROM users WHERE email = $1",
            [user.email.toLowerCase()]
          );
          console.log("[Auth] Existing user check:", { found: existing.rows.length });

          const displayName = user.name?.trim()
            || (user.email && user.email.split("@")[0])
            || "GuruPRO User";

          if (existing.rows.length === 0) {
            const selfRefCode = "GPRO-" + Math.random().toString(36).substring(2, 7).toUpperCase();

            const result = await query(
              `INSERT INTO users (
                 email, nama_lengkap, role, is_active, created_at,
                 email_verified, phone_verified,
                 referral_code, quota_poin_total,
                 subscription_start, subscription_end, status_langganan,
                 account_type
               )
               VALUES ($1, $2, 'guru', true, NOW(), true, false, $3, $4,
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'free',
                 'individual')
               RETURNING id`,
              [user.email.toLowerCase(), displayName, selfRefCode, DEFAULT_TOKEN_ALLOCATION]
            );

            // Ensure user.id is set before returning
            if (result.rows[0]?.id) {
              user.id = result.rows[0].id;
            }
            console.log("[Auth] New Google user created:", { id: user.id, tokens: DEFAULT_TOKEN_ALLOCATION });

            await query(
              `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
               VALUES ($1, $2, $3, $4)`,
              [user.id, 'Registrasi Google OAuth', 'Akun baru dibuat via Google Sign-In', 'system']
            );
          } else {
            // Ensure user.id is set for existing users too
            if (!user.id && existing.rows[0]?.id) {
              user.id = existing.rows[0].id;
            }
            console.log("[Auth] Existing user:", { id: user.id });
          }
        } catch (err) {
          console.error("[Auth] signIn DB error:", err);
          // Still allow sign-in; user.id may already be set by NextAuth from OAuth token
          // or jwt callback will use token.sub as fallback
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
        const refCode = target.searchParams.get("ref");
        if (checkoutPlan || refCode) {
          // Land the user on the billing page with the plan preselected.
          // Preserve the referral param so it can still be processed.
          const params = new URLSearchParams();
          if (checkoutPlan) params.set("checkout", checkoutPlan);
          if (refCode) params.set("ref", refCode);
          target.pathname = "/dashboard/billing";
          target.search = params.toString();
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
      // Always set token.id — prefer from user object, fallback to token.sub
      if (user?.id) {
        token.id = user.id;
      } else if (account && token.sub) {
        // For OAuth flows, map token.sub (the user id) to token.id
        // This ensures session callback always has access to user id
        token.id = token.sub;
      } else if (token.sub) {
        token.id = token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      // Safely assign user id from token — never crash if token.id is missing
      if (session.user && token.id) {
        session.user.id = String(token.id);
      }
      // Forward the Google profile photo URL to the session so client-side
      // components (TopBar, Sidebar) can display it without needing a DB upload.
      if (session.user && token.picture) {
        session.user.image = token.picture;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
