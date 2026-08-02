/**
 * Shared types for Perpustakaan Digital
 */

export interface LibraryItem {
  id: string;
  type: "pdf" | "audiobook";
  title: string;
  author: string | null;
  synopsis: string | null;
  cover_image_key: string;
  page_count: number | null;
  duration_seconds: number | null;
  category_id: string;
  category_name: string;
  category_slug: string;
}

export interface LibraryCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  display_order: number;
  item_count: number;
}

export interface ProgressItem {
  item_id: string;
  progress_percent: number;
  status: string;
  last_page: number | null;
  last_position_seconds: number | null;
  title: string;
  author: string | null;
  type: "pdf" | "audiobook";
  cover_image_key: string;
  page_count: number | null;
  duration_seconds: number | null;
  category_name: string;
}
