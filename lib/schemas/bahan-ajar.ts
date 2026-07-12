/**
 * Zod Schemas for Bahan Ajar AI Output
 *
 * Structured JSON schemas for slide and handout generation
 * Following Permendikdasmen No. 1 Tahun 2026 (Standar Proses)
 */

import { z } from "zod";

// ============================================
// SLIDE OUTPUT SCHEMA
// ============================================

export const bahanAjarSlideOutputSchema = z.object({
  judulPresentasi: z.string(),
  slides: z.array(
    z.object({
      nomor: z.number(),
      jenisSlide: z.enum([
        "pembuka",
        "tujuan_pembelajaran",
        "materi",
        "contoh",
        "aktivitas",
        "rangkuman",
        "penutup",
      ]),
      judulSlide: z.string(),
      kontenPoin: z.array(z.string()).max(5), // maksimal 5 poin per slide
      catatanPembicara: z.string().nullable(), // speaker notes
      saranVisual: z.string().nullable(), // deskripsi ide visual
    })
  ).min(3), // minimal 3 slides
});

export type BahanAjarSlideOutput = z.infer<typeof bahanAjarSlideOutputSchema>;
export type SlideItem = z.infer<typeof bahanAjarSlideOutputSchema.shape.slides.element>;

// ============================================
// HANDOUT OUTPUT SCHEMA
// ============================================

export const bahanAjarHandoutOutputSchema = z.object({
  judul: z.string(),
  ringkasanMateri: z.string(), // konten utama, mandiri terbaca
  poinPenting: z.array(z.string()).max(8), // highlight esensial
  contohSoalLatihan: z.array(
    z.object({
      soal: z.string(),
      kunciJawaban: z.string().nullable(), // nullable = siswa version (tanpa kunci)
    })
  ).max(5),
  referensiTambahan: z.array(z.string()).nullable(),
});

export type BahanAjarHandoutOutput = z.infer<typeof bahanAjarHandoutOutputSchema>;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate slide output - reject if any slide has more than 5 points
 */
export function validateSlideOutput(output: BahanAjarSlideOutput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check minimum slides
  if (output.slides.length < 3) {
    errors.push(`Minimal 3 slide, ditemukan ${output.slides.length} slide`);
  }

  // Check max points per slide
  output.slides.forEach((slide, index) => {
    if (slide.kontenPoin.length > 5) {
      errors.push(`Slide ${slide.nomor || index + 1}: lebih dari 5 poin (${slide.kontenPoin.length})`);
    }
  });

  // Check required slide types are present
  const slideTypes = output.slides.map((s) => s.jenisSlide);
  const requiredTypes: Array<typeof slideTypes[number]> = ["pembuka", "tujuan_pembelajaran", "penutup"];
  for (const type of requiredTypes) {
    if (!slideTypes.includes(type)) {
      errors.push(`Slide wajib "${type}" tidak ditemukan`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get handout without kunciJawaban (siswa version)
 */
export function getHandoutSiswaVersion(handout: BahanAjarHandoutOutput): BahanAjarHandoutOutput {
  return {
    ...handout,
    contohSoalLatihan: handout.contohSoalLatihan.map((soal) => ({
      ...soal,
      kunciJawaban: null, // hapus kunci jawaban untuk siswa
    })),
  };
}

/**
 * Get handout with kunciJawaban (guru version)
 */
export function getHandoutGuruVersion(handout: BahanAjarHandoutOutput): BahanAjarHandoutOutput {
  // Guru version: kunciJawaban tetap ada
  return handout;
}

// ============================================
// MIGRATION HELPERS
// ============================================

/**
 * Convert legacy slidesOutline format to new schema format
 * Legacy: { slides: [{ pertemuan, judul_slide, poin_utama, ... }] }
 * New: { judulPresentasi, slides: [{ nomor, jenisSlide, judulSlide, kontenPoin, ... }] }
 */
export function migrateLegacySlides(
  legacySlides: any,
  presentasiTitle: string
): BahanAjarSlideOutput | null {
  if (!legacySlides?.slides || !Array.isArray(legacySlides.slides)) {
    return null;
  }

  // Map legacy types to new jenisSlide
  const mapJenisSlide = (idx: number, total: number): SlideItem["jenisSlide"] => {
    if (idx === 0) return "pembuka";
    if (idx === total - 1) return "penutup";
    // Try to infer from content
    return "materi";
  };

  const slides = legacySlides.slides.map((slide: any, idx: number, arr: any[]) => ({
    nomor: idx + 1,
    jenisSlide: slide.jenisSlide || mapJenisSlide(idx, arr.length),
    judulSlide: slide.judul_slide || slide.judul || `Slide ${idx + 1}`,
    kontenPoin: Array.isArray(slide.poin_utama) ? slide.poin_utama : [],
    catatanPembicara: slide.catatan_pengajar || null,
    saranVisual: slide.saran_visual || null,
  }));

  return {
    judulPresentasi: presentasiTitle,
    slides,
  };
}

/**
 * Convert legacy handout (markdown string) to new schema format
 */
export function migrateLegacyHandout(
  legacyHandout: string,
  judul: string
): BahanAjarHandoutOutput | null {
  if (!legacyHandout || typeof legacyHandout !== "string") {
    return null;
  }

  // Basic parsing - in production this would be more sophisticated
  const lines = legacyHandout.split("\n");

  // Extract sections
  const poinPenting: string[] = [];
  const contohSoalLatihan: Array<{ soal: string; kunciJawaban: string | null }> = [];

  let inLatihan = false;
  for (const line of lines) {
    if (line.includes("Latihan") || line.includes("Soal")) {
      inLatihan = true;
      continue;
    }
    if (line.includes("Pustaka") || line.includes("Referensi")) {
      inLatihan = false;
    }

    if (inLatihan && line.trim()) {
      // Extract soal number if present
      const soalMatch = line.match(/^\d+\.\s*(.+)$/);
      if (soalMatch) {
        contohSoalLatihan.push({
          soal: soalMatch[1],
          kunciJawaban: null,
        });
      }
    }

    // Extract ringkasan from content between headers
    if (line.startsWith("#") || line.startsWith("##")) {
      continue;
    }
  }

  return {
    judul,
    ringkasanMateri: legacyHandout.substring(0, 2000), // limit length
    poinPenting,
    contohSoalLatihan: contohSoalLatihan.slice(0, 5),
    referensiTambahan: null,
  };
}
