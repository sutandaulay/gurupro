import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;

  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }

  const session = JSON.parse(sessionCookie);
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
    throw new Error("Forbidden");
  }
}

export async function GET(req: Request) {
  try {
    await verifyAdmin();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    let whereClause = "";
    const params: any[] = [];

    if (q) {
      whereClause = `
        WHERE nama_lengkap ILIKE $1
           OR email ILIKE $1
           OR username ILIKE $1
           OR whatsapp ILIKE $1
      `;
      params.push(`%${q}%`);
    }

    let usersQuery = `
      SELECT id, username, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan,
             quota_poin_total, quota_poin_used, addon_poin, addon_poin_used,
             subscription_start, subscription_end, is_active, created_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const [usersRes, totalRes] = await Promise.all([
      query(usersQuery, params),
      query(`SELECT COUNT(*) AS total FROM users ${whereClause}`, params),
    ]);

    return NextResponse.json({
      users: usersRes.rows,
      total: parseInt(totalRes.rows[0]?.total || "0", 10),
    });
  } catch (error: any) {
    console.error("Admin Users GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin();

    const { userId, username, quota_poin_total, addon_poin, role, subscription_start, subscription_end, status_langganan, is_active, new_password } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const startVal = subscription_start ? new Date(subscription_start) : null;
    const endVal = subscription_end ? new Date(subscription_end) : null;
    const isActiveVal = is_active !== undefined ? is_active : true;
    const cleanUsername = username && username.trim() !== "" ? username.trim().toLowerCase() : null;
    const allowedRoles = new Set(["guru", "admin", "operator", "kepala_sekolah", "pengawas"]);
    const targetRole = allowedRoles.has(role) ? role : "guru";

    if (cleanUsername && !/^[a-z0-9._-]{3,80}$/.test(cleanUsername)) {
      return NextResponse.json({ error: "Username hanya boleh huruf kecil, angka, titik, garis bawah, atau strip, minimal 3 karakter." }, { status: 400 });
    }

    if (cleanUsername) {
      const existingUsername = await query(
        "SELECT id FROM users WHERE LOWER(username) = $1 AND id <> $2",
        [cleanUsername, userId]
      );
      if (existingUsername.rows.length > 0) {
        return NextResponse.json({ error: "Username sudah digunakan pengguna lain." }, { status: 409 });
      }
    }

    if (new_password && new_password.trim() !== "") {
      const hashed = await hashPassword(new_password.trim());
      await query(
        `UPDATE users
         SET username = $1, quota_poin_total = $2, addon_poin = $3, role = $4, subscription_start = $5, subscription_end = $6, status_langganan = $7, is_active = $8, password_hash = $9
         WHERE id = $10`,
        [cleanUsername, parseInt(quota_poin_total) || 0, parseInt(addon_poin) || 0, targetRole, startVal, endVal, status_langganan || "free", isActiveVal, hashed, userId]
      );
    } else {
      await query(
        `UPDATE users
         SET username = $1, quota_poin_total = $2, addon_poin = $3, role = $4, subscription_start = $5, subscription_end = $6, status_langganan = $7, is_active = $8
         WHERE id = $9`,
        [cleanUsername, parseInt(quota_poin_total) || 0, parseInt(addon_poin) || 0, targetRole, startVal, endVal, status_langganan || "free", isActiveVal, userId]
      );
    }

    const updatedUserRes = await query(
      "SELECT id, username, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan, quota_poin_total, quota_poin_used, addon_poin, addon_poin_used, subscription_start, subscription_end, is_active FROM users WHERE id = $1",
      [userId]
    );

    return NextResponse.json(updatedUserRes.rows[0]);
  } catch (error: any) {
    console.error("Admin Users POST error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
