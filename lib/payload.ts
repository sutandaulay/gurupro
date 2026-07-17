import "server-only";

import { getPayload as getPayloadClient } from "payload";
import type { BasePayload } from "payload";
import config from "@payload-config";

let cached: Promise<BasePayload> | null = null;
let cacheError: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute TTL

export async function getPayload(): Promise<BasePayload> {
  const now = Date.now();

  // Return cached promise if available and not expired
  if (cached && (now - cacheTimestamp) < CACHE_TTL) {
    return cached;
  }

  // If we already had an error and it's been less than 30 seconds, don't retry
  if (cacheError && (now - cacheTimestamp) < 30000) {
    throw new Error(cacheError);
  }

  try {
    cached = getPayloadClient({ config });
    cacheTimestamp = now;
    return cached;
  } catch (error: any) {
    cacheError = error.message || "Failed to initialize Payload CMS";
    cacheTimestamp = now;
    throw error;
  }
}

// Timeout wrapper for payload operations
export async function getPayloadWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T | null> {
  try {
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs);
    });
    return await Promise.race([operation(), timeoutPromise]);
  } catch (error) {
    console.warn("[Payload] Operation failed or timed out:", error);
    return null;
  }
}

export async function getLandingPage() {
  const payload = await getPayload();
  const landing = await payload.findGlobal({
    slug: "landing-page",
    depth: 1,
  });
  return landing;
}

export async function getFeatures() {
  const payload = await getPayload();
  const features = await payload.find({
    collection: "cms-features",
    where: { isActive: { equals: true } },
    sort: "order",
  });
  return features.docs;
}

export async function getWhyPoints() {
  const payload = await getPayload();
  const points = await payload.find({
    collection: "why-points",
    where: { isActive: { equals: true } },
    sort: "order",
  });
  return points.docs;
}

export async function getFooterContent() {
  const payload = await getPayload();
  const footer = await payload.findGlobal({
    slug: "footer-content",
  });
  return footer;
}

export async function getChatbotConfig() {
  const payload = await getPayload();
  const chatbot = await payload.findGlobal({
    slug: "chatbot-config",
  });
  return chatbot;
}

export async function getCategories() {
  const payload = await getPayload();
  const cats = await payload.find({
    collection: "categories",
    sort: "title",
    limit: 100,
  });
  return cats.docs;
}

export async function getPosts(args?: {
  category?: string;
  limit?: number;
  page?: number;
}) {
  const payload = await getPayload();
  const where: Record<string, any> = {
    status: { equals: "published" },
  };
  if (args?.category) {
    const cats = await payload.find({
      collection: "categories",
      where: { slug: { equals: args.category } },
      limit: 1,
    });
    if (cats.docs.length > 0) {
      where.category = { equals: cats.docs[0].id };
    }
  }
  const posts = await payload.find({
    collection: "posts",
    where,
    sort: "-publishedDate",
    limit: args?.limit || 12,
    page: args?.page || 1,
    depth: 1,
  });
  return posts;
}

export async function getPostBySlug(slug: string) {
  const payload = await getPayload();
  const posts = await payload.find({
    collection: "posts",
    where: {
      slug: { equals: slug },
      status: { equals: "published" },
    },
    depth: 1,
    limit: 1,
  });
  return posts.docs[0] || null;
}
