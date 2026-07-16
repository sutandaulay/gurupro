import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    // Check if current user is admin
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: "Akses ditolak. Hanya admin yang dapat mengakses." }, { status: 403 });
    }

    // Get all admins
    const result = await query(
      `SELECT id, email, username, nama_lengkap, whatsapp, role, is_active, created_at
       FROM users
       WHERE role IN ('admin', 'super_admin', 'manager')
       ORDER BY created_at DESC`
    );

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching admins:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat daftar admin" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Check if current user is admin
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: "Akses ditolak. Hanya admin yang dapat mengakses." }, { status: 403 });
    }

    const body = await request.json();
    const { action, email, username, nama_lengkap, whatsapp, password, is_active, role: requestedRole } = body;

    // Validate role
    const validRoles = ['super_admin', 'manager'];
    const adminRole = validRoles.includes(requestedRole) ? requestedRole : 'manager';

    // Create new admin
    if (action === "create") {
      if (!email || !password) {
        return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
      }

      // Check if email already exists
      const existingEmail = await query(
        "SELECT id FROM users WHERE email = $1",
        [email.toLowerCase().trim()]
      );

      if (existingEmail.rows.length > 0) {
        return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 });
      }

      // Check if username already exists
      if (username) {
        const existingUsername = await query(
          "SELECT id FROM users WHERE LOWER(username) = $1",
          [username.toLowerCase().trim()]
        );

        if (existingUsername.rows.length > 0) {
          return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 });
        }
      }

      // Hash password
      const bcrypt = await import("bcrypt");
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create admin user
      const result = await query(
        `INSERT INTO users (email, username, password_hash, nama_lengkap, whatsapp, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, email, username, nama_lengkap, whatsapp, role, is_active, created_at`,
        [
          email.toLowerCase().trim(),
          username?.toLowerCase().trim() || null,
          hashedPassword,
          nama_lengkap?.trim() || '',
          whatsapp?.replace(/\D/g, "") || '',
          adminRole,
          is_active !== false
        ]
      );

      return NextResponse.json({
        message: "Admin berhasil ditambahkan!",
        admin: result.rows[0]
      });
    }

    // Update admin
    if (action === "update") {
      if (!email) {
        return NextResponse.json({ error: "Email admin wajib diisi" }, { status: 400 });
      }

      const sets: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (nama_lengkap !== undefined) {
        sets.push(`nama_lengkap = $${idx}`);
        values.push(nama_lengkap?.trim() || null);
        idx++;
      }

      if (whatsapp !== undefined) {
        sets.push(`whatsapp = $${idx}`);
        values.push(whatsapp ? whatsapp.replace(/\D/g, "") : null);
        idx++;
      }

      if (is_active !== undefined) {
        sets.push(`is_active = $${idx}`);
        values.push(is_active);
        idx++;
      }

      if (requestedRole && validRoles.includes(requestedRole)) {
        sets.push(`role = $${idx}`);
        values.push(requestedRole);
        idx++;
      }

      if (password) {
        const bcrypt = await import("bcrypt");
        const hashedPassword = await bcrypt.hash(password, 12);
        sets.push(`password_hash = $${idx}`);
        values.push(hashedPassword);
        idx++;
      }

      if (sets.length === 0) {
        return NextResponse.json({ error: "Tidak ada data yang diubah" }, { status: 400 });
      }

      values.push(email.toLowerCase().trim());

      const result = await query(
        `UPDATE users SET ${sets.join(", ")} WHERE email = $${idx} AND role IN ('admin', 'super_admin', 'manager') RETURNING id, email, username, nama_lengkap, whatsapp, role, is_active`,
        values
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Admin tidak ditemukan" }, { status: 404 });
      }

      return NextResponse.json({
        message: "Admin berhasil diperbarui!",
        admin: result.rows[0]
      });
    }

    // Delete admin
    if (action === "delete") {
      if (!email) {
        return NextResponse.json({ error: "Email admin wajib diisi" }, { status: 400 });
      }

      // Check if this is the last admin
      const adminCount = await query(
        "SELECT COUNT(*) as count FROM users WHERE role IN ('admin', 'super_admin', 'manager')"
      );

      if (parseInt(adminCount.rows[0].count) <= 1) {
        return NextResponse.json({ error: "Tidak dapat menghapus admin terakhir. Setidaknya harus ada 1 admin." }, { status: 400 });
      }

      // Prevent self-deletion
      if (email.toLowerCase().trim() === session.email?.toLowerCase()) {
        return NextResponse.json({ error: "Tidak dapat menghapus akun sendiri" }, { status: 400 });
      }

      const result = await query(
        "DELETE FROM users WHERE email = $1 AND role IN ('admin', 'super_admin', 'manager') RETURNING id",
        [email.toLowerCase().trim()]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Admin tidak ditemukan" }, { status: 404 });
      }

      return NextResponse.json({ message: "Admin berhasil dihapus!" });
    }

    return NextResponse.json({ error: "Action tidak valid" }, { status: 400 });

  } catch (error: any) {
    console.error("Error managing admins:", error);
    return NextResponse.json({ error: error.message || "Terjadi kesalahan server" }, { status: 500 });
  }
}