/**
 * Shared and per-feature Zod schemas for API route input validation.
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Shared schemas
// ─────────────────────────────────────────────────────────────

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Matches any PostgreSQL / UUID v4 string */
export const UserId = z.string().regex(UUID_REGEX, 'ID pengguna tidak valid');

/** Matches a plan identifier: UUID or legacy keys like "free", "three_month", etc. */
export const PlanId = z.string().min(1, 'Paket wajib dipilih');

/** Matches a transaction ID string */
export const TransactionId = z.string().min(1, 'ID transaksi wajib diisi');

/** Pagination query params */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Date range query params (inclusive) */
export const DateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal dari harus YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal ke harus YYYY-MM-DD').optional(),
});

// ─────────────────────────────────────────────────────────────
// Checkout
// ─────────────────────────────────────────────────────────────

export const CheckoutBodySchema = z.object({
  /** Plan identifier: UUID (pricing_plans.id) or legacy key ("free", "three_month", etc.) */
  plan: z.string().min(1, 'Paket wajib dipilih'),
  /** User UUID — resolved from session cookie when omitted */
  userId: UserId.optional(),
  /** Required only when plan === "addon" */
  packageId: UserId.optional(),
});

export type CheckoutBody = z.infer<typeof CheckoutBodySchema>;

// ─────────────────────────────────────────────────────────────
// Storage / Files
// ─────────────────────────────────────────────────────────────

export const StorageListQuerySchema = z.object({
  folder_id: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const StorageRenameBodySchema = z.object({
  name: z.string().trim().min(1, 'Nama file wajib diisi'),
});

export const StorageRenameQuerySchema = z.object({
  id: z.string().min(1, 'ID file wajib diisi'),
});

export const StorageDeleteQuerySchema = z.object({
  id: z.string().min(1, 'ID file wajib diisi'),
});

// ─────────────────────────────────────────────────────────────
// AI Chat
// ─────────────────────────────────────────────────────────────

export const AIChatBodySchema = z.object({
  /** The user's chat message */
  message: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(2000, 'Pesan maksimal 2000 karakter'),
  /** Optional session identifier for multi-turn conversations */
  session_id: z.string().optional(),
});

export type AIChatBody = z.infer<typeof AIChatBodySchema>;

export const AIChatListQuerySchema = z.object({
  session_id: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// Auth / Login
// ─────────────────────────────────────────────────────────────

export const LoginBodySchema = z.object({
  identifier: z.string().min(1, 'Email/Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
  checkout_plan: z.string().optional(),
});

export type LoginBody = z.infer<typeof LoginBodySchema>;

// ─────────────────────────────────────────────────────────────
// Attendance
// ─────────────────────────────────────────────────────────────

export const AttendanceCheckInBodySchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  institution_id: z.number().int().positive().optional(),
});

export const AttendanceCheckOutBodySchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const AttendanceTeachingStartBodySchema = z.object({
  kelas_id: z.number().int().positive(),
  mapel_id: z.number().int().positive().optional(),
  jam_ke: z.number().int().positive().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const AttendanceTeachingEndBodySchema = z.object({
  kelas_id: z.number().int().positive(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// ─────────────────────────────────────────────────────────────
// Journal / Rapor
// ─────────────────────────────────────────────────────────────

export const JournalSchema = z.object({
  kelas_id: z.number().int().positive('ID kelas wajib diisi'),
  mapel_id: z.number().int().positive().optional(),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  jam_ke: z.number().int().positive().optional(),
  topik: z.string().trim().min(1, 'Topik wajib diisi').max(500),
  metode: z.string().trim().max(200).optional(),
  catatan: z.string().max(1000).optional(),
});

export const RaporGenerateSchema = z.object({
  kelas_id: z.number().int().positive(),
  semester: z.enum(['ganjil', 'genap']),
  tahun_ajaran: z.string().regex(/^\d{4}\/\d{4}$/, 'Format tahun ajaran harus YYYY/YYYY'),
  jenis_rapor: z.enum(['akhir', 'mid']).default('akhir'),
});
