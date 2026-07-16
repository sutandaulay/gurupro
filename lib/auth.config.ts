import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { query } from "@/lib/db";

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
               VALUES ($1, $2, 'guru', true, NOW(), true, false, $3, 5,
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'free',
                 'individual')
               RETURNING id`,
              [user.email.toLowerCase(), displayName, selfRefCode]
            );
            user.id = result.rows[0].id;
            console.log("[Auth] New Google user created:", { id: user.id });
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
