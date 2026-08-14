import { query, logAudit } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getContextFilters } from "@/lib/session";
import { requireSchoolAccess } from "@/lib/school-access";
import { parsePagination, wrapResponse } from "@/lib/pagination";
import { parseSessionCookie } from "@/lib/session-sign";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");
    const classId = searchParams.get("class_id");
    const subjectId = searchParams.get("subject_id");

    if (!schoolId) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    const { userId } = await requireSchoolAccess(schoolId)
    const filters = await getContextFilters(userId);

    const whereClause = !classId || !subjectId
      ? `WHERE a.school_id = $1`
      : `WHERE a.school_id = $1 AND a.class_id = $2 AND a.subject_id = $3`;
    const queryParams = !classId || !subjectId
      ? [schoolId]
      : [schoolId, classId, subjectId];

    const countResult = await query(
      `SELECT COUNT(*) FROM assessments a
       JOIN classes c ON a.class_id = c.id
       JOIN subjects sb ON a.subject_id = sb.id
       JOIN schools s ON a.school_id = s.id
       ${whereClause}`,
      queryParams
    );
    let total = parseInt(countResult.rows[0].count, 10);

    const pagination = parsePagination(searchParams);
    const off = (pagination.page - 1) * pagination.limit;

    const res = await query(
      `SELECT a.*, c.nama_kelas, sb.nama_mapel, s.nama_sekolah
       FROM assessments a
       JOIN classes c ON a.class_id = c.id
       JOIN subjects sb ON a.subject_id = sb.id
       JOIN schools s ON a.school_id = s.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ${pagination.limit} OFFSET ${off}`,
      queryParams
    );

    let rows = res.rows;
    if (filters.assignedMapel.length > 0 || filters.assignedKelas.length > 0) {
      rows = rows.filter((row: any) => {
        const matchMapel = filters.assignedMapel.length === 0 ||
          (row.nama_mapel && filters.assignedMapel.some((m) =>
            row.nama_mapel.toLowerCase().includes(m.toLowerCase())
          ));
        const matchKelas = filters.assignedKelas.length === 0 ||
          (row.nama_kelas && filters.assignedKelas.some((k) =>
            row.nama_kelas.toLowerCase().includes(k.toLowerCase())
          ));
        return matchMapel && matchKelas;
      });
    }

    return NextResponse.json(wrapResponse(rows, total, pagination));
  } catch (error: any) {
    const status = error.message === "Forbidden" ? 403 : error.message === "Unauthorized" ? 401 : 500;
    console.error("Assessments GET error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat asesmen." }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const session = parseSessionCookie(sessionCookie);
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const userId = session.id;

    const { id, school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkm } = await req.json();

    if (!school_id || !class_id || !subject_id || !nama_asesmen || !tipe_asesmen) {
      return NextResponse.json({ error: "school_id, class_id, subject_id, nama_asesmen, dan tipe_asesmen wajib diisi" }, { status: 400 });
    }

    const kkmVal = kkm !== undefined ? Number(kkm) : 70;

    if (id) {
      // Update
      await query(
        `UPDATE assessments
         SET nama_asesmen = $1, tipe_asesmen = $2, kkm = $3
         WHERE id = $4 AND school_id = $5`,
        [nama_asesmen, tipe_asesmen, kkmVal, id, school_id]
      );
      await logAudit(userId, "UPDATE_ASSESSMENT", `Memperbarui asesmen: ${nama_asesmen}`);
      return NextResponse.json({ success: true, id });
    } else {
      // Insert
      const insertRes = await query(
        `INSERT INTO assessments (school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkm)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [school_id, class_id, subject_id, nama_asesmen, tipe_asesmen, kkmVal]
      );
      const newId = insertRes.rows[0].id;
      await logAudit(userId, "CREATE_ASSESSMENT", `Menambahkan asesmen baru: ${nama_asesmen}`);
      return NextResponse.json({ success: true, id: newId });
    }
  } catch (error: any) {
    console.error("Assessments POST error:", error);
    return NextResponse.json({ error: error.message || "Gagal menyimpan asesmen." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const session = parseSessionCookie(sessionCookie);
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const userId = session.id;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID asesmen wajib diisi" }, { status: 400 });
    }

    const check = await query(
      `SELECT a.nama_asesmen FROM assessments a
       JOIN schools s ON a.school_id = s.id
       LEFT JOIN user_school_assignments usa ON usa."schoolId" = s.id AND usa."userId" = $2
       WHERE a.id = $1 AND (s.user_id = $2 OR usa."userId" = $2)`,
      [id, userId]
    );
    if (check.rows.length > 0) {
      const namaAsesmen = check.rows[0].nama_asesmen;
      await query("DELETE FROM assessments WHERE id = $1", [id]);
      await logAudit(userId, "DELETE_ASSESSMENT", `Menghapus asesmen: ${namaAsesmen}`);
    } else {
      return NextResponse.json({ error: "Asesmen tidak ditemukan atau bukan milik Anda" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Assessments DELETE error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus asesmen." }, { status: 500 });
  }
}
