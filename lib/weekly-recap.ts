import { query } from "@/lib/db";

// Sprint 2.1 — Weekly Recap Personal (cron terpisah dari sistem produksi).
// Semua query READ-ONLY terhadap tabel eksisting:
//   teacher_journals (sesi mengajar minggu ini),
//   student_grades (remedial selesai),
//   guru_administrasi tipe 'atp' (progress kurikulum).
// Tidak ada INSERT/UPDATE ke tabel sumber.

export interface RecapData {
  weekStart: string;
  weekEnd: string;
  sesiMengajar: number;
  siswaRemedialSelesai: number;
  progressKurikulum: { mapel: string; progress: number; total: number }[];
}

function awalMingguIni(now = new Date()): { start: Date; end: Date } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const hari = d.getDay(); // 0 Minggu
  // Senin sebagai awal minggu
  const selisihKeSenin = (hari === 0 ? -6 : 1 - hari);
  const start = new Date(d);
  start.setDate(d.getDate() + selisihKeSenin);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function formatTanggal(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function buildWeeklyRecap(teacherId: string, now = new Date()): Promise<RecapData> {
  const { start, end } = awalMingguIni(now);
  const startStr = formatTanggal(start);
  const endStr = formatTanggal(end);

  // 1. Sesi mengajar minggu ini (tiap jurnal = 1 sesi)
  let sesiMengajar = 0;
  try {
    const jRes = await query(
      `SELECT COUNT(*)::integer AS jumlah
       FROM teacher_journals
       WHERE teacher_id = $1 AND tanggal >= $2 AND tanggal <= $3`,
      [teacherId, startStr, endStr]
    );
    sesiMengajar = Number(jRes.rows[0]?.jumlah) || 0;
  } catch (e) {
    console.error("[Recap] jurnal error:", e);
  }

  // 2. Siswa yang selesai remedial minggu ini
  let siswaRemedialSelesai = 0;
  try {
    const schoolRes = await query(
      `SELECT s.id FROM schools s
       JOIN user_school_assignments usa ON usa."schoolId" = s.id
       WHERE usa."userId" = $1 LIMIT 1`,
      [teacherId]
    );
    const schoolId = schoolRes.rows[0]?.id;
    if (schoolId) {
      const rRes = await query(
        `SELECT COUNT(DISTINCT sg.student_id)::integer AS jumlah
         FROM student_grades sg
         JOIN assessments a ON a.id = sg.assessment_id
         WHERE a.school_id = $1
           AND sg.status_remedial IN ('Remedial Selesai', 'Lulus')
           AND sg.created_at::date >= $2 AND sg.created_at::date <= $3`,
        [schoolId, startStr, endStr]
      );
      siswaRemedialSelesai = Number(rRes.rows[0]?.jumlah) || 0;
    }
  } catch (e) {
    console.error("[Recap] remedial error:", e);
  }

  // 3. Progress kurikulum dari ATP
  let progressKurikulum: RecapData["progressKurikulum"] = [];
  try {
    const atpRes = await query(
      `SELECT judul_dokumen, konten FROM guru_administrasi
       WHERE user_id = $1 AND tipe_dokumen = 'atp'`,
      [teacherId]
    );
    for (const row of atpRes.rows) {
      const konten = row.konten || {};
      const total = Number(konten.total_minggu) || 0;
      const progress = Number(konten.progress_minggu) || 0;
      if (total > 0) {
        progressKurikulum.push({
          mapel: row.judul_dokumen || "ATP",
          progress,
          total,
        });
      }
    }
  } catch (e) {
    console.error("[Recap] atp error:", e);
  }

  return { weekStart: startStr, weekEnd: endStr, sesiMengajar, siswaRemedialSelesai, progressKurikulum };
}

export function formatRecapMessage(nama: string, r: RecapData): string {
  const lines: string[] = [];
  lines.push(`Halo ${nama || "Bapak/Ibu"} 🌟`);
  lines.push(`Berikut ringkasan kerja keras Anda minggu ini (${r.weekStart} s.d. ${r.weekEnd}):`);
  lines.push(``);
  lines.push(`📚 ${r.sesiMengajar} sesi mengajar terselesaikan`);
  lines.push(`🌱 ${r.siswaRemedialSelesai} siswa berhasil menyelesaikan remedial`);

  if (r.progressKurikulum.length) {
    lines.push(``);
    lines.push(`📌 Progress kurikulum:`);
    r.progressKurikulum.slice(0, 4).forEach((m) => {
      const pct = m.total > 0 ? Math.round((m.progress / m.total) * 100) : 0;
      lines.push(`• ${m.mapel}: ${m.progress}/${m.total} minggu (${pct}%)`);
    });
  }

  lines.push(``);
  lines.push(`Luar biasa! Istirahat yang cukup dan semangat untuk minggu depan ya. 💪`);
  return lines.join("\n");
}
