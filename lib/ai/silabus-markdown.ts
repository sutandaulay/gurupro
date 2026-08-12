import type { SilabusOutput } from "@/lib/schemas/silabus";

/**
 * Konversi SilabusOutput (JSON terstruktur ATP) menjadi markdown yang rapi
 * untuk dirender oleh RichMarkdown maupun dicetak.
 */
export function silabusToMarkdown(data: SilabusOutput): string {
  const identitas = data.identitas;
  const semesterLabel = identitas.semester === 1 ? "Ganjil" : "Genap";
  const lines: string[] = [];

  lines.push("# ALUR TUJUAN PEMBELAJARAN (ATP)");
  lines.push("");

  lines.push("## A. Identitas");
  lines.push("| Komponen | Keterangan |");
  lines.push("|---|---|");
  lines.push(`| Mata Pelajaran | ${identitas.mataPelajaran} |`);
  lines.push(`| Fase | ${identitas.fase} |`);
  lines.push(`| Kelas | ${identitas.kelas} |`);
  lines.push(`| Semester | ${semesterLabel} |`);
  lines.push(`| Tahun Ajaran | ${identitas.tahunAjaran || "-"} |`);
  lines.push("");

  lines.push("## B. Capaian Pembelajaran (CP)");
  lines.push("");
  lines.push(data.capaianPembelajaran || "Data capaian pembelajaran tidak tersedia.");
  lines.push("");

  lines.push("## C. Alur Tujuan Pembelajaran");
  lines.push("");
  lines.push("| No | Topik / Unit | Tujuan Pembelajaran | Dimensi Profil Lulusan | Est. Pertemuan | Est. Minggu |");
  lines.push("|---|---|---|---|---|---|");
  data.alurTujuanPembelajaran.forEach((unit) => {
    const tp = unit.tujuanPembelajaran.map((t) => `- ${t}`).join("<br>");
    const dimensi = unit.dimensiProfilLulusanTerhubung.join(", ") || "-";
    lines.push(
      `| ${unit.unitKe} | ${unit.topik} | ${tp} | ${dimensi} | ${unit.estimasiPertemuan} | ${unit.estimasiMinggu} |`
    );
  });
  lines.push("");

  lines.push("## D. Rekapitulasi");
  lines.push("");
  lines.push(
    `Total **${data.alurTujuanPembelajaran.length} unit** pembelajaran dengan estimasi **${data.totalEstimasi.totalPertemuan} pertemuan** (${data.totalEstimasi.totalMinggu} minggu efektif) dalam satu semester.`
  );
  lines.push("");

  lines.push(
    "_Disusun berdasarkan Permendikdasmen Nomor 1 Tahun 2026 tentang Standar Proses._"
  );

  return lines.join("\n");
}