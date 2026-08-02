import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth.config";

const handler = NextAuth(authOptions);

async function safeHandler(method: 'GET' | 'POST', req: Request, context: any) {
  try {
    return await handler(req, context);
  } catch (error: any) {
    console.error(`[NextAuth] ${method} error:`, error?.message || error);

    // Return a safe empty response so client doesn't crash
    // For GET (session fetch): return empty session object
    // For POST (sign in): return error JSON
    if (method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'ok', data: null }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    return new Response(
      JSON.stringify({ error: 'Authentication service temporarily unavailable' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function GET(req: Request, context: any) {
  return safeHandler('GET', req, context);
}

export async function POST(req: Request, context: any) {
  return safeHandler('POST', req, context);
}
