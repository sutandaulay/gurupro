/**
 * Admin: Upload file library via server (with compression)
 * Browser -> Server -> Compress (cover) -> R2
 * No external compression libs needed for PDF/audio (stored as-is)
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { query } from "@/lib/db";
import { coverKey, pdfKey, audiobookKey, invalidateLibraryCache } from "@/lib/r2-library";
import { parseSessionCookie } from "@/lib/session-sign";

const BUCKET = process.env.R2_LIBRARY_BUCKET || "gurupro-library";

export const MAX_LIBRARY_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

async function getR2Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_LIBRARY_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_LIBRARY_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_LIBRARY_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) throw new Error("Unauthorized");
  if (!["admin", "super_admin", "manager"].includes(session.role)) throw new Error("Forbidden");
}

export async function POST(request: Request) {
  try {
    await verifyAdmin();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const itemId = formData.get("itemId") as string | null;
    const fileType = formData.get("fileType") as string | null;

    if (!file || !itemId || !fileType) {
      return NextResponse.json({ error: "file, itemId, dan fileType wajib" }, { status: 400 });
    }

    if (!["pdf", "audiobook", "cover"].includes(fileType)) {
      return NextResponse.json({ error: "fileType tidak valid" }, { status: 400 });
    }

    if (file.size > MAX_LIBRARY_FILE_SIZE) {
      return NextResponse.json(
        { error: `Ukuran file maksimal 10 MB (file ini ${(file.size / (1024 * 1024)).toFixed(2)} MB)` },
        { status: 413 }
      );
    }

    // Generate key
    let key: string;
    let contentType: string;
    if (fileType === "pdf") {
      key = pdfKey(itemId); contentType = "application/pdf";
    } else if (fileType === "audiobook") {
      key = audiobookKey(itemId); contentType = "audio/mpeg";
    } else {
      key = coverKey(itemId); contentType = "image/webp";
    }

    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuffer);

    // Compress cover images with sharp
    if (fileType === "cover") {
      try {
        const sharp = (await import("sharp")).default;
        const metadata = await sharp(buffer).metadata();
        const isAnimated = metadata.pages && metadata.pages > 1;

        let s = sharp(buffer);
        // Resize to max 800x800, strip metadata, convert to webp
        s = s.resize(800, 800, { fit: "inside", withoutEnlargement: true });
        s = s.webp({ quality: 80, effort: 4 });
        buffer = await s.toBuffer();
        contentType = "image/webp";
      } catch (err) {
        // Sharp failed — upload original
        console.warn("[Library] Sharp compression failed, storing original:", err);
      }
    }

    // Upload to R2
    const client = await getR2Client();
    await client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: fileType === "cover" ? "public, max-age=31536000, immutable" : "private, max-age=86400",
    }));

    // Invalidate cache
    invalidateLibraryCache(key);

    // Update DB record with keys
    if (fileType === "cover" || fileType === "pdf" || fileType === "audiobook") {
      const fieldMap: Record<string, string> = {
        cover: "cover_image_key",
        pdf: "file_key",
        audiobook: "file_key",
      };
      const field = fieldMap[fileType];
      await query(
        `UPDATE library_items SET ${field} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [key, itemId]
      );
    }

    // Auto-detect page count for PDF files so admin doesn't have to fill it in
    if (fileType === "pdf") {
      try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        const info = await parser.getInfo();
        const numPages = info.total;
        await parser.destroy();
        if (numPages && numPages > 0) {
          await query(
            `UPDATE library_items SET page_count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [numPages, itemId]
          );
        }
      } catch (err) {
        console.warn("[Library] Gagal mendeteksi jumlah halaman PDF:", err);
      }
    }

    return NextResponse.json({
      success: true,
      key,
      size: buffer.length,
      contentType,
    });
  } catch (error: any) {
    console.error("POST /api/admin/library/upload error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
