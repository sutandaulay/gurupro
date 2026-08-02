/**
 * R2 Library Client — bucket terpisah gurupro-library
 * Semua akses via signed URL, bucket private
 */

import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const isConfigured = !!(
  process.env.R2_LIBRARY_ACCESS_KEY_ID &&
  process.env.R2_LIBRARY_SECRET_ACCESS_KEY &&
  process.env.R2_LIBRARY_ENDPOINT &&
  process.env.R2_LIBRARY_BUCKET
);

export const r2LibraryClient = isConfigured
  ? new S3Client({
      region: 'auto',
      endpoint: process.env.R2_LIBRARY_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_LIBRARY_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_LIBRARY_SECRET_ACCESS_KEY!,
      },
      // Prevent AWS SDK v3 from adding `x-amz-checksum-mode=ENABLED` to requests/URLs —
      // Cloudflare R2 doesn't support it and responds with 408 Request Timeout.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  : null;

export const BUCKET = process.env.R2_LIBRARY_BUCKET || 'gurupro-library';

// In-memory LRU cache for signed URLs
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const MAX_CACHE_SIZE = 200;

function cacheGet(key: string): string | null {
  const entry = signedUrlCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.url;
  signedUrlCache.delete(key);
  return null;
}

function cacheSet(key: string, url: string, ttlMs: number) {
  if (signedUrlCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest 25%
    const entries = Array.from(signedUrlCache.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < Math.floor(MAX_CACHE_SIZE * 0.25); i++) {
      signedUrlCache.delete(entries[i][0]);
    }
  }
  signedUrlCache.set(key, { url, expiresAt: Date.now() + ttlMs });
}

/**
 * Generate signed URL untuk streaming/download file library
 * Cached untuk signed URL cover (24h TTL)
 */
export async function getLibrarySignedUrl(key: string, expiresIn = 3600, noCache = false): Promise<string | null> {
  const cacheKey = `${key}:${expiresIn}`;
  if (!noCache) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  if (!r2LibraryClient) {
    console.warn('[R2Library] Client not configured');
    return null;
  }
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const url = await getSignedUrl(r2LibraryClient, command, { expiresIn });
    // Cache signed URL for 80% of TTL
    cacheSet(cacheKey, url, expiresIn * 800);
    return url;
  } catch (error) {
    console.error('[R2Library] Failed to generate signed URL:', error);
    return null;
  }
}

/**
 * Invalidate cache for a key (call after upload/delete)
 */
export function invalidateLibraryCache(key: string): void {
  for (const k of signedUrlCache.keys()) {
    if (k.startsWith(key)) signedUrlCache.delete(k);
  }
}

/**
 * Generate signed URL untuk upload file ke R2
 * @param key - R2 object key
 * @param contentType - MIME type file
 * @param expiresIn - expiry dalam detik, default 900 (15 menit)
 */
export async function getLibraryUploadUrl(key: string, contentType: string, expiresIn = 900): Promise<string | null> {
  if (!r2LibraryClient) {
    console.warn('[R2Library] Client not configured');
    return null;
  }
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });
    return await getSignedUrl(r2LibraryClient, command, { expiresIn });
  } catch (error) {
    console.error('[R2Library] Failed to generate upload URL:', error);
    return null;
  }
}

/**
 * Delete object from R2
 */
export async function deleteLibraryObject(key: string): Promise<boolean> {
  if (!r2LibraryClient) {
    console.warn('[R2Library] Client not configured');
    return false;
  }
  try {
    const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
    await r2LibraryClient.send(command);
    return true;
  } catch (error) {
    console.error('[R2Library] Failed to delete object:', error);
    return false;
  }
}

/**
 * Get object metadata (for content-length, content-type, etc.)
 */
export async function getLibraryObjectMeta(key: string): Promise<Record<string, string> | null> {
  if (!r2LibraryClient) return null;
  try {
    const command = new HeadObjectCommand({ Bucket: BUCKET, Key: key });
    const result = await r2LibraryClient.send(command);
    return {
      contentLength: String(result.ContentLength ?? 0),
      contentType: result.ContentType ?? 'application/octet-stream',
    };
  } catch {
    return null;
  }
}

/**
 * Helper: generate object key untuk PDF
 */
export function pdfKey(itemId: string): string {
  return `pdf/${itemId}/file.pdf`;
}

/**
 * Helper: generate object key untuk audiobook
 */
export function audiobookKey(itemId: string): string {
  return `audio/${itemId}/file.mp3`;
}

/**
 * Helper: generate object key untuk cover image
 */
export function coverKey(itemId: string): string {
  return `covers/${itemId}/cover.webp`;
}
