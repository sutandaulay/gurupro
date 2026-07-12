import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_institutions_jenjang" AS ENUM('SD', 'MI', 'SMP', 'MTs', 'SMA', 'MA', 'SMK', 'Pesantren', 'Lainnya');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_institutions_naungan" AS ENUM('Kemendikbud', 'Kemenag', 'Swasta Lainnya');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_institutions_subscription_tier" AS ENUM('trial', 'basic', 'premium', 'enterprise');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_institutions_approval_layer_config" AS ENUM('single', 'double');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_institutions_status" AS ENUM('active', 'suspended', 'trial');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_institution_members_role" AS ENUM('kepala_sekolah', 'wakasek', 'operator', 'admin_sekolah', 'bendahara', 'guru');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_institution_members_status" AS ENUM('pending', 'active', 'inactive');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "institutions" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "npsn" varchar,
      "jenjang" "public"."enum_institutions_jenjang" NOT NULL,
      "naungan" "public"."enum_institutions_naungan" NOT NULL,
      "subscription_tier" "public"."enum_institutions_subscription_tier" DEFAULT 'trial',
      "academic_year_active" varchar,
      "approval_layer_config" "public"."enum_institutions_approval_layer_config" DEFAULT 'single',
      "status" "public"."enum_institutions_status" DEFAULT 'trial',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "institution_members_role" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "public"."enum_institution_members_role",
      "id" serial PRIMARY KEY NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "institution_members_assigned_mapel" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "mapel" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "institution_members_assigned_kelas" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "kelas" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "institution_members" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "institution_id" integer NOT NULL,
      "status" "public"."enum_institution_members_status" DEFAULT 'pending' NOT NULL,
      "joined_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "institutions_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "institution_members_id" integer;
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "institutions_npsn_idx" ON "institutions" USING btree ("npsn");
    CREATE INDEX IF NOT EXISTS "institutions_updated_at_idx" ON "institutions" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "institutions_created_at_idx" ON "institutions" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "institution_members_role_order_idx" ON "institution_members_role" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "institution_members_role_parent_idx" ON "institution_members_role" USING btree ("parent_id");

    CREATE INDEX IF NOT EXISTS "institution_members_assigned_mapel_order_idx" ON "institution_members_assigned_mapel" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "institution_members_assigned_mapel_parent_id_idx" ON "institution_members_assigned_mapel" USING btree ("_parent_id");

    CREATE INDEX IF NOT EXISTS "institution_members_assigned_kelas_order_idx" ON "institution_members_assigned_kelas" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "institution_members_assigned_kelas_parent_id_idx" ON "institution_members_assigned_kelas" USING btree ("_parent_id");

    CREATE INDEX IF NOT EXISTS "institution_members_user_idx" ON "institution_members" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "institution_members_institution_idx" ON "institution_members" USING btree ("institution_id");
    CREATE INDEX IF NOT EXISTS "institution_members_updated_at_idx" ON "institution_members" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "institution_members_created_at_idx" ON "institution_members" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "user_institution_idx" ON "institution_members" USING btree ("user_id","institution_id");

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_institutions_id_idx" ON "payload_locked_documents_rels" USING btree ("institutions_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_institution_members_id_idx" ON "payload_locked_documents_rels" USING btree ("institution_members_id");
  `);

  await db.execute(sql`
    ALTER TABLE "institution_members_role" DROP CONSTRAINT IF EXISTS "institution_members_role_parent_fk";
    ALTER TABLE "institution_members_role" ADD CONSTRAINT "institution_members_role_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."institution_members"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "institution_members_assigned_mapel" DROP CONSTRAINT IF EXISTS "institution_members_assigned_mapel_parent_id_fk";
    ALTER TABLE "institution_members_assigned_mapel" ADD CONSTRAINT "institution_members_assigned_mapel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."institution_members"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "institution_members_assigned_kelas" DROP CONSTRAINT IF EXISTS "institution_members_assigned_kelas_parent_id_fk";
    ALTER TABLE "institution_members_assigned_kelas" ADD CONSTRAINT "institution_members_assigned_kelas_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."institution_members"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "institution_members" DROP CONSTRAINT IF EXISTS "institution_members_user_id_cms_users_id_fk";
    ALTER TABLE "institution_members" ADD CONSTRAINT "institution_members_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;

    ALTER TABLE "institution_members" DROP CONSTRAINT IF EXISTS "institution_members_institution_id_institutions_id_fk";
    ALTER TABLE "institution_members" ADD CONSTRAINT "institution_members_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_institutions_fk";
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_institutions_fk" FOREIGN KEY ("institutions_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_institution_members_fk";
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_institution_members_fk" FOREIGN KEY ("institution_members_id") REFERENCES "public"."institution_members"("id") ON DELETE cascade ON UPDATE no action;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "institution_members_role" DROP CONSTRAINT IF EXISTS "institution_members_role_parent_fk";
    ALTER TABLE "institution_members_assigned_mapel" DROP CONSTRAINT IF EXISTS "institution_members_assigned_mapel_parent_id_fk";
    ALTER TABLE "institution_members_assigned_kelas" DROP CONSTRAINT IF EXISTS "institution_members_assigned_kelas_parent_id_fk";
    ALTER TABLE "institution_members" DROP CONSTRAINT IF EXISTS "institution_members_user_id_cms_users_id_fk";
    ALTER TABLE "institution_members" DROP CONSTRAINT IF EXISTS "institution_members_institution_id_institutions_id_fk";

    DROP TABLE IF EXISTS "institution_members_role" CASCADE;
    DROP TABLE IF EXISTS "institution_members_assigned_mapel" CASCADE;
    DROP TABLE IF EXISTS "institution_members_assigned_kelas" CASCADE;
    DROP TABLE IF EXISTS "institution_members" CASCADE;
    DROP TABLE IF EXISTS "institutions" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_institutions_jenjang";
    DROP TYPE IF EXISTS "public"."enum_institutions_naungan";
    DROP TYPE IF EXISTS "public"."enum_institutions_subscription_tier";
    DROP TYPE IF EXISTS "public"."enum_institutions_approval_layer_config";
    DROP TYPE IF EXISTS "public"."enum_institutions_status";
    DROP TYPE IF EXISTS "public"."enum_institution_members_role";
    DROP TYPE IF EXISTS "public"."enum_institution_members_status";
  `);
}
