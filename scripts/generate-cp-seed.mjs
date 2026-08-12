/**
 * CP Seed Data Generator — Generates INSERT statements for capaian_pembelajaran table
 * Sources: Kepka BSKAP 046/2025 (Lampiran II)
 * Coverage: Mapel umum SD/MI, SMP/MTs, SMA/MA (prioritas Fase 1)
 *
 * Usage: node scripts/generate-cp-seed.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const extractedData = JSON.parse(readFileSync('d:/gurupro/extracted_priority_cp.json', 'utf8'));

function extractElemenFromFaseText(faseText) {
  const elemen = [];
  const lines = faseText.split('\n');
  let currentElemen = null;
  let currentText = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const elemenMatch = trimmed.match(/^([IVX]+)\.\s+(.+)/);
    if (elemenMatch) {
      if (currentElemen) {
        elemen.push({
          nama_elemen: currentElemen.name,
          deskripsi: currentElemen.desc || '',
          capaian_pembelajaran: currentText.join(' ').replace(/\s+/g, ' ').trim().substring(0, 2000),
        });
      }
      currentElemen = { name: elemenMatch[2].trim(), desc: '' };
      currentText = [];
    } else if (currentElemen) {
      currentText.push(trimmed);
    }
  }

  if (currentElemen) {
    elemen.push({
      nama_elemen: currentElemen.name,
      deskripsi: currentElemen.desc || '',
      capaian_pembelajaran: currentText.join(' ').replace(/\s+/g, ' ').trim().substring(0, 2000),
    });
  }

  return elemen;
}

function splitFaseSections(textRaw) {
  const sections = [];
  const fasePattern = /## Fase ([A-Z0-9]+)\n([\s\S]*?)(?=## Fase |$)/gi;
  let match;
  while ((match = fasePattern.exec(textRaw)) !== null) {
    sections.push({ faseName: match[1], text: match[2] });
  }
  return sections;
}

const faseToJenjang = { 'A': 'SD', 'B': 'SD', 'C': 'SD', 'D': 'SMP', 'E': 'SMA', 'F': 'SMA' };

const seedRecords = [];

for (const mapelEntry of extractedData) {
  const faseSections = splitFaseSections(mapelEntry.text_raw);
  if (faseSections.length === 0) continue;

  const faseToKelas = mapelEntry.kelas_info;

  for (const section of faseSections) {
    const { faseName, text: rawText } = section;
    const jenjang = faseToJenjang[faseName];
    const kelas = faseToKelas[faseName] || null;

    if (!jenjang) continue;
    if (!mapelEntry.jenjang_list.includes(jenjang)) continue;

    const validFases = mapelEntry.fase_info[jenjang] || [];
    if (!validFases.includes(faseName)) continue;

    const elemen = extractElemenFromFaseText(rawText);

    seedRecords.push({
      versi: '046/2025',
      versi_tanggal: '2025-07-16',
      sumber_regulasi: 'Kepka BSKAP 046/H/KR/2025',
      lampiran: 'II',
      jalur: 'kemendikdasmen',
      jenjang,
      tipe_pendidikan: 'reguler',
      mapel_kode: null,
      mapel_nama: mapelEntry.mapel_nama,
      fase: faseName,
      kelas_umum: kelas,
      usia_mental: null,
      elemen,
      status_madrasah: null,
      halaman_perkiraan: Math.round(mapelEntry.global_start_line / 10),
      deprecated: false,
    });
  }
}

console.log(`Generated ${seedRecords.length} seed records`);

// Generate SQL INSERT statements
function generateSQL(records) {
  const stmts = [];
  for (const r of records) {
    const jsonb = JSON.stringify(r.elemen).replace(/'/g, "''");
    const sql = `INSERT INTO capaian_pembelajaran (
  versi, versi_tanggal, sumber_regulasi, lampiran, jalur,
  jenjang, tipe_pendidikan, mapel_kode, mapel_nama, fase, kelas_umum,
  usia_mental, elemen, status_madrasah, halaman_perkiraan, deprecated,
  created_at, updated_at
) VALUES (
  '${r.versi}', '${r.versi_tanggal}', '${r.sumber_regulasi}', '${r.lampiran}', '${r.jalur}',
  '${r.jenjang}', '${r.tipe_pendidikan}', ${r.mapel_kode ? `'${r.mapel_kode}'` : 'NULL'},
  '${r.mapel_nama.replace(/'/g, "''")}', ${r.fase ? `'${r.fase}'` : 'NULL'},
  ${r.kelas_umum ? `'${r.kelas_umum}'` : 'NULL'}, ${r.usia_mental ? `'${r.usia_mental}'` : 'NULL'},
  '${jsonb}', ${r.status_madrasah ? `'${JSON.stringify(r.status_madrasah).replace(/'/g, "''")}'` : 'NULL'},
  ${r.halaman_perkiraan || 'NULL'}, false,
  '${new Date().toISOString()}', '${new Date().toISOString()}'
)
ON CONFLICT (sumber_regulasi, jalur, jenjang, tipe_pendidikan, mapel_kode, fase)
DO UPDATE SET
  elemen = EXCLUDED.elemen,
  mapel_nama = EXCLUDED.mapel_nama,
  kelas_umum = EXCLUDED.kelas_umum,
  updated_at = EXCLUDED.updated_at;`;
    stmts.push(sql);
  }
  return stmts.join('\n\n');
}

const sqlContent = `-- ==========================================
-- SEED DATA: Capaian Pembelajaran (Fase 1)
-- Source: Kepka BSKAP 046/H/KR/2025 Lampiran II
-- Mapel Umum SD/MI, SMP/MTs, SMA/MA
-- Generated: ${new Date().toISOString()}
-- Total records: ${seedRecords.length}
-- ==========================================

BEGIN;

${generateSQL(seedRecords)}

COMMIT;
`;

writeFileSync('d:/gurupro/migrations/17_seed_capaian_pembelajaran_fase1.sql', sqlContent);
console.log(`Saved to migrations/17_seed_capaian_pembelajaran_fase1.sql`);

writeFileSync('d:/gurupro/extracted_cp_fase1_structured.json', JSON.stringify(seedRecords, null, 2));

// Summary
const byMapel = {};
for (const r of seedRecords) {
  if (!byMapel[r.mapel_nama]) byMapel[r.mapel_nama] = [];
  if (!byMapel[r.mapel_nama].includes(r.fase)) byMapel[r.mapel_nama].push(r.fase);
}
console.log('\n=== SUMMARY ===');
for (const [mapel, fases] of Object.entries(byMapel)) {
  const hasElemen = seedRecords.find(r => r.mapel_nama === mapel && r.elemen.length > 0);
  console.log(`  ${mapel}: Fase ${fases.join(', ')} [${hasElemen ? 'elemen extracted' : 'NO ELEMENTS'}]`);
}
