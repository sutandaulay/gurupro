# Backup and Disaster Recovery

This directory contains scripts for backing up and restoring the GuruPro PostgreSQL database and R2 storage.

## Prerequisites

### Environment Variables

Ensure the following environment variables are configured in your `.env` file:

```env
# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=gurupro

# Cloudflare R2
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_ENDPOINT=https://abc123.r2.cloudflarestorage.com
CLOUDFLARE_R2_BUCKET_NAME=gurupro-storage
```

Optionally, for secondary backup sync:

```env
R2_SECONDARY_BUCKET_NAME=gurupro-storage-backup
R2_SECONDARY_ENDPOINT=https://def456.r2.cloudflarestorage.com
```

### Required Tools

- **PostgreSQL client** (`pg_dump`, `pg_restore`) must be installed and on `PATH`
  - macOS: `brew install postgresql`
  - Ubuntu/Debian: `apt install postgresql-client`
  - Windows: Install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)

## Scripts

### 1. Database Backup — `db-backup.ts`

Dumps the PostgreSQL database and uploads it to R2.

```bash
npx tsx scripts/backup/db-backup.ts
```

**Output location:** `R2://gurupro-storage/backups/db/gurupro-backup-{YYYY-MM-DD}-{type}.sql.gz`

**Retention policy:**

| Type    | Keep        | Trigger                              |
|---------|-------------|--------------------------------------|
| Daily   | Last 7 days | Every run                            |
| Weekly  | Last 4 weeks| Every Sunday                          |
| Monthly | Last 12 months | 1st of every month                |

The script automatically prunes old backups exceeding these limits after each run.

### 2. R2 Inventory Backup — `r2-backup.ts`

Lists all objects in the primary R2 bucket and uploads a JSON manifest.

```bash
npx tsx scripts/backup/r2-backup.ts
```

**Output location:** `R2://gurupro-storage/backups/r2-manifest/gurupro-r2-manifest-{YYYY-MM-DD}.json`

The manifest includes:
- All object keys, sizes, and last-modified timestamps
- Summary by top-level prefix (e.g. `uploads: 120 objects, 4.2 GB`)

**Optional:** If `R2_SECONDARY_BUCKET_NAME` and `R2_SECONDARY_ENDPOINT` are configured, critical prefixes (`uploads/`, `user-files/`) are also synced to the secondary bucket.

### 3. Database Restore — `restore.ts`

Downloads a backup from R2 and restores it to the database.

```bash
# Restore a specific date (auto-detects type)
npx tsx scripts/backup/restore.ts --date=2026-09-15

# Explicitly specify type
npx tsx scripts/backup/restore.ts --date=2026-09-14 --type=weekly

# Dry run — just list what would be restored
npx tsx scripts/backup/restore.ts --date=2026-09-15 --dry-run

# Skip confirmation prompt (use with caution!)
npx tsx scripts/backup/restore.ts --date=2026-09-15 --force
```

**Safety features:**
- Interactive confirmation prompt by default (type `YES` to proceed)
- Uses `--clean --if-exists` in pg_restore to avoid errors on missing objects
- Automatically terminates existing DB connections before restore

## Automated Backups

### Option A: Vercel Cron Jobs

Add to `vercel.json` or use the Vercel dashboard:

```json
{
  "crons": [
    {
      "path": "/api/cron/backup-db",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/backup-r2",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Create `app/api/cron/backup-db/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// ... run pg_dump and upload to R2 inline
```

### Option B: External Cron (Recommended for Critical Backups)

Use UptimeRobot, Cronitor, or any external cron service to hit the Vercel Cron URLs, or run directly on a server:

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/gurupro && npx tsx scripts/backup/db-backup.ts >> /var/log/gurupro-db-backup.log 2>&1

# Run daily at 3 AM
0 3 * * * cd /path/to/gurupro && npx tsx scripts/backup/r2-backup.ts >> /var/log/gurupro-r2-backup.log 2>&1
```

### Option C: GitHub Actions

```yaml
# .github/workflows/backup.yml
name: Nightly Backup

on:
  schedule:
    - cron: '0 2 * * *'  # 02:00 UTC daily
  workflow_dispatch:       # Manual trigger

jobs:
  backup-db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx tsx scripts/backup/db-backup.ts
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_PORT: ${{ secrets.DB_PORT }}
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
          DB_NAME: ${{ secrets.DB_NAME }}
          CLOUDFLARE_R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          CLOUDFLARE_R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          CLOUDFLARE_R2_ENDPOINT: ${{ secrets.R2_ENDPOINT }}
          CLOUDFLARE_R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
```

## Restoration Guide

### Step 1: Find the backup

```bash
# List backups for a specific date
npx tsx scripts/backup/restore.ts --date=2026-09-15 --dry-run
```

### Step 2: Restore

```bash
npx tsx scripts/backup/restore.ts --date=2026-09-15
```

The script will prompt for confirmation. Type `YES` to proceed.

### Step 3: Verify

```sql
-- Check that data is restored
SELECT COUNT(*) FROM users;
SELECT MAX(updated_at) FROM transactions;
```

## R2 Backup Manifest Structure

```json
{
  "generatedAt": "2026-09-21T02:00:00.000Z",
  "bucket": "gurupro-storage",
  "region": "auto",
  "totalObjects": 1250,
  "totalSizeBytes": 5368709120,
  "summary": {
    "byPrefix": {
      "uploads": { "count": 800, "sizeBytes": 3221225472 },
      "journals": { "count": 300, "sizeBytes": 1073741824 },
      "backups":  { "count": 150, "sizeBytes": 1073741824 }
    }
  },
  "objects": [
    { "key": "uploads/abc123.png", "size": 204800, "lastModified": "2026-09-20T10:00:00.000Z" }
  ]
}
```

## Disaster Recovery Tips

1. **Test restores regularly** — Run `--dry-run` monthly to verify backup integrity
2. **Off-site copies** — Use the secondary bucket or sync to S3 Glacier for extra safety
3. **Point-in-time recovery** — For PostgreSQL, enable `wal_level = archive` and configure continuous archiving to R2 for PITR capability
4. **Monitor backups** — Set up alerts if the cron job fails (use PagerDuty, Slack webhook, etc.)
5. **Encrypt sensitive backups** — Add `--gzip` and consider encrypting with `gpg` before uploading
