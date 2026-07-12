import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSession, getContextFilters } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tipe = searchParams.get("tipe");

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const filters = await getContextFilters(userId);

    const schoolId = searchParams.get("school_id");

    let res;
    if (tipe) {
      if (schoolId) {
        res = await query(
          `SELECT * FROM guru_administrasi 
           WHERE user_id = $1 AND tipe_dokumen = $2 AND school_id = $3
           ORDER BY created_at DESC`,
          [userId, tipe, schoolId]
        );
      } else {
        res = await query(
          `SELECT * FROM guru_administrasi 
           WHERE user_id = $1 AND tipe_dokumen = $2 
           ORDER BY created_at DESC`,
          [userId, tipe]
        );
      }
    } else {
      if (schoolId) {
        res = await query(
          `SELECT * FROM guru_administrasi 
           WHERE user_id = $1 AND school_id = $2
           ORDER BY created_at DESC`,
          [userId, schoolId]
        );
      } else {
        res = await query(
          `SELECT * FROM guru_administrasi 
           WHERE user_id = $1 
           ORDER BY created_at DESC`,
          [userId]
        );
      }
    }

    let rows = res.rows;

    if (filters.institutionId && (filters.assignedMapel.length > 0 || filters.assignedKelas.length > 0)) {
      rows = rows.filter((row: any) => {
        const matchMapel = filters.assignedMapel.length === 0 ||
          (row.mata_pelajaran && filters.assignedMapel.some((m) =>
            row.mata_pelajaran.toLowerCase().includes(m.toLowerCase())
          ));
        const matchKelas = filters.assignedKelas.length === 0 ||
          (row.kelas && filters.assignedKelas.some((k) =>
            row.kelas.toLowerCase().includes(k.toLowerCase())
          ));
        return matchMapel && matchKelas;
      });
    }

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Administrasi GET API error:", error);
    return NextResponse.json({ error: error.message || "Gagal mengambil data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, tipe_dokumen, judul_dokumen, konten, tanggal_kegiatan, school_id, subject_id } = body;

    if (!tipe_dokumen || !judul_dokumen || !konten) {
      return NextResponse.json({ error: "Keterangan tipe, judul, dan konten wajib diisi" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const getJakartaDateString = () => {
      const d = new Date();
      try {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(d);
      } catch (e) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    };

    const docId = id || crypto.randomUUID();
    const tanggalVal = tanggal_kegiatan || getJakartaDateString();

    // Cek apakah data sudah ada (UPSERT)
    const existing = await query("SELECT id FROM guru_administrasi WHERE id = $1 AND user_id = $2", [docId, userId]);

    if (existing.rows.length > 0) {
      await query(
        `UPDATE guru_administrasi 
         SET judul_dokumen = $1, konten = $2, tanggal_kegiatan = $3, school_id = COALESCE($4, school_id), subject_id = COALESCE($5, subject_id), created_at = NOW() 
         WHERE id = $6 AND user_id = $7`,
        [judul_dokumen, JSON.stringify(konten), tanggalVal, school_id || null, subject_id || null, docId, userId]
      );
    } else {
      await query(
        `INSERT INTO guru_administrasi (id, user_id, tipe_dokumen, judul_dokumen, konten, tanggal_kegiatan, school_id, subject_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [docId, userId, tipe_dokumen, judul_dokumen, JSON.stringify(konten), tanggalVal, school_id || null, subject_id || null]
      );
    }

    return NextResponse.json({ success: true, id: docId });
  } catch (error: any) {
    console.error("Administrasi POST API error:", error);
    return NextResponse.json({ error: error.message || "Gagal menyimpan data" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID dokumen wajib diisi" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    await query("DELETE FROM guru_administrasi WHERE id = $1 AND user_id = $2", [id, userId]);

    return NextResponse.json({ success: true, message: "Dokumen berhasil dihapus." });
  } catch (error: any) {
    console.error("Administrasi DELETE API error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus data" }, { status: 500 });
  }
}
