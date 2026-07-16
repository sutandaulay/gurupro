import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth.config";

// Wrap handler with error handling
const handler = NextAuth(authOptions);

export async function GET(req: Request, context: any) {
  try {
    return await handler(req, context);
  } catch (error) {
    console.error("[NextAuth] GET error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request, context: any) {
  try {
    return await handler(req, context);
  } catch (error) {
    console.error("[NextAuth] POST error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
