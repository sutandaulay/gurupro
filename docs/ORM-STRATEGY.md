# ORM & Schema Strategy — GuruPRO

Updated: 2026-10-26

## Background

GuruPRO accesses one PostgreSQL database through three mechanisms:

| Layer | Access | Schema it owns | Primary use |
|-------|--------|----------------|-------------|
| App API | Drizzle (`lib/db.ts`) + raw SQL | `public` | Users, subscriptions, payments, attendance, reports |
| Payload CMS | Payload's own ORM | `payload` | Landing pages, pricing plans, settings, media |
| Prisma | Prisma Client | `public` (read-mostly) | Legacy queries, `payload.config.ts` |

All three share one database (`gurupro_db`). `search_path` is set to `public,payload` on the pool.

## Actual state of the schema (verified 2026-10-26)

- `public` schema: **108 tables**
- `payload` schema: **45 tables**
- `prisma/schema.prisma`: **48 models** — a *partial* view of `public`, last pulled 2026-08-26
- `lib/db.ts` `initDb()`: creates ~73 tables with `CREATE TABLE IF NOT EXISTS`

So Prisma is **not** the source of truth for the database. It models a subset. The app's real
schema is whatever `initDb()` + Payload push have created over time.

## Rules

### 1. Prisma schema is generated, not authored

`prisma/schema.prisma` is produced by `prisma db pull`. It is a convenience artifact for the
legacy Prisma Client call sites — it is not the schema authority.

- Do NOT hand-edit it.
- Do NOT run `prisma db push` — it will drop tables Prisma does not model.
- Do NOT treat `prisma migrate dev` as the change path; it would propose dropping the ~60
  `public` tables Prisma does not model.

To refresh it (destructive to the file, safe to the DB):

```bash
npx prisma db pull --schema=prisma/schema.prisma
npx prisma generate
```

### 2. Adding or changing a table

For tables the app owns, add the DDL to `initDb()` in `lib/db.ts` (alongside the existing
`CREATE TABLE IF NOT EXISTS` blocks) and, where the table is read through Drizzle, add the
matching schema in `lib/schemas/`.

For Payload collections, change the collection in `collections/` and run:

```bash
npm run push:payload
```

### 3. Migration history

`prisma/migrations/` holds 7 migrations. They were applied to the database by hand long before
Prisma tracked them — `_prisma_migrations` did not exist until 2026-10-26, when every migration
was registered with `prisma migrate resolve --applied`.

State as of 2026-10-26:

```
$ npx prisma migrate status
7 migrations found in prisma/migrations
Database schema is up to date!
```

Consequence: `prisma migrate deploy` is a **no-op** against this database. The migrations are
kept as a historical record of how the schema was shaped, not as a replayable path.

If a fresh database is provisioned, create it from `initDb()` + Payload push — not from the
Prisma migration history, which covers only a subset of the schema.

### 4. `scripts/sync-prisma-schema.ts`

Pulls the current DB state into `prisma/schema.prisma` and regenerates the client. Use it after
DDL changes that Prisma call sites depend on. It backs up the schema file first.

## Schema drift prevention

- `lib/db.ts` `initDb()` is idempotent (`IF NOT EXISTS`) and runs on app start.
- `lib/schemas/*.ts` must match the DDL in `initDb()`. Drizzle does not create tables.
- `payload.config.ts` collections must match the `payload` schema — re-run `npm run push:payload`
  after any collection change.
- After a DDL change that Prisma reads, refresh `prisma/schema.prisma` (rule 1).

## API Versioning — Deferred Post-Launch

API versioning (`/api/v1/`) is a pre-launch deferral due to scope (300+ routes). Recommended
post-launch approach:

1. Create `/app/api/v1/` parallel directory structure
2. Move routes one by one as they are updated
3. Maintain `/api/` as alias pointing to `/api/v1/` for backward compatibility
4. Add `api-version: v1` header to all v1 responses

## Payment Gateway Mock Mode

In production (`NODE_ENV=production`), if `default_gateway` is set to `"mock"` or no gateway is
configured, checkout and admin transaction endpoints return HTTP 503 with an error message. Mock
mode should only be used in development/staging.
