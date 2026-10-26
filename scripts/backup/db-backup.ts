/**
 * Database Backup Script
 *
 * Dumps the PostgreSQL database using pg_dump and uploads the compressed
 * archive to Cloudflare R2 for disaster recovery.
 *
 * Retention Policy:
 *   - Daily backups:  last 7 days (daily-*)
 *   - Weekly backups: last 4 weeks  (weekly-*, kept on Sunday)
 *   - Monthly backups: last 12 months (monthly-*, kept on the 1st)
 *
 * Usage:
 *   npx tsx scripts/backup/db-backup.ts
 *
 * Environment Variables Required:
 *   DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME
 *   CLOUDFLARE_R2_ACCESS_KEY_ID
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY
 *   CLOUDFLARE_R2_ENDPOINT
 *   CLOUDFLARE_R2_BUCKET_NAME
 */

import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync, createReadStream, createWriteStream } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import { Readable } from "stream";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";

// ============================================================
// Configuration
// ============================================================

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT!;
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
const R2_PREFIX = "backups/db/";

// Retention limits
const RETAIN_DAILY = 7;
const RETAIN_WEEKLY = 4;
const RETAIN_MONTHLY = 12;

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

// ============================================================
// Database Connection
// ============================================================

interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function getDbConfig(): DbConfig {
  // Support both DATABASE_URL and individual vars
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || "5432"),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    };
  }
  return {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  };
}

// ============================================================
// Date Helpers
// ============================================================

function today(): Date {
  return new Date();
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function toIsoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function toIsoMonth(d: Date): string {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function isSunday(d: Date): boolean {
  return d.getDay() === 0;
}

function isFirstOfMonth(d: Date): boolean {
  return d.getDate() === 1;
}

// ============================================================
// Backup Types
// ============================================================

type BackupType = "daily" | "weekly" | "monthly";

function determineBackupType(d: Date): BackupType {
  if (isFirstOfMonth(d)) return "monthly";
  if (isSunday(d)) return "weekly";
  return "daily";
}

// ============================================================
// pg_dump Runner
// ============================================================

function runPgDump(outputPath: string): void {
  const db = getDbConfig();

  // Build pg_dump command
  const args = [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--username=${db.user}`,
    `--dbname=${db.database}`,
    `--format=custom`,
    `--compress=9`,
    `--no-owner`,
    `--no-acl`,
    `--file=${outputPath}`,
  ];

  const env = {
    ...process.env,
    PGPASSWORD: db.password,
  };

  console.log(`[DB-BACKUP] Running pg_dump to ${outputPath}`);
  execSync(`pg_dump ${args.join(" ")}`, { env, stdio: "inherit" });
}

// ============================================================
// Gzip Compressor
// ============================================================

async function compressFile(inputPath: string, outputPath: string): Promise<void> {
  const gzip = createGzip({ level: 6 });
  const source = Readable.toStream(require("fs").createReadStream(inputPath));
  const dest = require("fs").createWriteStream(outputPath);
  await pipeline(source, gzip, dest);
  console.log(`[DB-BACKUP] Compressed: ${inputPath} -> ${outputPath}`);
}

// ============================================================
// R2 Upload
// ============================================================

async function uploadToR2(filePath: string, key: string, contentType: string): Promise<void> {
  const fileBuffer = require("fs").readFileSync(filePath);
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );
  console.log(`[DB-BACKUP] Uploaded to R2: ${key}`);
}

// ============================================================
// List Existing Backups
// ============================================================

interface BackupEntry {
  key: string;
  lastModified: Date;
  type: BackupType;
  date: string;
}

async function listBackups(): Promise<BackupEntry[]> {
  const entries: BackupEntry[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: R2_PREFIX,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key || !obj.LastModified) continue;
        // Parse key: gurupro-backup-{YYYY-MM-DD}-{type}.sql.gz
        const match = obj.Key.match(/gurupro-backup-(\d{4}-\d{2}-\d{2})-(daily|weekly|monthly)\.sql\.gz$/);
        if (match) {
          entries.push({
            key: obj.Key,
            lastModified: obj.LastModified,
            type: match[2] as BackupType,
            date: match[1],
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return entries;
}

// ============================================================
// Retention Cleanup
// ============================================================

async function enforceRetention(backups: BackupEntry[]): Promise<void> {
  const now = new Date();

  // Group backups by type
  const byType = {
    daily: backups.filter((b) => b.type === "daily").sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()),
    weekly: backups.filter((b) => b.type === "weekly").sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()),
    monthly: backups.filter((b) => b.type === "monthly").sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()),
  };

  const retentionLimits: Record<BackupType, number> = {
    daily: RETAIN_DAILY,
    weekly: RETAIN_WEEKLY,
    monthly: RETAIN_MONTHLY,
  };

  let deletedCount = 0;

  for (const [type, list] of Object.entries(byType) as [BackupType, BackupEntry[]][]) {
    const limit = retentionLimits[type];
    const toDelete = list.slice(limit);

    for (const entry of toDelete) {
      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: entry.key,
          })
        );
        console.log(`[DB-BACKUP] Deleted old backup (${type}): ${entry.key}`);
        deletedCount++;
      } catch (err) {
        console.error(`[DB-BACKUP] Failed to delete ${entry.key}:`, err);
      }
    }
  }

  if (deletedCount === 0) {
    console.log("[DB-BACKUP] No backups exceeded retention limits — nothing to prune.");
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("[DB-BACKUP] Starting database backup...");
  console.log(`[DB-BACKUP] Timestamp: ${new Date().toISOString()}`);

  // Validate environment
  const required = [
    "CLOUDFLARE_R2_BUCKET_NAME",
    "CLOUDFLARE_R2_ENDPOINT",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`[DB-BACKUP] Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  const now = new Date();
  const dateStr = toIsoDate(now);
  const backupType = determineBackupType(now);

  // Build backup filename
  const fileName = `gurupro-backup-${dateStr}-${backupType}.sql`;
  const gzName = `gurupro-backup-${dateStr}-${backupType}.sql.gz`;
  const tmpDir = process.env.TMPDIR || process.env.TEMP || "/tmp";
  const tmpFile = join(tmpDir, fileName);
  const tmpGzFile = join(tmpDir, gzName);
  const r2Key = `${R2_PREFIX}${gzName}`;

  try {
    // Step 1: Run pg_dump
    runPgDump(tmpFile);

    // Step 2: Compress
    await compressFile(tmpFile, tmpGzFile);

    // Step 3: Upload to R2
    await uploadToR2(tmpGzFile, r2Key, "application/gzip");

    // Step 4: Cleanup old backups (retention policy)
    console.log("[DB-BACKUP] Checking retention policy...");
    const existingBackups = await listBackups();
    await enforceRetention(existingBackups);

    console.log(`[DB-BACKUP] Backup complete: ${r2Key}`);
  } catch (err) {
    console.error("[DB-BACKUP] Backup failed:", err);
    process.exit(1);
  } finally {
    // Clean up temp files
    try {
      require("fs").unlinkSync(tmpFile);
      require("fs").unlinkSync(tmpGzFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

main();
