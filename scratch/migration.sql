-- 1. Create ENUM types conditionally
DO $$ BEGIN
  CREATE TYPE "public"."enum_cms_users_role" AS ENUM('admin', 'editor', 'viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."enum__posts_v_version_status" AS ENUM('draft', 'published');
EXCEPTION WHEN duplicate_object THEN null; END $$;

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

DO $$ BEGIN
  CREATE TYPE "public"."enum_footer_content_links_column" AS ENUM('links', 'sekolah');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."enum_footer_content_social_links_platform" AS ENUM('facebook', 'instagram', 'youtube', 'tiktok', 'linkedin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Create new tables if they don't exist
CREATE TABLE IF NOT EXISTS "cms_users_sessions" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "created_at" timestamp(3) with time zone,
  "expires_at" timestamp(3) with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "cms_users" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "password" varchar NOT NULL,
  "role" "enum_cms_users_role" DEFAULT 'editor' NOT NULL,
  "phone" varchar,
  "avatar_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "email" varchar NOT NULL,
  "reset_password_token" varchar,
  "reset_password_expiration" timestamp(3) with time zone,
  "salt" varchar,
  "hash" varchar,
  "login_attempts" numeric DEFAULT 0,
  "lock_until" timestamp(3) with time zone
);

CREATE TABLE IF NOT EXISTS "media" (
  "id" serial PRIMARY KEY NOT NULL,
  "alt" varchar NOT NULL,
  "caption" varchar,
  "file_size" numeric,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "url" varchar,
  "thumbnail_u_r_l" varchar,
  "filename" varchar,
  "mime_type" varchar,
  "filesize" numeric,
  "width" numeric,
  "height" numeric,
  "focal_x" numeric,
  "focal_y" numeric,
  "sizes_thumbnail_url" varchar,
  "sizes_thumbnail_width" numeric,
  "sizes_thumbnail_height" numeric,
  "sizes_thumbnail_mime_type" varchar,
  "sizes_thumbnail_filesize" numeric,
  "sizes_thumbnail_filename" varchar,
  "sizes_card_url" varchar,
  "sizes_card_width" numeric,
  "sizes_card_height" numeric,
  "sizes_card_mime_type" varchar,
  "sizes_card_filesize" numeric,
  "sizes_card_filename" varchar,
  "sizes_hero_url" varchar,
  "sizes_hero_width" numeric,
  "sizes_hero_height" numeric,
  "sizes_hero_mime_type" varchar,
  "sizes_hero_filesize" numeric,
  "sizes_hero_filename" varchar
);

CREATE TABLE IF NOT EXISTS "cms_features" (
  "id" serial PRIMARY KEY NOT NULL,
  "icon" varchar DEFAULT 'IconSparkles' NOT NULL,
  "title" varchar NOT NULL,
  "description" varchar NOT NULL,
  "order" numeric DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "why_points" (
  "id" serial PRIMARY KEY NOT NULL,
  "point" varchar NOT NULL,
  "order" numeric DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar NOT NULL,
  "slug" varchar,
  "description" varchar,
  "post_count" numeric,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar,
  "slug" varchar,
  "author" varchar DEFAULT 'Tim GuruPRO',
  "published_date" timestamp(3) with time zone,
  "category_id" integer,
  "featured_image_id" integer,
  "excerpt" varchar,
  "content" jsonb,
  "status" "enum_posts_status" DEFAULT 'draft',
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "_status" "enum_posts_status" DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS "addon_token_packages" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "token_amount" numeric NOT NULL,
  "price" numeric NOT NULL,
  "is_active" boolean DEFAULT true,
  "sort_order" numeric DEFAULT 0,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "institutions" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "npsn" varchar,
  "jenjang" "enum_institutions_jenjang" NOT NULL,
  "naungan" "enum_institutions_naungan" NOT NULL,
  "subscription_tier" "enum_institutions_subscription_tier" DEFAULT 'trial',
  "academic_year_active" varchar,
  "approval_layer_config" "enum_institutions_approval_layer_config" DEFAULT 'single',
  "status" "enum_institutions_status" DEFAULT 'trial',
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "institution_members_role" (
  "order" integer NOT NULL,
  "parent_id" integer NOT NULL,
  "value" "enum_institution_members_role",
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
  "status" "enum_institution_members_status" DEFAULT 'pending' NOT NULL,
  "joined_at" timestamp(3) with time zone,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "_posts_v" (
  "id" serial PRIMARY KEY NOT NULL,
  "parent_id" integer,
  "version_title" varchar,
  "version_slug" varchar,
  "version_author" varchar DEFAULT 'Tim GuruPRO',
  "version_published_date" timestamp(3) with time zone,
  "version_category_id" integer,
  "version_featured_image_id" integer,
  "version_excerpt" varchar,
  "version_content" jsonb,
  "version_status" "enum__posts_v_version_status" DEFAULT 'draft',
  "version_updated_at" timestamp(3) with time zone,
  "version_created_at" timestamp(3) with time zone,
  "version__status" "enum__posts_v_version_status" DEFAULT 'draft',
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "latest" boolean
);

CREATE TABLE IF NOT EXISTS "payload_kv" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" varchar NOT NULL,
  "data" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "payload_locked_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "global_slug" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payload_locked_documents_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "cms_users_id" integer,
  "media_id" integer,
  "cms_features_id" uuid,
  "why_points_id" uuid,
  "categories_id" integer,
  "posts_id" integer,
  "addon_token_packages_id" uuid,
  "institutions_id" integer,
  "institution_members_id" integer
);

CREATE TABLE IF NOT EXISTS "payload_preferences" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" varchar,
  "value" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payload_preferences_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "cms_users_id" integer
);

CREATE TABLE IF NOT EXISTS "payload_migrations" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar,
  "batch" numeric,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "landing_page_hero_stats" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "number" varchar DEFAULT '50.000+',
  "label" varchar DEFAULT 'Guru Aktif'
);

CREATE TABLE IF NOT EXISTS "landing_page" (
  "id" serial PRIMARY KEY NOT NULL,
  "hero_badge_text" varchar DEFAULT '✨ Didukung VideaClass AI',
  "hero_headline" varchar DEFAULT 'Administrasi Guru Lebih Cepat dengan AI',
  "hero_subheadline" varchar DEFAULT 'GuruPRO AI hadir untuk membantu guru membuat RPP, absensi, jurnal mengajar, hingga rapor — semua dalam satu platform, didukung kecerdasan buatan.',
  "hero_c_t_a_primary_label" varchar DEFAULT 'Mulai Gratis Sekarang',
  "hero_c_t_a_primary_url" varchar DEFAULT '/login?mode=register',
  "hero_c_t_a_secondary_label" varchar DEFAULT 'Lihat Demo',
  "hero_c_t_a_secondary_url" varchar DEFAULT '#demo',
  "seo_title" varchar,
  "seo_description" varchar,
  "og_image_id" integer,
  "updated_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone
);

CREATE TABLE IF NOT EXISTS "footer_content_links" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "label" varchar NOT NULL,
  "url" varchar NOT NULL,
  "column" "enum_footer_content_links_column" DEFAULT 'links' NOT NULL
);

CREATE TABLE IF NOT EXISTS "footer_content_social_links" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "platform" "enum_footer_content_social_links_platform" NOT NULL,
  "url" varchar NOT NULL
);

CREATE TABLE IF NOT EXISTS "footer_content" (
  "id" serial PRIMARY KEY NOT NULL,
  "description" varchar DEFAULT 'Platform administrasi guru berbasis AI untuk membantu guru Indonesia membuat RPP, absensi, jurnal mengajar, hingga rapor dalam satu platform.',
  "contact_email" varchar DEFAULT 'support@gurupro.id',
  "contact_whatsapp" varchar DEFAULT '+62 812-8396-0337',
  "copyright_text" varchar DEFAULT 'GuruPRO AI © 2026. All rights reserved.',
  "updated_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone
);

CREATE TABLE IF NOT EXISTS "chatbot_config" (
  "id" serial PRIMARY KEY NOT NULL,
  "is_enabled" boolean DEFAULT true,
  "welcome_message" varchar DEFAULT 'Halo! Saya asisten AI GuruPRO 👋 Ada yang bisa saya bantu tentang fitur, harga, atau cara daftar GuruPRO AI?',
  "system_prompt" varchar DEFAULT 'Kamu adalah CS assistant GuruPRO AI, platform administrasi keguruan berbasis AI untuk guru Indonesia. Bantu pengguna dengan informasi tentang fitur (RPP AI, absensi, jurnal, rapor, PKG), harga (Rp49.000/bulan), cara daftar, dan pertanyaan umum. Jawab dalam Bahasa Indonesia yang ramah dan profesional. Jika pertanyaan di luar produk GuruPRO, arahkan ke kontak CS manusia di wa.me/6281283960337.',
  "human_c_s_url" varchar DEFAULT 'https://wa.me/6281283960337',
  "updated_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone
);

-- 3. Alter existing tables to add columns that Payload expects if they don't exist
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "published_date" timestamp(3) with time zone;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "featured_image_id" integer;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "_status" "enum_posts_status" DEFAULT 'draft';

ALTER TABLE "why_points" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "cms_features" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "addon_token_packages" ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone DEFAULT now();

-- 4. Alter constraints and indexes
ALTER TABLE "cms_users_sessions" DROP CONSTRAINT IF EXISTS "cms_users_sessions_parent_id_fk";
ALTER TABLE "cms_users_sessions" ADD CONSTRAINT "cms_users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "cms_users" DROP CONSTRAINT IF EXISTS "cms_users_avatar_id_media_id_fk";
ALTER TABLE "cms_users" ADD CONSTRAINT "cms_users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_category_id_categories_id_fk";
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_featured_image_id_media_id_fk";
ALTER TABLE "posts" ADD CONSTRAINT "posts_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "_posts_v" DROP CONSTRAINT IF EXISTS "_posts_v_parent_id_posts_id_fk";
ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "_posts_v" DROP CONSTRAINT IF EXISTS "_posts_v_version_category_id_categories_id_fk";
ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "_posts_v" DROP CONSTRAINT IF EXISTS "_posts_v_version_featured_image_id_media_id_fk";
ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_featured_image_id_media_id_fk" FOREIGN KEY ("version_featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;

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

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_parent_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_cms_users_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_media_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_cms_features_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cms_features_fk" FOREIGN KEY ("cms_features_id") REFERENCES "public"."cms_features"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_why_points_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_why_points_fk" FOREIGN KEY ("why_points_id") REFERENCES "public"."why_points"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_categories_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_posts_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_addon_token_packages_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_addon_token_packages_fk" FOREIGN KEY ("addon_token_packages_id") REFERENCES "public"."addon_token_packages"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_institutions_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_institutions_fk" FOREIGN KEY ("institutions_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_institution_members_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_institution_members_fk" FOREIGN KEY ("institution_members_id") REFERENCES "public"."institution_members"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT IF EXISTS "payload_preferences_rels_parent_fk";
ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT IF EXISTS "payload_preferences_rels_cms_users_fk";
ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "landing_page_hero_stats" DROP CONSTRAINT IF EXISTS "landing_page_hero_stats_parent_id_fk";
ALTER TABLE "landing_page_hero_stats" ADD CONSTRAINT "landing_page_hero_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_page"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "landing_page" DROP CONSTRAINT IF EXISTS "landing_page_og_image_id_media_id_fk";
ALTER TABLE "landing_page" ADD CONSTRAINT "landing_page_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "footer_content_links" DROP CONSTRAINT IF EXISTS "footer_content_links_parent_id_fk";
ALTER TABLE "footer_content_links" ADD CONSTRAINT "footer_content_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "footer_content_social_links" DROP CONSTRAINT IF EXISTS "footer_content_social_links_parent_id_fk";
ALTER TABLE "footer_content_social_links" ADD CONSTRAINT "footer_content_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_content"("id") ON DELETE cascade ON UPDATE no action;

-- 5. Indexes
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
