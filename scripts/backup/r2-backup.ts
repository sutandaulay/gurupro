/**
 * R2 Storage Backup Script
 *
 * Generates a JSON manifest of all objects in the primary R2 bucket and
 * uploads it to R2 for disaster-recovery auditing.
 *
 * Optionally syncs critical user files to a secondary R2 bucket or S3 Glacier.
 *
 * Usage:
 *   npx tsx scripts/backup/r2-backup.ts
 *
 * Environment Variables Required:
 *   CLOUDFLARE_R2_ACCESS_KEY_ID
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY
 *   CLOUDFLARE_R2_ENDPOINT
 *   CLOUDFLARE_R2_BUCKET_NAME
 *
 * Optional:
 *   R2_SECONDARY_BUCKET_NAME   — secondary R2 bucket for critical file sync
 *   R2_SECONDARY_ENDPOINT      — endpoint for secondary bucket
 */

import { S3Client, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";

// ============================================================
// Configuration
// ============================================================

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT!;
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;

const MANIFEST_PREFIX = "backups/r2-manifest/";

// Optional secondary bucket for critical file sync
const R2_SECONDARY_BUCKET = process.env.R2_SECONDARY_BUCKET_NAME;
const R2_SECONDARY_ENDPOINT = process.env.R2_SECONDARY_ENDPOINT;

// ============================================================
// R2 Client
// ============================================================

const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const secondaryClient = R2_SECONDARY_BUCKET && R2_SECONDARY_ENDPOINT
  ? new S3Client({
      region: "auto",
      endpoint: R2_SECONDARY_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  : null;

// ============================================================
// Types
// ============================================================

interface R2ObjectInfo {
  key: string;
  size: number;
  lastModified: string; // ISO string
  storageClass?: string;
}

interface R2Manifest {
  generatedAt: string;
  bucket: string;
  region: string;
  totalObjects: number;
  totalSizeBytes: number;
  objects: R2ObjectInfo[];
  summary: {
    byPrefix: Record<string, { count: number; sizeBytes: number }>;
  };
}

// ============================================================
// List all objects (with pagination)
// ============================================================

async function listAllObjects(
  client: S3Client,
  bucket: string,
  prefix = ""
): Promise<R2ObjectInfo[]> {
  const objects: R2ObjectInfo[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          objects.push({
            key: obj.Key,
            size: Number(obj.Size ?? 0),
            lastModified: obj.LastModified?.toISOString() ?? new Date().toISOString(),
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

// ============================================================
// Build summary by prefix
// ============================================================

function buildSummaryByPrefix(objects: R2ObjectInfo[]): Record<string, { count: number; sizeBytes: number }> {
  const summary: Record<string, { count: number; sizeBytes: number }> = {};

  for (const obj of objects) {
    // Extract top-level prefix (e.g. "uploads/" -> "uploads")
    const parts = obj.key.split("/");
    const topPrefix = parts[0] || "(root)";

    if (!summary[topPrefix]) {
      summary[topPrefix] = { count: 0, sizeBytes: 0 };
    }
    summary[topPrefix].count++;
    summary[topPrefix].sizeBytes += obj.size;
  }

  return summary;
}

// ============================================================
// Generate manifest
// ============================================================

function generateManifest(
  objects: R2ObjectInfo[],
  bucket: string
): R2Manifest {
  const totalSizeBytes = objects.reduce((sum, obj) => sum + obj.size, 0);

  return {
    generatedAt: new Date().toISOString(),
    bucket,
    region: "auto",
    totalObjects: objects.length,
    totalSizeBytes,
    objects,
    summary: {
      byPrefix: buildSummaryByPrefix(objects),
    },
  };
}

// ============================================================
// Upload manifest to R2
// ============================================================

async function uploadManifest(
  manifest: R2Manifest,
  client: S3Client,
  bucket: string
): Promise<void> {
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const manifestKey = `${MANIFEST_PREFIX}gurupro-r2-manifest-${dateStr}.json`;

  const body = JSON.stringify(manifest, null, 2);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: manifestKey,
      Body: body,
      ContentType: "application/json",
    })
  );

  console.log(`[R2-BACKUP] Manifest uploaded: ${manifestKey}`);
  console.log(`[R2-BACKUP] Total objects: ${manifest.totalObjects}`);
  console.log(`[R2-BACKUP] Total size: ${(manifest.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
}

// ============================================================
// Optional: Sync critical prefixes to secondary bucket
// ============================================================

const CRITICAL_PREFIXES = ["uploads/", "user-files/"];

async function syncCriticalFiles(): Promise<void> {
  if (!secondaryClient || !R2_SECONDARY_BUCKET) {
    console.log("[R2-BACKUP] Secondary bucket not configured — skipping critical file sync.");
    return;
  }

  console.log(`[R2-BACKUP] Syncing critical prefixes to secondary bucket: ${R2_SECONDARY_BUCKET}`);

  for (const prefix of CRITICAL_PREFIXES) {
    const objects = await listAllObjects(r2Client, R2_BUCKET, prefix);
    console.log(`[R2-BACKUP]   Prefix "${prefix}": ${objects.length} objects`);

    // For each object, upload to secondary bucket
    let synced = 0;
    for (const obj of objects) {
      try {
        // Get object from primary
        const getCmd = await import("@aws-sdk/client-s3").then((m) =>
          m.GetObjectCommand
        );
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        const response = await r2Client.send(
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: obj.key })
        );

        // Upload to secondary
        const { PutObjectCommand: PutCmd } = await import("@aws-sdk/client-s3");
        await secondaryClient.send(
          new PutCmd({
            Bucket: R2_SECONDARY_BUCKET,
            Key: obj.key,
            Body: response.Body,
            ContentType: response.ContentType,
          })
        );
        synced++;
      } catch (err) {
        console.error(`[R2-BACKUP]   Failed to sync ${obj.key}:`, err);
      }
    }

    console.log(`[R2-BACKUP]   Synced ${synced}/${objects.length} objects for prefix "${prefix}"`);
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("[R2-BACKUP] Starting R2 inventory manifest generation...");
  console.log(`[R2-BACKUP] Timestamp: ${new Date().toISOString()}`);

  // Validate environment
  const required = [
    "CLOUDFLARE_R2_BUCKET_NAME",
    "CLOUDFLARE_R2_ENDPOINT",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`[R2-BACKUP] Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  try {
    // Step 1: List all objects in primary bucket
    console.log(`[R2-BACKUP] Listing objects in bucket: ${R2_BUCKET}`);
    const objects = await listAllObjects(r2Client, R2_BUCKET);
    console.log(`[R2-BACKUP] Found ${objects.length} objects`);

    // Step 2: Generate manifest
    const manifest = generateManifest(objects, R2_BUCKET);

    // Step 3: Upload manifest to R2
    await uploadManifest(manifest, r2Client, R2_BUCKET);

    // Step 4: Optionally sync critical files to secondary bucket
    await syncCriticalFiles();

    // Print summary
    console.log("\n[R2-BACKUP] Summary by prefix:");
    for (const [prefix, stats] of Object.entries(manifest.summary.byPrefix)) {
      console.log(
        `  ${prefix}: ${stats.count} objects, ${(stats.sizeBytes / 1024 / 1024).toFixed(2)} MB`
      );
    }

    console.log("\n[R2-BACKUP] R2 inventory backup complete.");
  } catch (err) {
    console.error("[R2-BACKUP] R2 backup failed:", err);
    process.exit(1);
  }
}

main();
