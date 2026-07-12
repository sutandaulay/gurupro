/**
 * File 01: Relasi Wali Kelas - TypeScript Types & Zod Schemas
 * Purpose: Define types for wali_kelas_assignments table
 */

import { z } from 'zod';

// =====================================================
// Zod Schemas
// =====================================================

/**
 * Schema for creating a new wali kelas assignment
 */
export const CreateWaliKelasAssignmentSchema = z.object({
  kelasId: z.string().uuid('Invalid kelas ID format'),
  waliKelasMemberId: z.string().uuid('Invalid member ID format'),
  tahunAjaran: z.string().regex(
    /^\d{4}\/\d{4}$/,
    'Format tahun ajaran harus YYYY/YYYY, contoh: 2025/2026'
  ),
  semester: z.enum(['ganjil', 'genap']),
  ditugaskanOleh: z.string().uuid('Invalid user ID format').optional(),
});

export type CreateWaliKelasAssignment = z.infer<typeof CreateWaliKelasAssignmentSchema>;

/**
 * Schema for updating assignment status (activate/deactivate)
 */
export const UpdateWaliKelasAssignmentStatusSchema = z.object({
  id: z.string().uuid('Invalid assignment ID format'),
  status: z.enum(['aktif', 'nonaktif']),
});

export type UpdateWaliKelasAssignmentStatus = z.infer<typeof UpdateWaliKelasAssignmentStatusSchema>;

/**
 * Schema for querying assignments
 */
export const GetWaliKelasAssignmentsSchema = z.object({
  kelasId: z.string().uuid().optional(),
  waliKelasMemberId: z.string().uuid().optional(),
  tahunAjaran: z.string().regex(/^\d{4}\/\d{4}$/).optional(),
  semester: z.enum(['ganjil', 'genap']).optional(),
  status: z.enum(['aktif', 'nonaktif']).optional(),
  includeGuru: z.boolean().default(false),
});

export type GetWaliKelasAssignments = z.infer<typeof GetWaliKelasAssignmentsSchema>;

/**
 * Full assignment schema (for responses)
 */
export const WaliKelasAssignmentSchema = z.object({
  id: z.string().uuid(),
  kelasId: z.string().uuid(),
  waliKelasMemberId: z.string().uuid(),
  tahunAjaran: z.string(),
  semester: z.enum(['ganjil', 'genap']),
  status: z.enum(['aktif', 'nonaktif']),
  ditugaskanPada: z.date(),
  ditugaskanOleh: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type WaliKelasAssignment = z.infer<typeof WaliKelasAssignmentSchema>;

/**
 * Assignment with guru details (for UI display)
 */
export const WaliKelasAssignmentWithGuruSchema = WaliKelasAssignmentSchema.extend({
  guru: z.object({
    id: z.string(),
    nama: z.string(),
    email: z.string().optional(),
    whatsapp: z.string().optional(),
  }).nullable(),
  kelas: z.object({
    id: z.string(),
    namaKelas: z.string(),
    schoolId: z.string(),
  }),
});

export type WaliKelasAssignmentWithGuru = z.infer<typeof WaliKelasAssignmentWithGuruSchema>;

// =====================================================
// Database Row Types (raw from PostgreSQL)
// =====================================================

export interface WaliKelasAssignmentRow {
  id: string;
  kelas_id: string;
  wali_kelas_member_id: string;
  tahun_ajaran: string;
  semester: 'ganjil' | 'genap';
  status: 'aktif' | 'nonaktif';
  ditugaskan_pada: Date;
  ditugaskan_oleh: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WaliKelasAssignmentWithDetailsRow extends WaliKelasAssignmentRow {
  guru_nama: string | null;
  guru_email: string | null;
  guru_whatsapp: string | null;
  kelas_nama: string | null;
  kelas_school_id: string | null;
}

// =====================================================
// Helper Types
// =====================================================

export type Semester = 'ganjil' | 'genap';
export type AssignmentStatus = 'aktif' | 'nonaktif';

export interface BackfillResult {
  berhasil: number;
  tidakMatch: Array<{
    kelasId: string;
    namaKelas: string;
    waliKelasText: string;
    candidates: number;
  }>;
  errors: Array<{
    kelasId: string;
    error: string;
  }>;
}
