import { query } from "@/lib/db";

// Sprint 4.5 — Saran Guru Pengganti (independen, READ-ONLY ke InstitutionMembers).
// Memberi saran guru lain di institusi yang available, berdasarkan penugasan.
// Tidak mengubah alur Leave Request Approval; hanya membaca data member.

export interface SubstituteSuggestion {
  userId: string;
  nama: string;
  whatsapp: string | null;
  mapel: string[];
}

export async function suggestSubstitutes(
  institutionId: number,
  leaveTeacherId: string,
  tanggalMulai: string,
  tanggalSelesai: string
): Promise<SubstituteSuggestion[]> {
  try {
    // Guru lain di institusi yang status aktif & punya role 'guru', bukan pengaju izin
    const res = await query(
      `SELECT DISTINCT u.id, u.nama_lengkap, u.whatsapp
       FROM institution_members im
       JOIN institution_members_role imr ON imr.parent_id = im.id
       JOIN users u ON u.id = im.app_user_id
       WHERE im.institution_id = $1
         AND im.status = 'active'
         AND imr.value = 'guru'
         AND im.app_user_id IS NOT NULL
         AND im.app_user_id != $2`,
      [institutionId, leaveTeacherId]
    );

    const candidates: SubstituteSuggestion[] = [];
    for (const row of res.rows) {
      // Cek apakah guru ini sendiri sedang izin di rentang yang sama (hindari yang berhalangan)
      const benturan = await query(
        `SELECT id FROM leave_requests
         WHERE teacher_id = $1 AND status = 'approved'
           AND ($2 <= end_date::date) AND ($3 >= start_date::date)
         LIMIT 1`,
        [row.id, tanggalMulai, tanggalSelesai]
      );
      if (benturan.rows.length > 0) continue;

      // Mapel yang diampu (dari assignment, jika ada)
      const mapelRes = await query(
        `SELECT subject_ids FROM teacher_institution_assignments
         WHERE teacher_id = $1 AND institution_id = $2 AND status = 'aktif' LIMIT 1`,
        [row.id, institutionId]
      );
      const subjectIds = mapelRes.rows[0]?.subject_ids;
      let mapel: string[] = [];
      if (Array.isArray(subjectIds) && subjectIds.length) {
        const mapelRows = await query(`SELECT nama_mapel FROM subjects WHERE id = ANY($1)`, [subjectIds]);
        mapel = mapelRows.rows.map((m: any) => m.nama_mapel);
      }

      candidates.push({
        userId: row.id,
        nama: row.nama_lengkap || "Guru",
        whatsapp: row.whatsapp || null,
        mapel,
      });
    }

    // Prioritaskan yang punya mapel, lalu batasi 5 saran
    candidates.sort((a, b) => b.mapel.length - a.mapel.length);
    return candidates.slice(0, 5);
  } catch (err) {
    console.error("[Substitute] error:", err);
    return [];
  }
}
