import "server-only";
import { query } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BlogCategory {
  id: number;
  title: string;
  slug: string | null;
  description: string | null;
  postCount: number | null;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string | null;
  author: string | null;
  publishedDate: string | null;
  excerpt: string | null;
  content: any;
  status: string | null;
  category: { id: number; title: string; slug: string | null } | null;
  featuredImage: { url: string; alt: string } | null;
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function getBlogCategories(): Promise<BlogCategory[]> {
  const res = await query(
    `SELECT id, title, slug, description, post_count
     FROM payload.categories
     ORDER BY title`
  );
  return res.rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description,
    postCount: r.post_count ? Number(r.post_count) : null,
  }));
}

// ─── Posts list ──────────────────────────────────────────────────────────────

export async function getBlogPosts(args?: {
  category?: string;
  limit?: number;
}): Promise<BlogPost[]> {
  const limit = args?.limit || 12;
  const values: any[] = [limit];
  let categoryFilter = "";

  if (args?.category) {
    categoryFilter = `AND c.slug = $2`;
    values.push(args.category);
  }

  const res = await query(
    `SELECT
       p.id,
       p.title,
       p.slug,
       p.author,
       p.published_date,
       p.excerpt,
       p.status,
       c.id   AS cat_id,
       c.title AS cat_title,
       c.slug  AS cat_slug,
       m.url   AS img_url,
       m.alt   AS img_alt
     FROM payload.posts p
     LEFT JOIN payload.categories c ON c.id = p.category_id
     LEFT JOIN payload.media      m ON m.id = p.featured_image_id
     WHERE p._status = 'published' ${categoryFilter}
     ORDER BY p.published_date DESC NULLS LAST
     LIMIT $1`,
    values
  );

  return res.rows.map(mapRowToPost);
}

// ─── Single post ────────────────────────────────────────────────────────────

export async function getBlogPostBySlug(
  slug: string
): Promise<BlogPost | null> {
  const res = await query(
    `SELECT
       p.id,
       p.title,
       p.slug,
       p.author,
       p.published_date,
       p.excerpt,
       p.content,
       p.status,
       c.id   AS cat_id,
       c.title AS cat_title,
       c.slug  AS cat_slug,
       m.url   AS img_url,
       m.alt   AS img_alt
     FROM payload.posts p
     LEFT JOIN payload.categories c ON c.id = p.category_id
     LEFT JOIN payload.media      m ON m.id = p.featured_image_id
     WHERE p.slug = $1 AND p._status = 'published'
     LIMIT 1`,
    [slug]
  );

  if (res.rows.length === 0) return null;
  return mapRowToPost(res.rows[0]);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapRowToPost(r: any): BlogPost {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    author: r.author,
    publishedDate: r.published_date,
    excerpt: r.excerpt,
    content: r.content ?? null,
    status: r.status,
    category:
      r.cat_id != null
        ? { id: r.cat_id, title: r.cat_title, slug: r.cat_slug }
        : null,
    featuredImage:
      r.img_url != null ? { url: r.img_url, alt: r.img_alt || "" } : null,
  };
}
