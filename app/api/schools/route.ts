import { query, requireActiveTahunAjaran } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getUserId() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }
  const session = JSON.parse(sessionCookie);
  return session.id;
}

export async function GET() {
  try {
    const userId = await getUserId();
    const schools = await query(
      "SELECT * FROM schools WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
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
    await requireActiveTahunAjaran();
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
      // Insert
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
