import { query } from "@/lib/db";

// Sprint 2.2 — Morning Briefing (cron terpisah dari sistem produksi).
// Semua query di sini READ-ONLY terhadap tabel eksisting:
//   schedules + user_school_assignments (jadwal),
//   guru_administrasi tipe 'atp' (progress kurikulum),
//   assessments + student_grades (tugas belum dikoreksi),
//   attendance_insights (siswa butuh perhatian).
// Tidak ada INSERT/UPDATE ke tabel sumber.

const HARI_INDONESIA = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export interface BriefingData {
  jadwal: { className: string; subject: string; startTime: string; endTime: string }[];
  materiTertinggal: { mapel: string; progress: number; total: number }[];
  tugasBelumDikoreksi: number;
  siswaPerhatian: { nama: string; alasan: string }[];
}

export async function buildMorningBriefing(teacherId: string, today = new Date()): Promise<BriefingData> {
  const todayDay = HARI_INDONESIA[today.getDay()];

  // 1. Jadwal ngajar hari ini (reuse pola attendance/schedule/today)
  let jadwal: BriefingData["jadwal"] = [];
  try {
    const schedRes = await query(
      `SELECT sc.jam_mulai, sc.jam_selesai, c.nama_kelas, sb.nama_mapel
       FROM schedules sc
       JOIN classes c ON sc.class_id = c.id
       JOIN subjects sb ON sc.subject_id = sb.id
       JOIN schools s ON sc.school_id = s.id
       JOIN user_school_assignments usa ON usa."schoolId" = s.id
       WHERE usa."userId" = $1 AND sc.hari = $2
       ORDER BY sc.jam_mulai ASC`,
      [teacherId, todayDay]
    );
    jadwal = schedRes.rows.map((r: any) => ({
      className: r.nama_kelas,
      subject: r.nama_mapel,
      startTime: String(r.jam_mulai).slice(0, 5),
      endTime: String(r.jam_selesai).slice(0, 5),
    }));
  } catch (e) {
    console.error("[Briefing] jadwal error:", e);
  }

  // 2. Progress materi tertinggal dari ATP (konten.progress_minggu vs total_minggu)
  let materiTertinggal: BriefingData["materiTertinggal"] = [];
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
      if (total > 0 && progress < total) {
        materiTertinggal.push({
          mapel: row.judul_dokumen || "ATP",
          progress,
          total,
        });
      }
    }
  } catch (e) {
    console.error("[Briefing] atp error:", e);
  }

  // 3. Tugas belum dikoreksi: asesmen yang sudah lewat tapi ada nilai awal tanpa nilai akhir/remedial selesai
  let tugasBelumDikoreksi = 0;
  try {
    const schoolRes = await query(
      `SELECT s.id FROM schools s
       JOIN user_school_assignments usa ON usa."schoolId" = s.id
       WHERE usa."userId" = $1 LIMIT 1`,
      [teacherId]
    );
    const schoolId = schoolRes.rows[0]?.id;
    if (schoolId) {
      const tugasRes = await query(
        `SELECT COUNT(DISTINCT a.id)::integer AS belum
         FROM assessments a
         JOIN student_grades sg ON sg.assessment_id = a.id
         WHERE a.school_id = $1
           AND a.tipe_asesmen = 'Sumatif'
           AND sg.nilai_akhir IS NULL`,
        [schoolId]
      );
      tugasBelumDikoreksi = Number(tugasRes.rows[0]?.belum) || 0;
    }
  } catch (e) {
    console.error("[Briefing] tugas error:", e);
  }

  // 4. Siswa butuh perhatian khusus dari attendance_insights (late_days tinggi / sesi rendah)
  let siswaPerhatian: BriefingData["siswaPerhatian"] = [];
  try {
    const insightRes = await query(
      `SELECT insight_data FROM attendance_insights
       WHERE teacher_id = $1 AND period_type = 'weekly'
       ORDER BY period_start DESC LIMIT 1`,
      [teacherId]
    );
    const data = insightRes.rows[0]?.insight_data;
    if (data && Array.isArray(data.students_needing_attention)) {
      siswaPerhatian = data.students_needing_attention.slice(0, 5).map((s: any) => ({
        nama: s.nama || s.name || "Siswa",
        alasan: s.alasan || s.reason || "Perlu perhatian",
      }));
    }
  } catch (e) {
    console.error("[Briefing] insight error:", e);
  }

  return { jadwal, materiTertinggal, tugasBelumDikoreksi, siswaPerhatian };
}

// Format pesan singkat & hangat untuk WA / in-app
export function formatBriefingMessage(nama: string, b: BriefingData): string {
  const lines: string[] = [];
  lines.push(`Halo ${nama || "Bapak/Ibu"} 👋`);
  lines.push(`Berikut ringkasan hari ini untuk persiapan mengajar:`);
  lines.push(``);

  if (b.jadwal.length) {
    lines.push(`📚 Jadwal mengajar (${b.jadwal.length} sesi):`);
    b.jadwal.slice(0, 4).forEach((j) => {
      lines.push(`• ${j.startTime}–${j.endTime}  ${j.subject} (${j.className})`);
    });
    if (b.jadwal.length > 4) lines.push(`• +${b.jadwal.length - 4} sesi lainnya`);
  } else {
    lines.push(`📚 Tidak ada jadwal mengajar terjadwal hari ini.`);
  }

  if (b.materiTertinggal.length) {
    lines.push(``);
    lines.push(`📌 Materi yang bisa dilanjutkan:`);
    b.materiTertinggal.slice(0, 3).forEach((m) => {
      lines.push(`• ${m.mapel}: minggu ke-${m.progress} dari ${m.total}`);
    });
  }

  if (b.tugasBelumDikoreksi > 0) {
    lines.push(``);
    lines.push(`✍️ ${b.tugasBelumDikoreksi} tugas sumatif masih menunggu koreksi.`);
  }

  if (b.siswaPerhatian.length) {
    lines.push(``);
    lines.push(`💡 Siswa yang butuh perhatian:`);
    b.siswaPerhatian.slice(0, 3).forEach((s) => {
      lines.push(`• ${s.nama} — ${s.alasan}`);
    });
  }

  lines.push(``);
  lines.push(`Semangat mengajar hari ini! 🌟`);
  return lines.join("\n");
}
