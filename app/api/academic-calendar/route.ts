import { query, logAudit } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Helper: get user ID dari cookie
function getUserId(cookieHeader: string): string | null {
  try {
    const cookies = cookieHeader.split(';').map(c => c.trim())
    const session = cookies.find(c => c.startsWith('gurupro_session='))
    if (!session) return null
    const value = session.split('=')[1] || ''
    const data = JSON.parse(decodeURIComponent(value))
    return data.id || null
  } catch {
    return null
  }
}

// Helper: verify user owns school
async function verifySchoolOwner(schoolId: string, userId: string) {
  const check = await query(
    `SELECT id FROM schools WHERE id = $1 AND user_id = $2`,
    [schoolId, userId]
  );
  if (check.rows.length === 0) {
    throw new Error("Forbidden");
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");

    if (!schoolId) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    const userId = getUserId(req.headers.get('cookie') || '')
    if (!userId) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }

    await verifySchoolOwner(schoolId, userId);

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
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const { id, school_id, event_name, tanggal_mulai, tanggal_selesai, keterangan } = await req.json();

    if (!school_id || !event_name || !tanggal_mulai || !tanggal_selesai) {
      return NextResponse.json({ error: "school_id, event_name, tanggal_mulai, dan tanggal_selesai wajib diisi" }, { status: 400 });
    }

    await verifySchoolOwner(school_id, userId);

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
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID agenda wajib diisi" }, { status: 400 });
    }

    const check = await query("SELECT event_name, school_id FROM academic_calendars WHERE id = $1", [id]);
    if (check.rows.length > 0) {
      const eventName = check.rows[0].event_name;
      const schoolId = check.rows[0].school_id;
      await verifySchoolOwner(schoolId, userId);
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
