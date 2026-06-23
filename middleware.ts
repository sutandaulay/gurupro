import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('gurupro_session')?.value;
  const { pathname } = request.nextUrl;

  let session: { id: string; role: string } | null = null;
  if (sessionCookie) {
    try {
      session = JSON.parse(sessionCookie);
    } catch (e) {
      // Invalid session cookie format
    }
  }

  // 1. Protection for admin route
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (session.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 2. Protection for dashboard route
  if (pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // 3. Redirect logged-in users away from login page
  if (pathname === '/login') {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login'],
};
