import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicAdminPaths = ["/admin/login", "/admin/register"];
const protectedPaths = ["/dashboard", "/settings", "/profile", "/attendance", "/reports"];
const authPaths = ["/login", "/register"];
const protectedApiPaths = ["/api/user", "/api/admin"];

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // Allow public admin paths
  if (publicAdminPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check authentication status
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const isNextAuth = !!token;
  const guruproSession = request.cookies.get("gurupro_session")?.value;
  const isAuthenticated = isNextAuth || !!guruproSession;

  // Admin route protection - check session
  if (pathname.startsWith("/admin")) {
    if (!guruproSession && !isNextAuth) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Additional role check for admin routes will be done in layout
    return NextResponse.next();
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && authPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  // Protect dashboard and other protected routes
  if (
    !isAuthenticated &&
    protectedPaths.some((p) => pathname.startsWith(p))
  ) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For API routes, we don't redirect - let the API handle auth errors
  // This allows the API to return proper JSON error responses

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public|.*\\.(?:png|jpg|jpeg|ico|svg|css|js|woff2?|ttf|webp|gif)).*)",
  ],
};
