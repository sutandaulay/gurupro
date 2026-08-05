/**
 * File 01: Relasi Wali Kelas - Application Layer Functions
 * Purpose: Business logic for wali_kelas_assignments table
 */

import { query, pool } from '@/lib/db';
import { getPayload } from '@/lib/payload';
import {
  CreateWaliKelasAssignmentSchema,
  UpdateWaliKelasAssignmentStatusSchema,
  GetWaliKelasAssignmentsSchema,
  WaliKelasAssignmentRow,
  WaliKelasAssignmentWithDetailsRow,
  CreateWaliKelasAssignment,
  BackfillResult,
  WaliKelasAssignmentWithGuru,
} from '@/lib/schemas/wali-kelas';

// =====================================================
// Core Assignment Functions
// =====================================================

/**
 * Assign a guru as wali kelas for a class in a specific period
 * Validates:
 * - kelasId exists in classes table
 * - waliKelasMemberId is a valid guru in institution-members (role='guru')
 * - No existing active assignment for the same class+period
 */
export async function assignWaliKelas(input: CreateWaliKelasAssignment): Promise<WaliKelasAssignmentRow> {
  // 1. Validate input
  const validated = CreateWaliKelasAssignmentSchema.parse(input);

  // 2. Validate kelasId exists in classes table
  const kelasResult = await query(
    'SELECT id, school_id FROM classes WHERE id = $1',
    [validated.kelasId]
  );
  if (!kelasResult.rows.length) {
    throw new Error('Kelas tidak ditemukan');
  }
  const kelas = kelasResult.rows[0];

  // 3. Validate waliKelasMemberId is a valid guru in institution-members
  // Note: institution-members is a Payload collection, we query via Payload API
  const payload = await getPayload();
  let member;
  try {
    member = await payload.findByID({
      collection: 'institution-members',
      id: validated.waliKelasMemberId,
    });
  } catch {
    throw new Error('Member tidak ditemukan di institution-members');
  }

  // Check if role includes 'guru'
  const roles = (member.role as string[]) || [];
  if (!roles.includes('guru')) {
    throw new Error('Member bukan guru atau tidak memiliki role guru di institution-members');
  }

  // 4. Check if institution member belongs to the same school
  const memberInstitutionId = (member.institution as any)?.id || member.institution;
  if (memberInstitutionId && kelas.school_id) {
    // Additional validation: check if the institution matches the school
    const institutionCheck = await query(
      'SELECT id FROM institutions WHERE id = $1',
      [memberInstitutionId]
    );
    if (institutionCheck.rows.length === 0) {
      throw new Error('Institution member tidak valid');
    }
  }

  // 5. Check for existing active assignment for this class+period
  const existingResult = await query(
    `SELECT id FROM wali_kelas_assignments
     WHERE kelas_id = $1 AND tahun_ajaran = $2 AND semester = $3 AND status = 'aktif'`,
    [validated.kelasId, validated.tahunAjaran, validated.semester]
  );
  if (existingResult.rows.length > 0) {
    throw new Error(
      'Kelas ini sudah punya wali kelas aktif di periode tersebut. Nonaktifkan dulu yang lama sebelum menugaskan yang baru.'
    );
  }

  // 6. Insert new assignment
  const insertResult = await query(
    `INSERT INTO wali_kelas_assignments
     (kelas_id, wali_kelas_member_id, tahun_ajaran, semester, ditugaskan_oleh)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      validated.kelasId,
      validated.waliKelasMemberId,
      validated.tahunAjaran,
      validated.semester,
      validated.ditugaskanOleh || null,
    ]
  );

  return insertResult.rows[0] as WaliKelasAssignmentRow;
}

/**
 * Deactivate an active assignment and optionally create a new one
 * Used when switching wali kelas mid-period
 */
export async function reassignWaliKelas(
  kelasId: string,
  newWaliKelasMemberId: string,
  tahunAjaran: string,
  semester: 'ganjil' | 'genap',
  ditugaskanOleh?: string
): Promise<WaliKelasAssignmentRow> {
  // 1. Deactivate existing active assignment
  await query(
    `UPDATE wali_kelas_assignments
     SET status = 'nonaktif', updated_at = now()
     WHERE kelas_id = $1 AND tahun_ajaran = $2 AND semester = $3 AND status = 'aktif'`,
    [kelasId, tahunAjaran, semester]
  );

  // 2. Create new assignment
  return assignWaliKelas({
    kelasId,
    waliKelasMemberId: newWaliKelasMemberId,
    tahunAjaran,
    semester,
    ditugaskanOleh,
  });
}

/**
 * Update assignment status (activate/deactivate)
 */
export async function updateWaliKelasStatus(
  assignmentId: string,
  newStatus: 'aktif' | 'nonaktif'
): Promise<WaliKelasAssignmentRow> {
  const validated = UpdateWaliKelasAssignmentStatusSchema.parse({
    id: assignmentId,
    status: newStatus,
  });

  const result = await query(
    `UPDATE wali_kelas_assignments
     SET status = $1, updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [validated.status, validated.id]
  );

  if (!result.rows.length) {
    throw new Error('Assignment tidak ditemukan');
  }

  return result.rows[0] as WaliKelasAssignmentRow;
}

// =====================================================
// Query Functions
// =====================================================

/**
 * Get all assignments with optional filters
 */
export async function getWaliKelasAssignments(
  filters: Partial<{
    kelasId: string;
    waliKelasMemberId: string;
    tahunAjaran: string;
    semester: 'ganjil' | 'genap';
    status: 'aktif' | 'nonaktif';
  }> = {}
): Promise<WaliKelasAssignmentRow[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.kelasId) {
    conditions.push(`kelas_id = $${paramIndex++}`);
    params.push(filters.kelasId);
  }
  if (filters.waliKelasMemberId) {
    conditions.push(`wali_kelas_member_id = $${paramIndex++}`);
    params.push(filters.waliKelasMemberId);
  }
  if (filters.tahunAjaran) {
    conditions.push(`tahun_ajaran = $${paramIndex++}`);
    params.push(filters.tahunAjaran);
  }
  if (filters.semester) {
    conditions.push(`semester = $${paramIndex++}`);
    params.push(filters.semester);
  }
  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT * FROM wali_kelas_assignments ${whereClause} ORDER BY created_at DESC`,
    params
  );

  return result.rows as WaliKelasAssignmentRow[];
}

/**
 * Get assignments with guru and kelas details for UI display
 */
export async function getWaliKelasAssignmentsWithDetails(
  filters: Partial<{
    kelasId: string;
    waliKelasMemberId: string;
    tahunAjaran: string;
    semester: 'ganjil' | 'genap';
    status: 'aktif' | 'nonaktif';
    schoolId: string;
  }> = {}
): Promise<WaliKelasAssignmentWithGuru[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.kelasId) {
    conditions.push(`wa.kelas_id = $${paramIndex++}`);
    params.push(filters.kelasId);
  }
  if (filters.waliKelasMemberId) {
    conditions.push(`wa.wali_kelas_member_id = $${paramIndex++}`);
    params.push(filters.waliKelasMemberId);
  }
  if (filters.tahunAjaran) {
    conditions.push(`wa.tahun_ajaran = $${paramIndex++}`);
    params.push(filters.tahunAjaran);
  }
  if (filters.semester) {
    conditions.push(`wa.semester = $${paramIndex++}`);
    params.push(filters.semester);
  }
  if (filters.status) {
    conditions.push(`wa.status = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.schoolId) {
    conditions.push(`c.school_id = $${paramIndex++}`);
    params.push(filters.schoolId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
       wa.*,
       im_user.nama_lengkap as guru_nama,
       im_user.email as guru_email,
       im_user.whatsapp as guru_whatsapp,
       c.nama_kelas as kelas_nama,
       c.school_id as kelas_school_id
     FROM wali_kelas_assignments wa
     LEFT JOIN classes c ON wa.kelas_id = c.id
      LEFT JOIN institution_members im ON im.id = wa.wali_kelas_member_id
      LEFT JOIN users im_user ON im_user.id::text = im.app_user_id
     ${whereClause}
     ORDER BY wa.created_at DESC`,
    params
  );

  return (result.rows as WaliKelasAssignmentWithDetailsRow[]).map((row) => ({
    id: row.id,
    kelasId: row.kelas_id,
    waliKelasMemberId: row.wali_kelas_member_id,
    tahunAjaran: row.tahun_ajaran,
    semester: row.semester,
    status: row.status,
    ditugaskanPada: row.ditugaskan_pada,
    ditugaskanOleh: row.ditugaskan_oleh,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    guru: row.guru_nama
      ? {
          id: row.wali_kelas_member_id,
          nama: row.guru_nama,
          email: row.guru_email || undefined,
          whatsapp: row.guru_whatsapp || undefined,
        }
      : null,
    kelas: {
      id: row.kelas_id,
      namaKelas: row.kelas_nama || 'Unknown',
      schoolId: row.kelas_school_id || '',
    },
  }));
}

/**
 * Get wali kelas for a specific class and period
 */
export async function getWaliKelasForKelas(
  kelasId: string,
  tahunAjaran: string,
  semester: 'ganjil' | 'genap'
): Promise<WaliKelasAssignmentWithGuru | null> {
  const results = await getWaliKelasAssignmentsWithDetails({
    kelasId,
    tahunAjaran,
    semester,
    status: 'aktif',
  });

  return results.length > 0 ? results[0] : null;
}

/**
 * Get all classes assigned to a specific guru as wali kelas
 */
export async function getKelasForWaliKelas(
  waliKelasMemberId: string,
  tahunAjaran: string,
  semester: 'ganjil' | 'genap'
): Promise<WaliKelasAssignmentWithGuru[]> {
  return getWaliKelasAssignmentsWithDetails({
    waliKelasMemberId,
    tahunAjaran,
    semester,
    status: 'aktif',
  });
}

/**
 * Get list of guru options for a specific school
 * Used for dropdown selection in UI
 */
export async function getGuruOptionsForSchool(
  schoolId: string
): Promise<Array<{ id: string; nama: string; email?: string; whatsapp?: string }>> {
  const payload = await getPayload();

  // Find institution by school_id
  const institutions = await payload.find({
    collection: 'institutions',
    where: {
      schoolId: { equals: schoolId },
    },
    limit: 1,
  });

  if (!institutions.docs.length) {
    return [];
  }

  const institutionId = institutions.docs[0].id;

  // Find all members with role='guru' in this institution
  const members = await payload.find({
    collection: 'institution-members',
    where: {
      and: [
        { institution: { equals: institutionId } },
        { role: { equals: 'guru' } },
        { status: { equals: 'active' } },
      ],
    },
    depth: 1,
  });

  return members.docs
    .map((member) => {
      const user = member.user as any;
      return {
        id: String(member.id),
        nama: String(user?.nama_lengkap || user?.name || 'Unknown'),
        email: user?.email ? String(user.email) : undefined,
        whatsapp: user?.whatsapp ? String(user.whatsapp) : undefined,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

// =====================================================
// Backfill Functions
// =====================================================

/**
 * Backfill existing data from classes.wali_kelas (text field) to wali_kelas_assignments
 * This is a one-time migration script
 */
export async function backfillWaliKelasAssignments(
  tahunAjaran: string,
  semester: 'ganjil' | 'genap'
): Promise<BackfillResult> {
  const result: BackfillResult = {
    berhasil: 0,
    tidakMatch: [],
    errors: [],
  };

  const payload = await getPayload();

  // Get all classes that have wali_kelas text filled
  const classesResult = await query(
    `SELECT id, nama_kelas, school_id, wali_kelas
     FROM classes
     WHERE wali_kelas IS NOT NULL AND wali_kelas != ''`
  );

  for (const row of classesResult.rows) {
    try {
      // Try to match the name to institution-members (by name + school, role='guru')
      // First, find the institution for this school
      const institutions = await payload.find({
        collection: 'institutions',
        where: { schoolId: { equals: row.school_id } },
        limit: 1,
      });

      if (!institutions.docs.length) {
        result.errors.push({
          kelasId: row.id,
          error: `Tidak ditemukan institution untuk school_id ${row.school_id}`,
        });
        continue;
      }

      const institutionId = institutions.docs[0].id;

      // Find guru members with matching name
      const candidates = await payload.find({
        collection: 'institution-members',
        where: {
          and: [
            { institution: { equals: institutionId } },
            { role: { equals: 'guru' } },
            { status: { equals: 'active' } },
          ],
        },
        depth: 1,
      });

      // Filter by name similarity
      const waliNameLower = (row.wali_kelas || '').toLowerCase().trim();
      const matchingCandidates = candidates.docs.filter((member) => {
        const user = member.user as any;
        const userName = (user?.nama_lengkap || user?.name || '').toLowerCase();
        return (
          userName === waliNameLower ||
          userName.includes(waliNameLower) ||
          waliNameLower.includes(userName)
        );
      });

      if (matchingCandidates.length === 1) {
        // Single match - create assignment
        await assignWaliKelas({
          kelasId: String(row.id),
          waliKelasMemberId: String(matchingCandidates[0].id),
          tahunAjaran,
          semester,
          ditugaskanOleh: undefined, // System migration
        });
        result.berhasil++;
      } else {
        // 0 matches or multiple matches - needs manual review
        result.tidakMatch.push({
          kelasId: row.id,
          namaKelas: row.nama_kelas,
          waliKelasText: row.wali_kelas,
          candidates: matchingCandidates.length,
        });
      }
    } catch (err: any) {
      result.errors.push({
        kelasId: row.id,
        error: err.message || 'Unknown error',
      });
    }
  }

  return result;
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Get active tahun ajaran from database
 */
export async function getActiveTahunAjaran(): Promise<{ id: string; nama: string } | null> {
  const result = await query(
    `SELECT id, nama FROM tahun_ajaran WHERE is_active = true LIMIT 1`
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get semester type for current date
 */
export function getCurrentSemester(): 'ganjil' | 'genap' {
  const month = new Date().getMonth();
  // July - December = ganjil (semester 1)
  // January - June = genap (semester 2)
  return month >= 6 ? 'ganjil' : 'genap';
}
