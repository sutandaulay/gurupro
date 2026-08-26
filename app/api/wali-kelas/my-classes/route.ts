import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { getPayload } from '@/lib/payload';
import { parseSessionCookie } from '@/lib/session-sign';
import { captureError, errorResponse } from '@/lib/api-error';

/**
 * GET /api/wali-kelas/my-classes
 * Returns classes where current user is the homeroom teacher (wali kelas),
 * covering BOTH:
 *  - classes.wali_kelas_user_id (set from Master Data checkbox) — works for
 *    both individual teachers AND institution teachers who set themselves.
 *  - wali_kelas_assignments.wali_kelas_member_id (assignment module, active only)
 *    — works ONLY for institution members where the member ID is properly resolved.
 *
 * Previously this endpoint compared session.id (users UUID) directly against
 * wali_kelas_member_id which stores institution_members.id (Payload UUID) —
 * two completely different UUID spaces, so the assignment path never matched
 * for institution members.
 *
 * The fix resolves institution_members.id via Payload lookup using
 * appUserId = session.id, then uses that correct Payload UUID to filter.
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    const userId = session.id;

    // Path A — Always available: classes.wali_kelas_user_id = users.id (direct FK).
    // This covers:
    //  - Individual teachers who set themselves as wali kelas via Master Data.
    //  - Institution teachers who also set themselves via Master Data.
    const classesByUserId = await query(
      `SELECT c.id, c.nama_kelas
       FROM classes c
       WHERE c.wali_kelas_user_id = $1
       ORDER BY c.nama_kelas ASC`,
      [userId]
    );

    // Path B — Institution mode only: resolve institution_members.id from Payload,
    // then filter by wali_kelas_assignments.wali_kelas_member_id.
    // If the user has no institution membership, skip this path entirely.
    let classesByAssignment: any[] = [];
    try {
      const payload = await getPayload();
      const memberResult = await payload.find({
        collection: 'institution-members',
        where: {
          appUserId: { equals: userId },
          status: { equals: 'active' },
        },
        limit: 1,
      });

      if (memberResult.docs.length > 0) {
        // memberResult.docs[0].id is the Payload UUID (institution_members.id).
        // This is the correct value to compare against wali_kelas_member_id column.
        const memberId = String(memberResult.docs[0].id);
        const assignRes = await query(
          `SELECT DISTINCT c.id, c.nama_kelas
           FROM wali_kelas_assignments wa
           JOIN classes c ON c.id = wa.kelas_id
           WHERE wa.wali_kelas_member_id = $1 AND wa.status = 'aktif'
           ORDER BY c.nama_kelas ASC`,
          [memberId]
        );
        classesByAssignment = assignRes.rows;
      }
    } catch {
      // Payload lookup failed or no institution membership — skip assignment path.
    }

    // Merge both paths, deduplicate by class id.
    const seen = new Set<string>();
    const merged: Array<{ id: string; nama_kelas: string }> = [];
    for (const row of [...classesByUserId.rows, ...classesByAssignment]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push({ id: row.id, nama_kelas: row.nama_kelas });
      }
    }

    // Sort alphabetically.
    merged.sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas));

    return NextResponse.json({ data: merged });
  } catch (error: any) {
    captureError(error, { route: '/api/wali-kelas/my-classes' });
    return NextResponse.json(errorResponse(error, 'Gagal mengambil data kelas'));
  }
}
