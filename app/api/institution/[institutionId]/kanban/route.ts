import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { isInstitutionFeatureEnabled } from "@/lib/feature-flags";

// =====================================================
// Kanban Task Management — Kepala Sekolah & Wakasek
// Endpoint BARU dengan tabel BARU (kanban_tasks).
// Tugas internal pimpinan institusi; tidak menyentuh
// tabel modul existing. Gate: flag kanban_tasks + RBAC.
// =====================================================

const LEADER_ROLES = ["kepala_sekolah", "wakasek"];
const VALID_COLUMNS = ["backlog", "in_progress", "done"];
const VALID_PRIORITIES = ["low", "medium", "high"];

async function getLeaderRoles(appUserId: string, institutionId: number): Promise<string[]> {
  const res = await query(
    `SELECT imr.value AS role
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
       AND imr.value = ANY($3)
     GROUP BY imr.value`,
    [appUserId, institutionId, LEADER_ROLES]
  );
  return res.rows.map((r: any) => r.role);
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// Ambil daftar guru/staf di institusi sebagai opsi assignee
async function getAssigneeOptions(instId: number): Promise<any[]> {
  const res = await query(
    `SELECT DISTINCT im.app_user_id AS user_id, u.nama_lengkap AS nama, imr.value AS role
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     JOIN users u ON u.id::text = im.app_user_id
     WHERE im.institution_id = $1 AND im.status = 'active'
     ORDER BY u.nama_lengkap ASC`,
    [instId]
  );
  return res.rows;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) {
      return NextResponse.json({ error: "Invalid institution ID" }, { status: 400 });
    }
    const roles = await getLeaderRoles(session.id, instId);
    if (roles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const featureEnabled = await isInstitutionFeatureEnabled(instId, "kanban_tasks");
    if (!featureEnabled) {
      return NextResponse.json(
        { featureEnabled: false, message: "Kanban Task belum aktif untuk institusi ini." },
        { status: 200 }
      );
    }

    const [tasksRes, assigneeRes] = await Promise.all([
      query(
        `SELECT t.id, t.title, t.description, t.column_key, t.priority, t.due_date,
                t.assignee_id, t.created_by, t.created_at, t.updated_at,
                a.nama_lengkap AS assignee_nama
         FROM kanban_tasks t
         LEFT JOIN users a ON a.id = t.assignee_id
         WHERE t.institution_id = $1
         ORDER BY t.updated_at DESC`,
        [instId]
      ),
      getAssigneeOptions(instId),
    ]);

    const tasks = tasksRes.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      column: r.column_key,
      priority: r.priority,
      due_date: r.due_date ? new Date(r.due_date).toISOString().split("T")[0] : null,
      assignee_id: r.assignee_id,
      assignee_nama: r.assignee_nama || null,
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    const columns = VALID_COLUMNS.map((col) => ({
      key: col,
      count: tasks.filter((t: any) => t.column === col).length,
    }));

    return NextResponse.json({
      featureEnabled: true,
      ts: new Date().toISOString(),
      columns,
      tasks,
      assignees: assigneeRes.map((r: any) => ({
        user_id: r.user_id,
        nama: r.nama,
        role: r.role,
      })),
    });
  } catch (error: any) {
    console.error("Kanban GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) {
      return NextResponse.json({ error: "Invalid institution ID" }, { status: 400 });
    }
    const roles = await getLeaderRoles(session.id, instId);
    if (roles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const featureEnabled = await isInstitutionFeatureEnabled(instId, "kanban_tasks");
    if (!featureEnabled) {
      return NextResponse.json({ error: "Kanban Task belum aktif" }, { status: 403 });
    }

    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Judul tugas wajib diisi" }, { status: 400 });
    }
    const column = VALID_COLUMNS.includes(body.column) ? body.column : "backlog";
    const priority = VALID_PRIORITIES.includes(body.priority) ? body.priority : "medium";
    const description = String(body.description || "").trim();
    let dueDate: string | null = null;
    if (body.due_date && !isNaN(Date.parse(body.due_date))) {
      dueDate = new Date(body.due_date).toISOString().split("T")[0];
    }
    let assigneeId: string | null = null;
    if (body.assignee_id) {
      if (!isValidUUID(body.assignee_id)) {
        return NextResponse.json({ error: "assignee_id tidak valid" }, { status: 400 });
      }
      assigneeId = body.assignee_id;
    }

    const res = await query(
      `INSERT INTO kanban_tasks (institution_id, title, description, column_key, priority, due_date, assignee_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, description, column_key, priority, due_date, assignee_id, created_by, created_at, updated_at`,
      [instId, title, description, column, priority, dueDate, assigneeId, session.id]
    );

    const t = res.rows[0];
    return NextResponse.json({
      success: true,
      task: {
        id: t.id,
        title: t.title,
        description: t.description,
        column: t.column_key,
        priority: t.priority,
        due_date: t.due_date ? new Date(t.due_date).toISOString().split("T")[0] : null,
        assignee_id: t.assignee_id,
        assignee_nama: null,
        created_by: t.created_by,
        created_at: t.created_at,
        updated_at: t.updated_at,
      },
    });
  } catch (error: any) {
    console.error("Kanban POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) {
      return NextResponse.json({ error: "Invalid institution ID" }, { status: 400 });
    }
    const roles = await getLeaderRoles(session.id, instId);
    if (roles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const featureEnabled = await isInstitutionFeatureEnabled(instId, "kanban_tasks");
    if (!featureEnabled) {
      return NextResponse.json({ error: "Kanban Task belum aktif" }, { status: 403 });
    }

    const url = new URL(req.url);
    const taskId = url.searchParams.get("id");
    if (!taskId || !isValidUUID(taskId)) {
      return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
    }

    const body = await req.json();
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const push = (col: string, val: any) => {
      sets.push(`${col} = $${idx++}`);
      params.push(val);
    };

    if (body.column !== undefined) {
      if (!VALID_COLUMNS.includes(body.column)) {
        return NextResponse.json({ error: "column tidak valid" }, { status: 400 });
      }
      push("column_key", body.column);
    }
    if (body.title !== undefined) {
      const title = String(body.title || "").trim();
      if (!title) return NextResponse.json({ error: "Judul tugas tidak boleh kosong" }, { status: 400 });
      push("title", title);
    }
    if (body.description !== undefined) push("description", String(body.description || "").trim());
    if (body.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(body.priority)) {
        return NextResponse.json({ error: "priority tidak valid" }, { status: 400 });
      }
      push("priority", body.priority);
    }
    if (body.due_date !== undefined) {
      let d: string | null = null;
      if (body.due_date && !isNaN(Date.parse(body.due_date))) {
        d = new Date(body.due_date).toISOString().split("T")[0];
      }
      push("due_date", d);
    }
    if (body.assignee_id !== undefined) {
      let a: string | null = null;
      if (body.assignee_id) {
        if (!isValidUUID(body.assignee_id)) {
          return NextResponse.json({ error: "assignee_id tidak valid" }, { status: 400 });
        }
        a = body.assignee_id;
      }
      push("assignee_id", a);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: "Tidak ada field yang diubah" }, { status: 400 });
    }

    params.push(taskId);
    const res = await query(
      `UPDATE kanban_tasks SET ${sets.join(", ")}, updated_at = now()
       WHERE id = $${idx} AND institution_id = $${idx + 1}
       RETURNING id, title, column_key, priority, assignee_id, due_date, updated_at`,
      [...params, instId]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ success: true, task: res.rows[0] });
  } catch (error: any) {
    console.error("Kanban PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) {
      return NextResponse.json({ error: "Invalid institution ID" }, { status: 400 });
    }
    const roles = await getLeaderRoles(session.id, instId);
    if (roles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const featureEnabled = await isInstitutionFeatureEnabled(instId, "kanban_tasks");
    if (!featureEnabled) {
      return NextResponse.json({ error: "Kanban Task belum aktif" }, { status: 403 });
    }

    const url = new URL(req.url);
    const taskId = url.searchParams.get("id");
    if (!taskId || !isValidUUID(taskId)) {
      return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
    }

    const res = await query(
      `DELETE FROM kanban_tasks WHERE id = $1 AND institution_id = $2 RETURNING id`,
      [taskId, instId]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Kanban DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
