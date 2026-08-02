import { query, logAudit } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { uploadBase64ToR2 } from "@/lib/r2";
import { getContextFilters } from "@/lib/session";
import { requireSchoolAccess } from "@/lib/school-access";
import { parsePagination, offset, wrapResponse } from "@/lib/pagination";

async function getUserId() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }
  const session = JSON.parse(sessionCookie);
  return session.id;
}

async function applyContextFilter(rows: any[], filters: { assignedMapel: string[]; assignedKelas: string[] }) {
  if (filters.assignedMapel.length === 0 && filters.assignedKelas.length === 0) return rows;
  return rows.filter((row: any) => {
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

export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const filters = await getContextFilters(userId);
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");
    const pag = parsePagination(searchParams);

    if (!schoolId) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    await requireSchoolAccess(schoolId);

    const schoolOwnerRes = await query("SELECT user_id FROM schools WHERE id = $1", [schoolId]);
    if (schoolOwnerRes.rows.length === 0) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 404 });
    }
    const isOwner = schoolOwnerRes.rows[0].user_id === userId;

    const baseWhere = isOwner
      ? "tj.school_id = $1"
      : "tj.school_id = $1 AND (tj.user_id = $2 OR tj.supervisor_id = $2)";
    const countParams = isOwner ? [schoolId] : [schoolId, userId];

    const countRes = await query(
      `SELECT COUNT(*)::int as total
       FROM teacher_journals tj
       WHERE ${baseWhere}`,
      countParams
    );
    const total = countRes.rows[0].total;

    const selectSQL = `SELECT tj.*, c.nama_kelas, sb.nama_mapel, u.nama_lengkap as nama_guru, us.nama_lengkap as nama_supervisor,
              (SELECT JSON_BUILD_OBJECT('catatan', js.catatan_supervisi, 'rekomendasi', js.rekomendasi, 'status', js.status_persetujuan, 'created_at', js.created_at) 
               FROM journal_supervisions js 
               WHERE js.journal_id = tj.id 
               ORDER BY js.created_at DESC LIMIT 1) as ulasan,
              COALESCE((SELECT COUNT(*)::integer FROM student_attendance sa WHERE sa.schedule_id = tj.schedule_id AND sa.tanggal = tj.tanggal AND sa.status = 'Sakit'), 0) as sakit_count,
              COALESCE((SELECT COUNT(*)::integer FROM student_attendance sa WHERE sa.schedule_id = tj.schedule_id AND sa.tanggal = tj.tanggal AND sa.status = 'Izin'), 0) as izin_count,
              COALESCE((SELECT COUNT(*)::integer FROM student_attendance sa WHERE sa.schedule_id = tj.schedule_id AND sa.tanggal = tj.tanggal AND sa.status = 'Alfa'), 0) as alfa_count,
              COALESCE((SELECT COUNT(*)::integer FROM student_attendance sa WHERE sa.schedule_id = tj.schedule_id AND sa.tanggal = tj.tanggal AND sa.status = 'Hadir'), 0) as hadir_count
       FROM teacher_journals tj
       JOIN classes c ON tj.class_id = c.id
       JOIN subjects sb ON tj.subject_id = sb.id
       JOIN users u ON tj.user_id = u.id
       LEFT JOIN users us ON tj.supervisor_id = us.id`;

    let journals;
    if (isOwner) {
      journals = await query(
        `${selectSQL}
         WHERE tj.school_id = $1
         ORDER BY tj.tanggal DESC, tj.created_at DESC
         LIMIT $2 OFFSET $3`,
        [schoolId, pag.limit, offset(pag)]
      );
    } else {
      journals = await query(
        `${selectSQL}
         WHERE tj.school_id = $1 AND (tj.user_id = $2 OR tj.supervisor_id = $2)
         ORDER BY tj.tanggal DESC, tj.created_at DESC
         LIMIT $3 OFFSET $4`,
        [schoolId, userId, pag.limit, offset(pag)]
      );
    }

    const result = await applyContextFilter(journals.rows, filters);
    return NextResponse.json(wrapResponse(result, total, pag));
  } catch (error: any) {
    console.error("Journals GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const {
      id,
      school_id,
      schedule_id,
      class_id,
      subject_id,
      tanggal,
      materi_pembelajaran,
      tujuan_pembelajaran,
      aktivitas_pembelajaran,
      media_pembelajaran,
      asesmen_pembelajaran,
      refleksi_guru,
      tindak_lanjut,
      evidensi,
      custom_values,
      status,
      supervisor_id,
    } = body;

    if (!school_id || !class_id || !subject_id || !tanggal || !materi_pembelajaran || !tujuan_pembelajaran || !aktivitas_pembelajaran) {
      return NextResponse.json({ error: "Field wajib (sekolah, kelas, mapel, tanggal, materi, tujuan, aktivitas) harus diisi" }, { status: 400 });
    }

    // Process evidence array to upload base64 strings to Cloudflare R2
    const processedEvidensi = [];
    if (Array.isArray(evidensi)) {
      for (const item of evidensi) {
        if (typeof item === 'string' && item.startsWith('data:')) {
          try {
            const r2Url = await uploadBase64ToR2(item, 'journals');
            processedEvidensi.push(r2Url || item);
          } catch (err) {
            console.warn("Failed to upload base64 evidence to R2, keeping original:", err);
            processedEvidensi.push(item);
          }
        } else {
          processedEvidensi.push(item);
        }
      }
    } else if (evidensi) {
      processedEvidensi.push(evidensi);
    }

    const evidensiJson = JSON.stringify(processedEvidensi);
    const customValuesJson = JSON.stringify(custom_values || {});

    if (id) {
      // Verify journal belongs to teacher
      const check = await query("SELECT user_id FROM teacher_journals WHERE id = $1", [id]);
      if (check.rows.length === 0) {
        return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 });
      }
      if (check.rows[0].user_id !== userId) {
        return NextResponse.json({ error: "Forbidden: Hanya pembuat jurnal yang dapat mengubah data" }, { status: 403 });
      }

      const res = await query(
        `UPDATE teacher_journals 
         SET schedule_id = $1, class_id = $2, subject_id = $3, tanggal = $4, materi_pembelajaran = $5, 
             tujuan_pembelajaran = $6, aktivitas_pembelajaran = $7, media_pembelajaran = $8, 
             asesmen_pembelajaran = $9, refleksi_guru = $10, tindak_lanjut = $11, evidensi = $12, 
             custom_values = $13, status = $14, supervisor_id = $15, updated_at = CURRENT_TIMESTAMP
         WHERE id = $16
         RETURNING *`,
        [
          schedule_id || null,
          class_id,
          subject_id,
          tanggal,
          materi_pembelajaran.trim(),
          tujuan_pembelajaran.trim(),
          aktivitas_pembelajaran.trim(),
          media_pembelajaran ? media_pembelajaran.trim() : null,
          asesmen_pembelajaran ? asesmen_pembelajaran.trim() : null,
          refleksi_guru ? refleksi_guru.trim() : null,
          tindak_lanjut ? tindak_lanjut.trim() : null,
          evidensiJson,
          customValuesJson,
          status || "Draft",
          supervisor_id || null,
          id
        ]
      );
      await logAudit(userId, "UPDATE_JOURNAL", `Memperbarui dokumen jurnal kelas: ${materi_pembelajaran}`);
      return NextResponse.json(res.rows[0]);
    } else {
      // Insert new
      const res = await query(
        `INSERT INTO teacher_journals (
          teacher_id, school_id, schedule_id, class_id, subject_id, tanggal, materi_pembelajaran, 
          tujuan_pembelajaran, aktivitas_pembelajaran, media_pembelajaran, asesmen_pembelajaran, 
          refleksi_guru, tindak_lanjut, evidensi, custom_values, status, supervisor_id
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
        RETURNING *`,
        [
          userId,
          school_id,
          schedule_id || null,
          class_id,
          subject_id,
          tanggal,
          materi_pembelajaran.trim(),
          tujuan_pembelajaran.trim(),
          aktivitas_pembelajaran.trim(),
          media_pembelajaran ? media_pembelajaran.trim() : null,
          asesmen_pembelajaran ? asesmen_pembelajaran.trim() : null,
          refleksi_guru ? refleksi_guru.trim() : null,
          tindak_lanjut ? tindak_lanjut.trim() : null,
          evidensiJson,
          customValuesJson,
          status || "Draft",
          supervisor_id || null
        ]
      );
      await logAudit(userId, "CREATE_JOURNAL", `Membuat dokumen jurnal kelas baru: ${materi_pembelajaran}`);
      return NextResponse.json(res.rows[0]);
    }
  } catch (error: any) {
    console.error("Journals POST error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
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

    const check = await query(
      `SELECT tj.user_id FROM teacher_journals tj
       JOIN schools s ON tj.school_id = s.id
       LEFT JOIN user_school_assignments usa ON usa."schoolId" = s.id AND usa."userId" = $2
       WHERE tj.id = $1 AND (s.user_id = $2 OR usa."userId" = $2)`,
      [id, userId]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Jurnal tidak ditemukan atau bukan milik Anda" }, { status: 404 });
    }

    if (check.rows[0].user_id !== userId) {
      return NextResponse.json({ error: "Forbidden: Hanya pembuat jurnal yang dapat menghapus" }, { status: 403 });
    }

    await query("DELETE FROM teacher_journals WHERE id = $1", [id]);
    await logAudit(userId, "DELETE_JOURNAL", `Menghapus dokumen jurnal kelas dengan ID: ${id}`);
    return NextResponse.json({ success: true, message: "Jurnal berhasil dihapus" });
  } catch (error: any) {
    console.error("Journals DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
