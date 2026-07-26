import { query, logAudit } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireSchoolAccess } from "@/lib/school-access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");

    if (!schoolId) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    await requireSchoolAccess(schoolId);

    const res = await query(
      `SELECT * FROM academic_calendars 
       WHERE school_id = $1 
       ORDER BY tanggal_mulai ASC`,
      [schoolId]
    );

    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error("Academic Calendar GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal memuat kalender akademik." }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, school_id, event_name, tanggal_mulai, tanggal_selesai, keterangan } = body;

    if (!school_id || !event_name || !tanggal_mulai || !tanggal_selesai) {
      return NextResponse.json({ error: "school_id, event_name, tanggal_mulai, dan tanggal_selesai wajib diisi" }, { status: 400 });
    }

    const { userId } = await requireSchoolAccess(school_id);

    if (id) {
      await query(
        `UPDATE academic_calendars
         SET event_name = $1, tanggal_mulai = $2, tanggal_selesai = $3, keterangan = $4
         WHERE id = $5 AND school_id = $6`,
        [event_name, tanggal_mulai, tanggal_selesai, keterangan, id, school_id]
      );
      await logAudit(userId, "UPDATE_CALENDAR", `Memperbarui agenda akademik: ${event_name}`);
      return NextResponse.json({ success: true, id });
    } else {
      const insertRes = await query(
        `INSERT INTO academic_calendars (school_id, event_name, tanggal_mulai, tanggal_selesai, keterangan)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [school_id, event_name, tanggal_mulai, tanggal_selesai, keterangan]
      );
      const newId = insertRes.rows[0].id;
      await logAudit(userId, "CREATE_CALENDAR", `Menambahkan agenda akademik baru: ${event_name}`);
      return NextResponse.json({ success: true, id: newId });
    }
  } catch (error: any) {
    console.error("Academic Calendar POST error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal menyimpan agenda akademik." }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID agenda wajib diisi" }, { status: 400 });
    }

    const check = await query("SELECT event_name, school_id FROM academic_calendars WHERE id = $1", [id]);
    if (check.rows.length > 0) {
      const eventName = check.rows[0].event_name;
      const schoolId = check.rows[0].school_id;
      const { userId } = await requireSchoolAccess(schoolId);
      await query("DELETE FROM academic_calendars WHERE id = $1", [id]);
      await logAudit(userId, "DELETE_CALENDAR", `Menghapus agenda akademik: ${eventName}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Academic Calendar DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal menghapus agenda akademik." }, { status });
  }
}
