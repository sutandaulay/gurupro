import { query, requireActiveTahunAjaran } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookie } from "@/lib/session-sign";

async function getUserId() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session.id;
}

export async function GET() {
  try {
    const userId = await getUserId();
    // Get schools from junction table OR owned schools (multi-school support)
    // Include userId in response for client-side filtering
    const schools = await query(`
      SELECT DISTINCT ON (s.id)
        s.id,
        s.nama_sekolah,
        s.logo,
        s.alamat,
        s.npsn,
        s.nama_kepala_sekolah,
        s.created_at,
        s.user_id,
        CASE WHEN s.user_id = $1 THEN true ELSE false END as is_owner
      FROM schools s
      LEFT JOIN user_school_assignments usa ON usa."schoolId" = s.id AND usa."userId" = $1
      WHERE s.user_id = $1 OR usa."userId" = $1
      ORDER BY s.id, is_owner DESC
    `, [userId]);
    return NextResponse.json(schools.rows);
  } catch (error: any) {
    console.error("Schools GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    // Skip requireActiveTahunAjaran when creating the FIRST school for a user
    // (new individual teachers have no tahun ajaran yet — we create one below).
    // Subsequent school creations still require active tahun ajaran.
    const existingSchool = await query(
      "SELECT id FROM schools WHERE user_id = $1 LIMIT 1",
      [userId]
    );
    if (existingSchool.rows.length > 0 || id) {
      // Has existing school or updating — require active tahun ajaran
      try {
        await requireActiveTahunAjaran();
      } catch {
        return NextResponse.json(
          { error: 'Tidak ada tahun ajaran aktif. Silakan buat dan aktifkan tahun ajaran di menu Pengaturan.' },
          { status: 400 }
        );
      }
    }
    const { 
      id, 
      nama_sekolah, 
      logo, 
      alamat, 
      npsn, 
      nama_kepala_sekolah, 
      nama_pengawas,
      nip_kepala_sekolah,
      nip_pengawas,
      nama_wali_kelas,
      nip_wali_kelas,
      show_ttd_kepala,
      show_ttd_pengawas,
      show_ttd_wali
    } = await req.json();

    if (!nama_sekolah) {
      return NextResponse.json({ error: "Nama sekolah wajib diisi" }, { status: 400 });
    }

    if (!npsn) {
      return NextResponse.json({ error: "NPSN wajib diisi" }, { status: 400 });
    }

    // Check NPSN uniqueness
    const npsnExists = id
      ? await query("SELECT id FROM schools WHERE npsn = $1 AND id != $2 LIMIT 1", [npsn.trim(), id])
      : await query("SELECT id FROM schools WHERE npsn = $1 LIMIT 1", [npsn.trim()]);
    if ((npsnExists.rows[0])) {
      return NextResponse.json({ error: "NPSN sudah terdaftar untuk sekolah lain" }, { status: 409 });
    }

    if (id) {
      // Update
      const res = await query(
        `UPDATE schools 
         SET nama_sekolah = $1, logo = $2, alamat = $3, npsn = $4, nama_kepala_sekolah = $5, nama_pengawas = $6,
             nip_kepala_sekolah = $7, nip_pengawas = $8, nama_wali_kelas = $9, nip_wali_kelas = $10,
             show_ttd_kepala = $11, show_ttd_pengawas = $12, show_ttd_wali = $13
         WHERE id = $14 AND user_id = $15
         RETURNING *`,
        [
          nama_sekolah.trim(),
          logo,
          alamat ? alamat.trim() : null,
          npsn ? npsn.trim() : null,
          nama_kepala_sekolah ? nama_kepala_sekolah.trim() : null,
          nama_pengawas ? nama_pengawas.trim() : null,
          nip_kepala_sekolah ? nip_kepala_sekolah.trim() : null,
          nip_pengawas ? nip_pengawas.trim() : null,
          nama_wali_kelas ? nama_wali_kelas.trim() : null,
          nip_wali_kelas ? nip_wali_kelas.trim() : null,
          show_ttd_kepala !== undefined ? show_ttd_kepala : true,
          show_ttd_pengawas !== undefined ? show_ttd_pengawas : true,
          show_ttd_wali !== undefined ? show_ttd_wali : true,
          id,
          userId
        ]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: "Sekolah tidak ditemukan atau tidak memiliki hak akses" }, { status: 404 });
      }
      return NextResponse.json(res.rows[0]);
    } else {
      // Insert new school
      const res = await query(
        `INSERT INTO schools (
          user_id, nama_sekolah, logo, alamat, npsn, nama_kepala_sekolah, nama_pengawas,
          nip_kepala_sekolah, nip_pengawas, nama_wali_kelas, nip_wali_kelas,
          show_ttd_kepala, show_ttd_pengawas, show_ttd_wali
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          userId,
          nama_sekolah.trim(),
          logo,
          alamat ? alamat.trim() : null,
          npsn ? npsn.trim() : null,
          nama_kepala_sekolah ? nama_kepala_sekolah.trim() : null,
          nama_pengawas ? nama_pengawas.trim() : null,
          nip_kepala_sekolah ? nip_kepala_sekolah.trim() : null,
          nip_pengawas ? nip_pengawas.trim() : null,
          nama_wali_kelas ? nama_wali_kelas.trim() : null,
          nip_wali_kelas ? nip_wali_kelas.trim() : null,
          show_ttd_kepala !== undefined ? show_ttd_kepala : true,
          show_ttd_pengawas !== undefined ? show_ttd_pengawas : true,
          show_ttd_wali !== undefined ? show_ttd_wali : true
        ]
      );
      // Auto-create junction table entry for school owner
      if (res.rows.length > 0) {
        const newSchool = res.rows[0];
        await query(`
          INSERT INTO user_school_assignments (userid, schoolid, tahunajaranid, iswalikelas)
          VALUES ($1, $2, NULL, true)
          ON CONFLICT DO NOTHING
        `, [userId, newSchool.id]);

        // Auto-create and activate a default tahun ajaran for this school
        const tahunSekarang = new Date().getFullYear();
        await query(`
          INSERT INTO tahun_ajaran (nama, tanggal_mulai, tanggal_selesai, semester_type, semester, sekolah_id, is_active, created_by)
          VALUES ($1, $2, $3, 'full', 'ganjil', $4, true, $5)
        `, [
          `${tahunSekarang}/${tahunSekarang + 1}`,
          `${tahunSekarang}-07-15`,
          `${tahunSekarang + 1}-06-30`,
          newSchool.id,
          userId
        ]);
      }
      return NextResponse.json(res.rows[0]);
    }
  } catch (error: any) {
    console.error("Schools POST error:", error);
    const isTaError = error.message?.includes?.('tahun ajaran');
    const status = error.message === "Unauthorized" ? 401 : isTaError ? 400 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Delete junction entries first (cascade should handle this, but be explicit)
    await query('DELETE FROM user_school_assignments WHERE schoolid = $1', [id]);
    await query('DELETE FROM teacher_subject_assignments WHERE schoolid = $1', [id]);
    await query('DELETE FROM teacher_class_assignments WHERE classid = $1', [id]);

    // Then delete the school (user must be owner)
    const res = await query(
      "DELETE FROM schools WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, userId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan atau tidak memiliki hak akses" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Sekolah berhasil dihapus" });
  } catch (error: any) {
    console.error("Schools DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
