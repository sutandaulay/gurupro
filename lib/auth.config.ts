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
      if (account?.provider === "google" && user.email) {
        try {
          const existing = await query(
            "SELECT id FROM users WHERE email = $1",
            [user.email.toLowerCase()]
          );
          if (existing.rows.length === 0) {
            const result = await query(
              `INSERT INTO users (email, nama_lengkap, role, is_active, created_at)
               VALUES ($1, $2, 'guru', true, NOW())
               RETURNING id`,
              [user.email.toLowerCase(), user.name || user.email.split("@")[0]]
            );
            user.id = result.rows[0].id;
          } else {
            user.id = existing.rows[0].id;
          }
          return true;
        } catch (err) {
          console.error("Google signIn error:", err);
          return false;
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
