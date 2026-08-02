import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

// Menghitung streak harian guru dari teacher_journals (READ-ONLY).
// Hasil agregasi disimpan ke tabel teacher_streaks (baru, terpisah).
// Tidak mengubah teacher_journals atau pipeline Selesai Mengajar yang sudah production.

function hitungStreak(tanggalUnik: string[]): {
  currentStreak: number;
  longestStreak: number;
  lastJournalDate: string | null;
} {
  if (!tanggalUnik.length) {
    return { currentStreak: 0, longestStreak: 0, lastJournalDate: null };
  }

  const setHari = new Set(
    tanggalUnik.map((t) => {
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  const urut = Array.from(setHari).sort((a, b) => a - b);
  const lastJournalDate = new Date(urut[urut.length - 1]).toISOString().split("T")[0];

  // Longest streak
  let longest = 1;
  let temp = 1;
  for (let i = 1; i < urut.length; i++) {
    const selisih = (urut[i] - urut[i - 1]) / 86400000;
    if (selisih === 1) {
      temp++;
      longest = Math.max(longest, temp);
    } else if (selisih > 1) {
      temp = 1;
    }
  }

  // Current streak: mulai dari hari ini (atau kemarin), mundur ke belakang
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  let current = 0;
  let cursor = new Date(hariIni);

  if (!setHari.has(cursor.getTime())) {
    // Jika hari ini belum ada jurnal, mulai dari kemarin
    cursor.setDate(cursor.getDate() - 1);
    if (!setHari.has(cursor.getTime())) {
      return { currentStreak: 0, longestStreak: longest, lastJournalDate };
    }
  }

  while (setHari.has(cursor.getTime())) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { currentStreak: current, longestStreak: longest, lastJournalDate };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const teacherId = session.id;

    const res = await query(
      `SELECT DISTINCT tanggal FROM teacher_journals WHERE user_id = $1`,
      [teacherId]
    );

    const tanggalUnik = res.rows.map((r: any) => {
      const d = new Date(r.tanggal);
      return d.toISOString().split("T")[0];
    });

    const { currentStreak, longestStreak, lastJournalDate } = hitungStreak(tanggalUnik);

    // Upsert hasil agregasi ke tabel teacher_streaks
    await query(
      `INSERT INTO teacher_streaks (teacher_id, current_streak, longest_streak, last_journal_date, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (teacher_id) DO UPDATE SET
         current_streak = EXCLUDED.current_streak,
         longest_streak = EXCLUDED.longest_streak,
         last_journal_date = EXCLUDED.last_journal_date,
         updated_at = CURRENT_TIMESTAMP`,
      [teacherId, currentStreak, longestStreak, lastJournalDate]
    );

    return NextResponse.json({
      currentStreak,
      longestStreak,
      lastJournalDate,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error computing streak:", error);
    return NextResponse.json(
      { error: error?.message || "Gagal memuat progres harian." },
      { status: 500 }
    );
  }
}
