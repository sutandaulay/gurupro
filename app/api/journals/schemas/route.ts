import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireSchoolAccess } from "@/lib/school-access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");

    if (!schoolId) {
      return NextResponse.json({ error: "school_id is required" }, { status: 400 });
    }

    await requireSchoolAccess(schoolId);

    const schemas = await query(
      "SELECT * FROM journal_schemas WHERE school_id = $1 ORDER BY created_at DESC",
      [schoolId]
    );
    return NextResponse.json(schemas.rows);
  } catch (error: any) {
    console.error("Journal schemas GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { id, school_id, nama_skema, fields } = await req.json();

    if (!school_id || !nama_skema || !fields) {
      return NextResponse.json({ error: "school_id, nama_skema, dan fields wajib diisi" }, { status: 400 });
    }

    await requireSchoolAccess(school_id);

    const fieldsJson = JSON.stringify(fields);

    if (id) {
      // Update
      const res = await query(
        `UPDATE journal_schemas 
         SET nama_skema = $1, fields = $2 
         WHERE id = $3 AND school_id = $4 
         RETURNING *`,
        [nama_skema.trim(), fieldsJson, id, school_id]
      );
      return NextResponse.json(res.rows[0]);
    } else {
      // Insert
      const res = await query(
        `INSERT INTO journal_schemas (school_id, nama_skema, fields) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [school_id, nama_skema.trim(), fieldsJson]
      );
      return NextResponse.json(res.rows[0]);
    }
  } catch (error: any) {
    console.error("Journal schemas POST error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const schoolId = searchParams.get("school_id");

    if (!id || !schoolId) {
      return NextResponse.json({ error: "id dan school_id wajib diisi" }, { status: 400 });
    }

    await requireSchoolAccess(schoolId);

    await query("DELETE FROM journal_schemas WHERE id = $1 AND school_id = $2", [id, schoolId]);
    return NextResponse.json({ success: true, message: "Skema format jurnal berhasil dihapus" });
  } catch (error: any) {
    console.error("Journal schemas DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
