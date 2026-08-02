/**
 * Zod schemas for Perpustakaan Digital
 */

import { z } from 'zod';

export const libraryItemCreateSchema = z.object({
  categoryId: z.string().uuid(),
  type: z.enum(['pdf', 'audiobook']),
  title: z.string().min(1).max(255),
  author: z.string().max(150).optional(),
  synopsis: z.string().max(500).optional(),
  coverImageKey: z.string().min(1).optional(),
  fileKey: z.string().min(1).optional(),
  pageCount: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
});

export const progressUpdateSchema = z.object({
  itemId: z.string().uuid(),
  progressPercent: z.number().min(0).max(100),
  lastPositionSeconds: z.number().int().min(0).optional(),
  lastPage: z.number().int().min(0).optional(),
  deltaActiveSeconds: z.number().int().min(0).max(3600),
});

export const libraryCategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'slug hanya huruf kecil, angka, dan strip'),
  icon: z.string().max(50).optional(),
  displayOrder: z.number().int().optional(),
});

export type LibraryItemCreate = z.infer<typeof libraryItemCreateSchema>;
export type ProgressUpdate = z.infer<typeof progressUpdateSchema>;
export type LibraryCategoryCreate = z.infer<typeof libraryCategoryCreateSchema>;
