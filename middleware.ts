export const config = {
  matcher: [
    // Exclude monitoring route, Next.js internals, and static files
    "/((?!monitoring|_next/static|_next/image|favicon.ico).*)",
  ],
};
