import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "next-auth/react";

export async function POST() {
  const cookieStore = await cookies();

  // Clear our custom session cookies
  cookieStore.delete("gurupro_session");
  cookieStore.delete("gurupro_school_selected");

  // Clear NextAuth session cookies for Google OAuth users
  cookieStore.delete("next-auth.session-token");
  cookieStore.delete("__Secure-next-auth.session-token");

  return NextResponse.json({ success: true });
}

// Also add GET method for NextAuth signout compatibility
export async function GET() {
  const cookieStore = await cookies();

  // Clear our custom session cookies
  cookieStore.delete("gurupro_session");
  cookieStore.delete("gurupro_school_selected");

  // Clear NextAuth session cookies for Google OAuth users
  cookieStore.delete("next-auth.session-token");
  cookieStore.delete("__Secure-next-auth.session-token");

  return NextResponse.json({ success: true });
}
