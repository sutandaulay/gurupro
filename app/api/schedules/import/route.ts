import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function verifySchoolOwner(schoolId: string, userId: string) {
  const check = await query(
    "SELECT id FROM schools WHERE id = $1 AND user_id = $2",
    [schoolId, userId]
  );
  if (check.rows.length === 0) {
    throw new Error("Forbidden");
  }
}

async function getUserId() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }
  const session = JSON.parse(sessionCookie);
  return session.id;
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const { school_id, csvContent } = await req.json();

    if (!school_id || !csvContent) {
      return NextResponse.json({ error: "school_id dan csvContent wajib diisi" }, { status: 400 });
    }

    await verifySchoolOwner(school_id, userId);

    // Split CSV into lines
    const lines = csvContent.split(/\r?\n/);
    const parsedSchedules: {
      hari: string;
      jamMulai: string;
      jamSelesai: string;
      namaKelas: string;
      namaMapel: string;
    }[] = [];

    // Find the header row dynamically
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (
        line.includes("hari") &&
        (line.includes("jam") || line.includes("kelas") || line.includes("mapel") || line.includes("pelajaran"))
      ) {
        headerIdx = i;
        break;
      }
    }
    const startIdx = headerIdx !== -1 ? headerIdx + 1 : 0;

    const validDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith("#") || line.startsWith("=") || line.startsWith("-") || line.toLowerCase().startsWith("sep=")) continue;

      // Clean split (detect separator dynamically)
      const separator = line.includes(";") ? ";" : ",";
      const cols = line.split(separator).map((c: string) => c.trim().replace(/^["']|["']$/g, ""));
      if (cols.length >= 5) {
        const hari = cols[0];
        
        // Skip metadata/brand/instruction lines if they get processed
        if (
          hari.toLowerCase().includes("petunjuk") || 
          hari.toLowerCase().includes("tipe dokumen") || 
          hari.toLowerCase().includes("gurupro") ||
          hari.toLowerCase().includes("sekolah:") ||
          hari.toLowerCase().includes("kelas:")
        ) {
          continue;
        }

        // Capitalize day correctly
        const matchedDay = validDays.find((d: string) => d.toLowerCase() === hari.toLowerCase());
        if (!matchedDay) continue; // Skip invalid days

        const jamMulai = cols[1];
        const jamSelesai = cols[2];
        const namaKelas = cols[3];
        const namaMapel = cols[4];

        if (jamMulai && jamSelesai && namaKelas && namaMapel) {
          parsedSchedules.push({
            hari: matchedDay,
            jamMulai,
            jamSelesai,
            namaKelas,
            namaMapel,
          });
        }
      }
    }

    if (parsedSchedules.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada data jadwal valid ditemukan di berkas CSV" },
        { status: 400 }
      );
    }

    // Insert batch into DB inside transaction, creating class/subject if they don't exist
    await query("BEGIN");
    try {
      for (const item of parsedSchedules) {
        // 1. Get or create class
        const classRes = await query(
          "SELECT id FROM classes WHERE school_id = $1 AND LOWER(nama_kelas) = LOWER($2)",
          [school_id, item.namaKelas]
        );
        let classId = "";
        if (classRes.rows.length === 0) {
          const insertClass = await query(
            "INSERT INTO classes (school_id, nama_kelas) VALUES ($1, $2) RETURNING id",
            [school_id, item.namaKelas]
          );
          classId = insertClass.rows[0].id;
        } else {
          classId = classRes.rows[0].id;
        }

        // 2. Get or create subject
        const subjectRes = await query(
          "SELECT id FROM subjects WHERE school_id = $1 AND LOWER(nama_mapel) = LOWER($2)",
          [school_id, item.namaMapel]
        );
        let subjectId = "";
        if (subjectRes.rows.length === 0) {
          const insertSubject = await query(
            "INSERT INTO subjects (school_id, nama_mapel) VALUES ($1, $2) RETURNING id",
            [school_id, item.namaMapel]
          );
          subjectId = insertSubject.rows[0].id;
        } else {
          subjectId = subjectRes.rows[0].id;
        }

        // 3. Insert schedule
        await query(
          `INSERT INTO schedules (school_id, class_id, subject_id, hari, jam_mulai, jam_selesai)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [school_id, classId, subjectId, item.hari, item.jamMulai, item.jamSelesai]
        );
      }
      await query("COMMIT");
    } catch (dbErr: any) {
      await query("ROLLBACK");
      throw dbErr;
    }

    return NextResponse.json({
      success: true,
      message: `${parsedSchedules.length} jadwal berhasil diimpor`,
      count: parsedSchedules.length,
    });
  } catch (error: any) {
    console.error("Schedules import POST error:", error);
    const status =
      error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
