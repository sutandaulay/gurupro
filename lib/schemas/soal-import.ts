import { z } from "zod";

// Enum values
export const questionTypes = [
  "pg",
  "isian",
  "essay",
  "pg-kompleks",
  "bs",
  "jodoh",
  "urutan",
  "tabel",
  "sebab-akibat",
] as const;

export const difficultyLevels = ["mudah", "sedang", "sulit"] as const;

export const cognitiveLevels = [
  "C1", "C2", "C3", "C4", "C5", "C6"
] as const;

// Schema for a single imported soal
export const importedSoalSchema = z.object({
  pertanyaan: z.string().min(1, "Pertanyaan tidak boleh kosong"),
  tipe: z.enum(questionTypes),
  opsi: z.array(z.string()).nullable().optional(),
  kunci: z.union([z.string(), z.array(z.string())]).optional(),
  pembahasan: z.string().optional(),
  tingkat: z.enum(difficultyLevels).optional(),
  kognitif: z.string().optional(),
  elemen: z.string().optional(),
  cp: z.string().optional(),
  tp: z.string().optional(),
  indikator: z.string().optional(),
  skor: z.number().int().positive().optional(),
  gambar: z.string().nullable().optional(),
});

// Schema for batch import
export const importBatchSchema = z.object({
  soal: z.array(importedSoalSchema),
  options: z.object({
    merge: z.boolean().default(true),
    replaceAll: z.boolean().default(false),
  }).optional(),
});

// Schema for CSV row (flattened format)
export const csvRowSchema = z.object({
  pertanyaan: z.string().min(1),
  tipe: z.string().default("pg"),
  opsi_a: z.string().optional(),
  opsi_b: z.string().optional(),
  opsi_c: z.string().optional(),
  opsi_d: z.string().optional(),
  opsi_e: z.string().optional(),
  kunci: z.string().optional(),
  pembahasan: z.string().optional(),
  tingkat: z.string().optional(),
  kognitif: z.string().optional(),
  elemen: z.string().optional(),
  cp: z.string().optional(),
  tp: z.string().optional(),
  indikator: z.string().optional(),
  skor: z.union([z.string(), z.number()]).optional(),
  gambar: z.string().optional(),
});

// Schema for import result
export interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
    data?: any;
  }>;
  soal: any[];
}

// Helper to convert CSV row to soal format
export function csvRowToSoal(row: Record<string, any>, index: number): { soal: any; error?: string } {
  try {
    const opsi: string[] = [];
    if (row.opsi_a) opsi.push(row.opsi_a);
    if (row.opsi_b) opsi.push(row.opsi_b);
    if (row.opsi_c) opsi.push(row.opsi_c);
    if (row.opsi_d) opsi.push(row.opsi_d);
    if (row.opsi_e) opsi.push(row.opsi_e);

    const tipe = normalizeTipe(row.tipe);
    let kunci = row.kunci || "";

    // For PG Kompleks, parse kunci as array
    if (tipe === "pg-kompleks" && typeof row.kunci === "string") {
      kunci = row.kunci.split(/[,;]/).map((k: string) => k.trim().toUpperCase()).filter(Boolean);
    }

    const soal = {
      id: `import-${Date.now()}-${index}`,
      nomor: index + 1,
      pertanyaan: row.pertanyaan,
      tipe,
      opsi: opsi.length > 0 ? opsi : null,
      kunci,
      pembahasan: row.pembahasan || "",
      tingkat: normalizeDifficulty(row.tingkat),
      kognitif: normalizeKognitif(row.kognitif),
      elemen: row.elemen || "",
      cp: row.cp || "",
      tp: row.tp || "",
      indikator: row.indikator || "",
      skor: parseInt(row.skor) || 1,
      gambar: row.gambar || null,
    };

    return { soal };
  } catch (error: any) {
    return { soal: null, error: `Row ${index + 1}: ${error.message}` };
  }
}

function normalizeTipe(tipe: string | undefined): string {
  if (!tipe) return "pg";
  const normalized = tipe.toLowerCase().trim();
  const typeMap: Record<string, string> = {
    "pilihan ganda": "pg",
    "pg": "pg",
    "isian": "isian",
    "isian singkat": "isian",
    "essay": "essay",
    "uraian": "essay",
    "pg kompleks": "pg-kompleks",
    "pg-kompleks": "pg-kompleks",
    "benar salah": "bs",
    "bs": "bs",
    "jodoh": "jodoh",
    "menjodohkan": "jodoh",
    "urutan": "urutan",
    "tabel": "tabel",
    "sebab-akibat": "sebab-akibat",
  };
  return typeMap[normalized] || "pg";
}

function normalizeDifficulty(level: string | undefined): string {
  if (!level) return "sedang";
  const normalized = level.toLowerCase().trim();
  if (["mudah", "easy", "ringan"].includes(normalized)) return "mudah";
  if (["sulit", "hard", "sukar", "sulit"].includes(normalized)) return "sulit";
  return "sedang";
}

function normalizeKognitif(level: string | undefined): string {
  if (!level) return "C1";
  const normalized = level.toUpperCase().trim();
  if (["C1", "C2", "C3", "C4", "C5", "C6"].includes(normalized)) return normalized;
  return "C1";
}

// Parse CSV content
export function parseCSV(content: string): Record<string, any>[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  // Detect separator
  const firstLine = lines[0];
  const separator = firstLine.includes(";") ? ";" : ",";

  // Parse header
  const headers = firstLine.split(separator).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

  // Parse rows
  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const values = line.split(separator).map(v => v.trim().replace(/^["']|["']$/g, ""));
    const row: Record<string, any> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    rows.push(row);
  }

  return rows;
}
