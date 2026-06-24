import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that require authentication
const protectedPaths = ["/dashboard", "/settings", "/profile", "/admin"];

// Auth routes — redirect to dashboard if already logged in
const authRoutes = ["/login", "/register"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Check NextAuth JWT token (Google OAuth users)
  const nextAuthToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // 2. Check custom gurupro_session cookie (email/password users)
  const guruproSession = req.cookies.get("gurupro_session")?.value;
  let customSession: { id: string; role: string } | null = null;
  if (guruproSession) {
    try {
      customSession = JSON.parse(guruproSession);
    } catch {
      // Invalid cookie format — treat as not authenticated
    }
  }

  const isAuthenticated = !!nextAuthToken || !!customSession;
  const isAdmin = customSession?.role === "admin";

  const isProtectedRoute = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuthRoute = authRoutes.some((p) => pathname.startsWith(p));

  // Protected route + not authenticated → redirect to login with callbackUrl
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route + authenticated but not admin → redirect to dashboard
  if (pathname.startsWith("/admin") && isAuthenticated && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Auth route (login/register) + already authenticated → redirect to dashboard/admin
  if (isAuthRoute && isAuthenticated) {
    const target = isAdmin ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(target, req.url));
  }

  return NextResponse.next();
}

// Exclude: api/auth, _next, static files (png, jpg, ico, svg, etc.)
export const config = {
  matcher: [
    "/((?!api/auth|_next|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|ico|svg)).*)",
  ],
};
