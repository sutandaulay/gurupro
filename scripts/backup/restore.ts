/**
 * Database Restore Script
 *
 * Downloads a compressed PostgreSQL backup from Cloudflare R2 and restores it
 * to the database using pg_restore.
 *
 * Usage:
 *   npx tsx scripts/backup/restore.ts --date=YYYY-MM-DD [--type=daily|weekly|monthly]
 *
 * Arguments:
 *   --date       Required. The date of the backup to restore (YYYY-MM-DD).
 *   --type       Optional. Backup type: daily (default), weekly, monthly.
 *   --dry-run    Optional. List available backups without restoring.
 *   --force      Optional. Skip the confirmation prompt (use with caution).
 *
 * Environment Variables Required:
 *   CLOUDFLARE_R2_ACCESS_KEY_ID
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY
 *   CLOUDFLARE_R2_ENDPOINT
 *   CLOUDFLARE_R2_BUCKET_NAME
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (or DATABASE_URL)
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { execSync } from "child_process";
import { createWriteStream, unlinkSync, existsSync, createReadStream } from "fs";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import { Readable } from "stream";
import { join } from "path";
import { createInterface } from "readline";
import { Pool } from "pg";

// ============================================================
// Configuration
// ============================================================

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT!;
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
const R2_PREFIX = "backups/db/";

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
// Argument Parsing
// ============================================================

interface CliArgs {
  date: string;
  type: "daily" | "weekly" | "monthly";
  dryRun: boolean;
  force: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    date: "",
    type: "daily",
    dryRun: false,
    force: false,
  };

  for (const arg of args) {
    if (arg.startsWith("--date=")) {
      result.date = arg.replace("--date=", "");
    } else if (arg.startsWith("--type=")) {
      const t = arg.replace("--type=", "") as "daily" | "weekly" | "monthly";
      if (["daily", "weekly", "monthly"].includes(t)) {
        result.type = t;
      }
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--force") {
      result.force = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  if (!result.date) {
    console.error("[RESTORE] Error: --date=YYYY-MM-DD is required.");
    printUsage();
    process.exit(1);
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
    console.error(`[RESTORE] Error: Invalid date format "${result.date}". Expected YYYY-MM-DD.`);
    process.exit(1);
  }

  return result;
}

function printUsage(): void {
  console.log(`
Usage: npx tsx scripts/backup/restore.ts --date=YYYY-MM-DD [options]

Options:
  --date=YYYY-MM-DD   Required. The backup date to restore.
  --type=TYPE         Backup type: daily (default), weekly, monthly
  --dry-run           List available backups without restoring.
  --force             Skip confirmation prompt (use with caution).
  --help, -h          Show this help message.

Examples:
  # Restore daily backup from 2026-09-15
  npx tsx scripts/backup/restore.ts --date=2026-09-15

  # Restore weekly backup from 2026-09-14
  npx tsx scripts/backup/restore.ts --date=2026-09-14 --type=weekly

  # List available backups (dry run)
  npx tsx scripts/backup/restore.ts --date=2026-09-15 --dry-run
`);
}

// ============================================================
// Database Connection
// ============================================================

function getDbConfig() {
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

function getPool() {
  const db = getDbConfig();
  return new Pool({
    host: db.host,
    port: db.port,
    user: db.user,
    database: db.database,
    password: db.password,
    max: 1,
  });
}

// ============================================================
// Find backup on R2
// ============================================================

async function findBackup(
  date: string,
  type: "daily" | "weekly" | "monthly"
): Promise<string | null> {
  // Try exact match first
  const exactKey = `${R2_PREFIX}gurupro-backup-${date}-${type}.sql.gz`;

  // If daily not found, try weekly and monthly
  const typesToTry: Array<"daily" | "weekly" | "monthly"> =
    type === "daily"
      ? ["daily", "weekly", "monthly"]
      : type === "weekly"
      ? ["weekly", "monthly", "daily"]
      : ["monthly", "weekly", "daily"];

  for (const t of typesToTry) {
    const key = `${R2_PREFIX}gurupro-backup-${date}-${t}.sql.gz`;
    try {
      await r2Client.send(
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
      );
      console.log(`[RESTORE] Found backup: ${key}`);
      return key;
    } catch {
      // Not found, try next
    }
  }

  // List all backups and find closest
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
        if (obj.Key && obj.Key.includes(date) && obj.Key.endsWith(".sql.gz")) {
          console.log(`[RESTORE] Found backup: ${obj.Key}`);
          return obj.Key;
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return null;
}

// ============================================================
// Download backup from R2
// ============================================================

async function downloadFromR2(key: string, outputPath: string): Promise<void> {
  console.log(`[RESTORE] Downloading ${key} to ${outputPath}...`);

  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error("Empty response from R2");
  }

  const writeStream = createWriteStream(outputPath);
  await pipeline(Readable.fromWeb(response.Body as any), writeStream);
  console.log(`[RESTORE] Download complete: ${outputPath}`);
}

// ============================================================
// Decompress .gz file
// ============================================================

async function decompressGz(gzPath: string, outputPath: string): Promise<void> {
  console.log(`[RESTORE] Decompressing ${gzPath}...`);
  const gunzip = createGunzip();
  const source = createReadStream(gzPath);
  const dest = createWriteStream(outputPath);
  await pipeline(source, gunzip, dest);
  console.log(`[RESTORE] Decompressed to: ${outputPath}`);
}

// ============================================================
// Run pg_restore
// ============================================================

function runPgRestore(dumpPath: string): void {
  const db = getDbConfig();
  const tmpDir = process.env.TMPDIR || process.env.TEMP || "/tmp";

  console.log("[RESTORE] WARNING: This will overwrite the current database!");
  console.log(`[RESTORE] Target: ${db.database}@${db.host}:${db.port}`);

  // Terminate existing connections to the database
  const pool = getPool();
  pool.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [db.database]
  ).catch((err) => {
    console.warn("[RESTORE] Could not terminate existing connections:", err.message);
  });
  pool.end();

  // Build pg_restore command
  const env = {
    ...process.env,
    PGPASSWORD: db.password,
  };

  const cmd = [
    `pg_restore`,
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--username=${db.user}`,
    `--dbname=${db.database}`,
    `--clean`,          // Drop existing objects before recreating
    `--if-exists`,      // Don't error if objects don't exist
    `--no-owner`,
    `--no-acl`,
    `--jobs=4`,         // Parallel restore for speed
    `--file=${tmpDir}/pg_restore_output.txt`,
    dumpPath,
  ];

  console.log("[RESTORE] Starting pg_restore...");
  execSync(cmd.join(" "), { env, stdio: "inherit" });
  console.log("[RESTORE] pg_restore complete.");
}

// ============================================================
// Confirmation Prompt
// ============================================================

async function confirmRestore(backupKey: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `\n[RESTORE] CONFIRM: This will DESTROY all current data in the database and restore from:\n` +
      `[RESTORE]   ${backupKey}\n` +
      `[RESTORE] Type "YES" to proceed: `,
      (answer) => {
        rl.close();
        resolve(answer.trim().toUpperCase() === "YES");
      }
    );
  });
}

// ============================================================
// Main
// ============================================================

async function main() {
  const args = parseArgs();

  console.log("[RESTORE] Database Restore Script");
  console.log(`[RESTORE] Date: ${args.date}, Type: ${args.type}`);

  // Validate environment
  const required = [
    "CLOUDFLARE_R2_BUCKET_NAME",
    "CLOUDFLARE_R2_ENDPOINT",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`[RESTORE] Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  try {
    // Step 1: Find backup on R2
    const backupKey = await findBackup(args.date, args.type);

    if (!backupKey) {
      console.error(
        `[RESTORE] No backup found for date ${args.date}. ` +
        `Check if the backup file exists in R2 at: ${R2_PREFIX}gurupro-backup-${args.date}-*.sql.gz`
      );
      process.exit(1);
    }

    // Step 2: Dry run — just list the backup
    if (args.dryRun) {
      console.log(`[RESTORE] Dry run: found backup at ${backupKey}`);
      console.log("[RESTORE] No changes were made.");
      return;
    }

    // Step 3: Confirm (unless --force)
    if (!args.force) {
      const confirmed = await confirmRestore(backupKey);
      if (!confirmed) {
        console.log("[RESTORE] Restore cancelled by user.");
        process.exit(0);
      }
    }

    // Step 4: Download from R2
    const tmpDir = process.env.TMPDIR || process.env.TEMP || "/tmp";
    const gzPath = join(tmpDir, `gurupro-backup-${args.date}.sql.gz`);
    const dumpPath = join(tmpDir, `gurupro-backup-${args.date}.sql`);

    await downloadFromR2(backupKey, gzPath);

    // Step 5: Decompress
    await decompressGz(gzPath, dumpPath);

    // Step 6: Restore to database
    runPgRestore(dumpPath);

    // Step 7: Cleanup
    try {
      unlinkSync(gzPath);
      unlinkSync(dumpPath);
    } catch {
      // ignore cleanup errors
    }

    console.log("[RESTORE] Database restore complete!");
  } catch (err) {
    console.error("[RESTORE] Restore failed:", err);
    process.exit(1);
  }
}

main();
