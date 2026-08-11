/**
 * Capaian Pembelajaran (CP) retrieval utilities
 * Queries the structured CP table for AI generation context
 */

import { query } from '@/lib/db';

export interface CPRecord {
  versi: string;
  sumber_regulasi: string;
  lampiran: string;
  mapel_nama: string;
  fase: string;
  jenjang: string;
  tipe_pendidikan: string;
  kelas_umum: string;
  elemen: Array<{ nama_elemen: string; capaian_pembelajaran: string }>;
}

/**
 * Retrieve CP records for a given mapel, jenjang, and fase.
 * Falls back gracefully if table doesn't exist yet.
 *
 * @param mapel - Subject name (e.g., "MATEMATIKA", "AL-QUR'AN HADIS")
 * @param jenjang - Education level (SD, SMP, SMA, MI, MTs, MA, RA)
 * @param fase - Fase letter (A-F, or Fondasi)
 * @param jalur - "kemendikdasmen" or "kneelmenag"
 * @param tipePendidikan - "reguler" or "madrasah"
 */
export async function getCPCached({
  mapel,
  jenjang,
  fase,
  jalur,
  tipePendidikan = 'reguler',
}: {
  mapel: string;
  jenjang: string;
  fase: string;
  jalur: 'kemendikdasmen' | 'kneelmenag';
  tipePendidikan?: string;
}): Promise<CPRecord | null> {
  try {
    const AGAMA_MAPELS = ['PAI', 'AGAMA_KRISTEN', 'AGAMA_KATOLIK', 'AGAMA_HINDU', 'AGAMA_BUDDHA', 'AGAMA_KHONGHUCU'];

    let orderBy = 'ORDER BY created_at DESC';
    // For agama mapels, prefer 020/2026 (override) over 046/2025
    if (AGAMA_MAPELS.some(a => mapel.toUpperCase().includes(a))) {
      orderBy = "ORDER BY (versi = '020/2026') DESC, created_at DESC";
    }

    const rows = await query(
      `SELECT versi, versi_tanggal, sumber_regulasi, lampiran, mapel_nama, fase, jenjang, tipe_pendidikan, kelas_umum, elemen
       FROM capaian_pembelajaran
       WHERE NOT deprecated
         AND jalur = $1
         AND jenjang = $2
         AND fase = $3
         AND (mapel_nama ILIKE $4 OR $4 ILIKE '%' || mapel_nama || '%')
         AND (tipe_pendidikan = $5 OR tipe_pendidikan IS NULL)
       ${orderBy}
       LIMIT 1`,
      [jalur, jenjang, fase, `%${mapel}%`, tipePendidikan]
    );

    if (rows.rows.length === 0) return null;
    const row = rows.rows[0];
    return {
      versi: row.versi,
      sumber_regulasi: row.sumber_regulasi,
      lampiran: row.lampiran,
      mapel_nama: row.mapel_nama,
      fase: row.fase,
      jenjang: row.jenjang,
      tipe_pendidikan: row.tipe_pendidikan,
      kelas_umum: row.kelas_umum,
      elemen: row.elemen || [],
    };
  } catch (err) {
    // Table might not exist yet — return null, let caller handle
    console.warn('[CP] Retrieval failed (table may not exist):', err);
    return null;
  }
}

/**
 * Determine jalur based on school/jenjang context.
 * kneelmenag for Madrasah (MI/MTs/MA/RA) or when pai_mode is set.
 * kemendikdasmen for regular schools (SD/SMP/SMA).
 */
export function determineJalur(params: {
  jenjang?: string;
  paiMode?: string | null;
  kurikulum?: string;
}): 'kemendikdasmen' | 'kneelmenag' {
  const { jenjang = '', paiMode, kurikulum } = params;

  if (paiMode && paiMode !== 'none') return 'kneelmenag';

  // Madrasah jenjang
  if (['MI', 'MTs', 'MA', 'RA'].includes(jenjang)) return 'kneelmenag';

  // Explicit Madrasah kurikulum
  if (kurikulum === 'madrasah') return 'kneelmenag';

  return 'kemendikdasmen';
}

/**
 * Format CP elemen into a readable string for AI prompts.
 * Concatenates all elemen descriptions for the full CP text.
 */
export function formatCPForPrompt(cp: CPRecord): string {
  if (!cp.elemen || cp.elemen.length === 0) {
    return `[CP untuk ${cp.mapel_nama} Fase ${cp.fase} — data belum tersedia]`;
  }

  const lines = cp.elemen.map(e =>
    `**${e.nama_elemen}**: ${e.capaian_pembelajaran}`
  );

  return `[Sumber: ${cp.sumber_regulasi} | ${cp.lampiran} | ${cp.jenjang} Fase ${cp.fase} | ${cp.kelas_umum}]\n${lines.join('\n')}`;
}
