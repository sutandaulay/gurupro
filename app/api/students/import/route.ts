import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireSchoolAccess } from "@/lib/school-access";

export async function POST(req: Request) {
  try {
    const { class_id, csvContent } = await req.json();

    if (!class_id || !csvContent) {
      return NextResponse.json({ error: "class_id dan csvContent wajib diisi" }, { status: 400 });
    }

    const classCheck = await query("SELECT school_id FROM classes WHERE id = $1", [class_id]);
    if (!classCheck.rows[0]) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    await requireSchoolAccess(classCheck.rows[0].school_id);

    // Split CSV into lines
    const lines = csvContent.split(/\r?\n/);
    const parsedStudents: { nama: string; nisn: string | null; absen: number | null }[] = [];

    // Find the header row dynamically
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes("nama") && (line.includes("nisn") || line.includes("absen") || line.includes("nomor"))) {
        headerIdx = i;
        break;
      }
    }
    const startIdx = headerIdx !== -1 ? headerIdx + 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith("#") || line.startsWith("=") || line.startsWith("-") || line.toLowerCase().startsWith("sep=")) continue;

      // Clean split (detect separator dynamically)
      const separator = line.includes(";") ? ";" : ",";
      const cols = line.split(separator).map((c: string) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length > 0 && cols[0]) {
        const nama = cols[0];
        const nisn = cols[1] || null;
        const absen = cols[2] ? parseInt(cols[2]) : null;
        
        // Skip metadata/brand/instruction lines if they get processed
        if (
          nama.toLowerCase().includes("petunjuk") || 
          nama.toLowerCase().includes("tipe dokumen") || 
          nama.toLowerCase().includes("gurupro") ||
          nama.toLowerCase().includes("sekolah:") ||
          nama.toLowerCase().includes("kelas:")
        ) {
          continue;
        }

        parsedStudents.push({ nama, nisn, absen: isNaN(Number(absen)) ? null : absen });
      }
    }

    if (parsedStudents.length === 0) {
      return NextResponse.json({ error: "Tidak ada data siswa valid ditemukan di berkas CSV" }, { status: 400 });
    }

    // Insert batch into DB inside a transaction
    await query("BEGIN");
    try {
      for (const student of parsedStudents) {
        await query(
          `INSERT INTO students (class_id, nama_siswa, nisn, nomor_absen)
           VALUES ($1, $2, $3, $4)`,
          [class_id, student.nama, student.nisn, student.absen]
        );
      }
      await query("COMMIT");
    } catch (dbErr: any) {
      await query("ROLLBACK");
      throw dbErr;
    }

    return NextResponse.json({ 
      success: true, 
      message: `${parsedStudents.length} siswa berhasil diimpor`,
      count: parsedStudents.length
    });
  } catch (error: any) {
    console.error("Students import POST error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
