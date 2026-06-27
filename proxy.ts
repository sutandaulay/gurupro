import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicAdminPaths = ["/admin/login", "/admin/register"];
const protectedPaths = ["/dashboard", "/settings", "/profile"];
const authPaths = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  if (publicAdminPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get("gurupro_session")?.value;
    if (!sessionCookie) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const isNextAuth = !!token;
  const guruproSession = request.cookies.get("gurupro_session")?.value;
  const isAuthenticated = isNextAuth || !!guruproSession;

  if (isAuthenticated && authPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  if (
    !isAuthenticated &&
    protectedPaths.some((p) => pathname.startsWith(p))
  ) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next|.*\\.(?:png|jpg|jpeg|ico|svg|css|js|woff2?|ttf|webp|gif)).*)",
  ],
};
