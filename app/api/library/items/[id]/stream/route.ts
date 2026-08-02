/**
 * Library PDF streaming proxy — bypasses signed URL 408 issue
 * Server-side fetch from R2, stream to client
 */
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2LibraryClient, BUCKET } from "@/lib/r2-library";

async function verifyGuru() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyGuru();
    const { id } = await params;

    console.log("[stream] itemId:", id);

    const result = await query(
      `SELECT file_key FROM library_items WHERE id = $1 AND type = 'pdf'`,
      [id]
    );

    console.log("[stream] query result:", result.rows.length, result.rows[0]);

    if (result.rows.length === 0 || !result.rows[0].file_key) {
      return new NextResponse("Item tidak ditemukan atau bukan PDF", { status: 404 });
    }

    const fileKey = result.rows[0].file_key;
    console.log("[stream] fileKey:", fileKey);
    console.log("[stream] r2LibraryClient configured:", !!r2LibraryClient);
    console.log("[stream] BUCKET:", BUCKET);

    if (!r2LibraryClient) {
      return new NextResponse("R2 client tidak dikonfigurasi", { status: 503 });
    }

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: fileKey });
    console.log("[stream] fetching from R2...");
    const response = await r2LibraryClient.send(command);
    console.log("[stream] R2 response status:", response.$metadata?.httpStatusCode);

    if (!response.Body) {
      return new NextResponse("File kosong", { status: 500 });
    }

    const stream = response.Body as AsyncIterable<Uint8Array>;
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    console.log("[stream] file size:", buffer.length);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error: any) {
    console.error("[stream] ERROR:", error.message, error.name, error.$metadata);
    if (error.message === "Unauthorized") return new NextResponse("Unauthorized", { status: 401 });
    if (!r2LibraryClient) return new NextResponse("R2 client tidak dikonfigurasi", { status: 503 });
    return new NextResponse(`Error: ${error.message} | ${error.name || ""}`, { status: 500 });
  }
}
