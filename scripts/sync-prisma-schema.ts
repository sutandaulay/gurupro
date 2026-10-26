#!/usr/bin/env node
/**
 * Sync Prisma schema from actual database.
 *
 * This script:
 *   1. Backs up the current prisma/schema.prisma to prisma/schema.prisma.backup
 *   2. Runs `prisma db pull` to regenerate the schema from the live DB
 *   3. Runs `prisma generate` to regenerate the client
 *   4. Restores the backup if step 2 or 3 fails
 *
 * Usage:
 *   npx tsx scripts/sync-prisma-schema.ts
 *
 * Schedule with cron (e.g. every Sunday at 3am):
 *   0 3 * * 0 cd /path/to/gurupro && npx tsx scripts/sync-prisma-schema.ts >> logs/prisma-sync.log 2>&1
 */

import { execSync, exec } from "child_process";
import { existsSync, copyFileSync, unlinkSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCHEMA_PATH = join(ROOT, "prisma", "schema.prisma");
const BACKUP_PATH = join(ROOT, "prisma", "schema.prisma.backup");
const LOG_PREFIX = "[sync-prisma-schema]";

function log(msg: string) {
  console.log(`${LOG_PREFIX} ${new Date().toISOString()} ${msg}`);
}

function logError(msg: string) {
  console.error(`${LOG_PREFIX} ERROR ${new Date().toISOString()} ${msg}`);
}

function runCommand(cmd: string, cwd: string = ROOT): string {
  log(`Running: ${cmd}`);
  try {
    const result = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
      env: { ...process.env },
    });
    return result as string;
  } catch (err: any) {
    throw new Error(
      `Command failed (exit ${err.status}):\n  stdout: ${err.stdout?.toString()}\n  stderr: ${err.stderr?.toString()}`
    );
  }
}

function addWarningComment(schemaPath: string) {
  const warning = `// ⚠️ WARNING: This schema is GENERATED from actual DB via \`prisma db pull\`.
// DO NOT edit manually. DO NOT run \`prisma db push\` or \`prisma migrate\`.
// To update: npx prisma db pull --schema=prisma/schema.prisma
// Then: npx prisma generate
// Last synced: ${new Date().toISOString()}

`;

  const content = readFileSync(schemaPath, "utf-8");

  // Remove existing warning block if present
  const withoutOldWarning = content.replace(
    /\/\/ ⚠️ WARNING: This schema is GENERATED[\s\S]*?Last synced: .*\n\n/,
    ""
  );

  writeFileSync(schemaPath, warning + withoutOldWarning, "utf-8");
  log("Warning comment prepended to schema.");
}

async function main() {
  log("Starting Prisma schema sync...");

  // Step 0: Check DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    logError("DATABASE_URL environment variable is not set. Aborting.");
    process.exit(1);
  }

  // Step 1: Backup existing schema
  if (existsSync(SCHEMA_PATH)) {
    copyFileSync(SCHEMA_PATH, BACKUP_PATH);
    log(`Backup created: ${BACKUP_PATH}`);
  } else {
    logError(`Schema file not found at ${SCHEMA_PATH}. Aborting.`);
    process.exit(1);
  }

  let pullSuccess = false;
  let generateSuccess = false;

  try {
    // Step 2: Pull schema from database
    log("Pulling schema from database...");
    try {
      runCommand(`npx prisma db pull --schema="${SCHEMA_PATH}" --force`);
      pullSuccess = true;
      log("Schema pull completed successfully.");
    } catch (err: any) {
      pullSuccess = false;
      logError(`Schema pull failed: ${err.message}`);
      throw err; // Will be caught below for cleanup
    }

    // Step 3: Prepend warning comment to the new schema
    if (pullSuccess) {
      try {
        addWarningComment(SCHEMA_PATH);
      } catch (err: any) {
        logError(`Failed to add warning comment: ${err.message}`);
        // Non-fatal — continue
      }
    }

    // Step 4: Generate Prisma client
    log("Generating Prisma client...");
    try {
      runCommand(`npx prisma generate --schema="${SCHEMA_PATH}"`);
      generateSuccess = true;
      log("Prisma client generated successfully.");
    } catch (err: any) {
      generateSuccess = false;
      logError(`Prisma generate failed: ${err.message}`);
      // Restore backup
      log("Restoring schema backup due to generate failure...");
      copyFileSync(BACKUP_PATH, SCHEMA_PATH);
      log("Schema restored from backup.");
      throw err;
    }
  } catch (err: any) {
    // Cleanup: restore backup on any failure
    if (!generateSuccess && existsSync(BACKUP_PATH)) {
      try {
        copyFileSync(BACKUP_PATH, SCHEMA_PATH);
        log("Schema restored from backup after failure.");
      } catch (_) {
        logError("Failed to restore backup. Manual intervention may be required.");
      }
    }

    // Clean up backup file (keep the timestamped ones for reference)
    try {
      if (existsSync(BACKUP_PATH)) {
        unlinkSync(BACKUP_PATH);
        log("Temporary backup file cleaned up.");
      }
    } catch (_) {}

    logError("Sync FAILED. See errors above.");
    process.exit(1);
  }

  // Step 5: Success — keep backup for reference but mark it
  const successBackupPath = join(
    ROOT,
    "prisma",
    `schema.prisma.backup.${new Date().toISOString().replace(/[:.]/g, "-")}`
  );
  try {
    copyFileSync(BACKUP_PATH, successBackupPath);
    log(`Previous schema saved to: ${successBackupPath}`);
  } catch (_) {}

  try {
    if (existsSync(BACKUP_PATH)) {
      unlinkSync(BACKUP_PATH);
    }
  } catch (_) {}

  log("Sync completed successfully.");
  process.exit(0);
}

main().catch((err) => {
  logError(`Unexpected error: ${err.message}`);
  process.exit(1);
});
