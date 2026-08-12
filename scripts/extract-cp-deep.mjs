/**
 * CP Deep Extractor v5-final — Accurate bounds, robust heading parsing
 *
 * Usage: node scripts/extract-cp-deep.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const text = readFileSync('d:/gurupro/extracted_full.txt', 'utf8');
const lines = text.split('\n');

/**
 * Mapel bounds — verified against actual document structure.
 * Format: [key, displayName, startLine(1-based), endLine(1-based), faseKelas, jenjangMap]
 */
const MAPEL_BOUNDS = [
  // SD Mapel
  ['PENDIDIKAN_PANCASILA', 'PENDIDIKAN PANCASILA', 1103, 1246, {A:'I-II',B:'III',C:'IV-VI',D:'VII-IX',E:'X-XI'}, {SD:['A','B','C'],SMP:['D'],SMA:['E']}],
  ['BAHASA_INDONESIA', 'BAHASA INDONESIA', 1246, 1389, {A:'I-II',B:'III',C:'IV-VI',D:'VII-IX',E:'X-XI',F:'XII'}, {SD:['A','B','C'],SMP:['D'],SMA:['E','F']}],
  ['BAHASA_INDONESIA_TL', 'BAHASA INDONESIA TINGKAT LANJUT', 1389, 1490, {F:'XII'}, {SMA:['F']}],
  ['MATEMATIKA', 'MATEMATIKA', 1490, 1588, {A:'I-II',B:'III',C:'IV-VI',D:'VII-IX',E:'X-XI',F:'XII'}, {SD:['A','B','C'],SMP:['D'],SMA:['E','F']}],
  ['MATEMATIKA_TL', 'MATEMATIKA TINGKAT LANJUT', 1588, 1662, {F:'XII'}, {SMA:['F']}],
  ['BAHASA_INGGRIS', 'BAHASA INGGRIS', 1662, 2043, {D:'VII-IX',E:'X-XI',F:'XII'}, {SMP:['D'],SMA:['E','F']}],
  ['BAHASA_INGGRIS_TL', 'BAHASA INGGRIS TINGKAT LANJUT', 2043, 2148, {F:'XII'}, {SMA:['F']}],
  ['IPAS', 'IPAS (ILMU PENGETAHUAN ALAM DAN SOSIAL)', 2148, 2203, {A:'I-II',B:'III',C:'IV-VI'}, {SD:['A','B','C']}],
  ['IPA', 'IPA (ILMU PENGETAHUAN ALAM)', 2203, 2475, {D:'VII-IX'}, {SMP:['D']}],
  // SMA Mapel
  ['FISIKA', 'FISIKA', 2475, 2568, {E:'X-XI',F:'XII'}, {SMA:['F']}],
  ['KIMIA', 'KIMIA', 2568, 2625, {E:'X-XI',F:'XII'}, {SMA:['F']}],
  ['BIOLOGI', 'BIOLOGI', 2625, 2691, {E:'X-XI',F:'XII'}, {SMA:['F']}],
  ['INFORMATIKA', 'INFORMATIKA', 2691, 2873, {D:'VII-IX',E:'X-XI',F:'XII'}, {SMP:['D'],SMA:['E','F']}],
  ['IPS', 'IPS (ILMU PENGETAHUAN SOSIAL)', 2873, 2949, {E:'X-XI'}, {SMA:['E']}],
  ['SEJARAH_SMP', 'SEJARAH', 2949, 3019, {D:'VII-IX'}, {SMP:['D']}],
  ['SEJARAH', 'SEJARAH', 2949, 3019, {E:'X-XI',F:'XII'}, {SMA:['E','F']}],
  ['SEJARAH_TL', 'SEJARAH TINGKAT LANJUT', 3019, 3120, {F:'XII'}, {SMA:['F']}],
  ['GEOGRAFI', 'GEOGRAFI', 3120, 3197, {E:'X-XI'}, {SMA:['E']}],
  ['EKONOMI', 'EKONOMI', 3197, 3295, {E:'X-XI'}, {SMA:['E']}],
  ['SOSIOLOGI', 'SOSIOLOGI', 3295, 3438, {E:'X-XI'}, {SMA:['E']}],
  ['ANTROPOLOGI', 'ANTROPOLOGI', 3438, 3542, {E:'X-XI',F:'XII'}, {SMA:['E','F']}],
  // Seni
  ['SENI_MUSIK', 'SENI MUSIK', 3542, 3669, {A:'I-II',B:'III',C:'IV-VI',D:'VII-IX',E:'X-XI',F:'XII'}, {SD:['A','B','C'],SMP:['D'],SMA:['E','F']}],
  ['SENI_RUPA', 'SENI RUPA', 3669, 3767, {A:'I-II',B:'III',C:'IV-VI',D:'VII-IX',E:'X-XI',F:'XII'}, {SD:['A','B','C'],SMP:['D'],SMA:['E','F']}],
  ['SENI_TARI', 'SENI TARI', 3767, 3833, {A:'I-II',B:'III',C:'IV-VI',D:'VII-IX',E:'X-XI',F:'XII'}, {SD:['A','B','C'],SMP:['D'],SMA:['E','F']}],
  ['SENI_TEATER', 'SENI TEATER', 3833, 3890, {A:'I-II',B:'III',C:'IV-VI',D:'VII-IX',E:'X-XI',F:'XII'}, {SD:['A','B','C'],SMP:['D'],SMA:['E','F']}],
  // PJOK + Bahasa Asing + Koding
  ['PJOK', 'PENDIDIKAN JASMANI, OLAHRAGA, DAN KESEHATAN', 4703, 4876, {A:'I-II',B:'III',C:'IV-VI',D:'VII-IX',E:'X-XI',F:'XII'}, {SD:['A','B','C'],SMP:['D'],SMA:['E','F']}],
  ['BAHASA_ARAB', 'BAHASA ARAB', 4876, 4997, {C:'IV-VI',D:'VII-IX',E:'X-XI',F:'XII'}, {SD:['C'],SMP:['D'],SMA:['E','F']}],
  ['BAHASA_JEPANG', 'BAHASA JEPANG', 4997, 5087, {E:'X-XI',F:'XII'}, {SMA:['E','F']}],
  ['BAHASA_JERMAN', 'BAHASA JERMAN', 5087, 5203, {E:'X-XI',F:'XII'}, {SMA:['E','F']}],
  ['BAHASA_KOREA', 'BAHASA KOREA', 5203, 5285, {E:'X-XI',F:'XII'}, {SMA:['E','F']}],
  ['BAHASA_MANDARIN', 'BAHASA MANDARIN', 5285, 5324, {E:'X-XI',F:'XII'}, {SMA:['E','F']}],
  ['BAHASA_PRANCIS', 'BAHASA PRANCIS', 5285, 5324, {E:'X-XI',F:'XII'}, {SMA:['E','F']}],
  ['KODING_AI', 'KODING DAN KECERDASAN ARTIFISIAL', 5324, 5404, {C:'IV-VI',D:'VII-IX',E:'X-XI',F:'XII'}, {SD:['C'],SMP:['D'],SMA:['E','F']}],
];

const FASE_TO_JENJANG = { A:'SD', B:'SD', C:'SD', D:'SMP', E:'SMA', F:'SMA' };

// ===================================================================
// Find fase blocks in section text
// ===================================================================
function extractFaseBlocks(sectionText) {
  const blocks = [];
  const numberedPattern = /(\d+)\.\s*[Ff]ase\s+([A-Z])\s*(?:\([^)]+\))?[\s\S]*?[Pp]ada\s+[aA]khir[\s]*[Ff]ase\s+\2[,\s][\s\S]*?(?=(?:\d+\.\s*[Ff]ase\s+[A-Z])|$)/gi;
  let m;
  while ((m = numberedPattern.exec(sectionText)) !== null) {
    blocks.push({ faseNum: parseInt(m[1]), fase: m[2], raw: m[0] });
  }
  if (blocks.length === 0) {
    const singlePattern = /[Pp]ada\s+[aA]khir\s+[Ff]ase\s+([A-Z])[,\s][\s\S]*$/i;
    const sm = singlePattern.exec(sectionText);
    if (sm) blocks.push({ faseNum: 1, fase: sm[1], raw: sm[0] });
  }
  return blocks;
}

// ===================================================================
// Split heading from content
// Heading = first N words (capitalized nouns), content = rest
// ===================================================================
function splitHeadingContent(slice, fallbackNum) {
  const first200 = slice.substring(0, 200).trim();
  if (!first200) return [fallbackNum, ''];
  const words = first200.split(/\s+/);

  const knownVerbs = new Set([
    'memahami','menganalisis','mengevaluasi','menciptakan','menyelesaikan',
    'menerapkan','menyusun','membuat','mendeskripsikan','mengidentifikasi',
    'menjelajahi','merespons','menceritakan','mempresentasikan','menulis',
    'memilih','menunjukkan','menggunakan','mempelajari','mendukung',
    'berpikir','merefleksikan','mengapresiasi','membangun','berkontribusi',
    'mengaitkan','membandingkan','menginterpretasi',
  ]);
  const CONNECTORS = new Set(['dan','atau','serta']);

  let headingWordCount = 0;
  for (let j = 0; j < Math.min(words.length, 8); j++) {
    const w = words[j];
    if (!w) continue;
    const wLower = w.toLowerCase().replace(/\r/g, '');
    const isKnownVerb = knownVerbs.has(wLower);
    const isCapitalized = /^[A-Z]/.test(w);
    const isConnector = CONNECTORS.has(wLower);

    // Verb at position 0 (like "Menyimak"): take as entire heading
    if (j === 0 && isKnownVerb) {
      headingWordCount = 1;
      break;
    }
    if (isKnownVerb) {
      break; // verb = content start
    }
    if (isCapitalized || /^[A-Z]{2,}$/.test(w)) {
      headingWordCount = j + 1;
    } else if (isConnector) {
      headingWordCount = j + 1; // include connector
    } else {
      headingWordCount = j + 1;
      break; // first lowercase non-connector = content start
    }
  }

  if (headingWordCount === 0) headingWordCount = 1;

  // Reconstruct heading by finding actual positions in slice
  let charCount = 0;
  const headingWords = [];
  for (let j = 0; j < headingWordCount && j < words.length; j++) {
    const w = words[j];
    if (!w) continue;
    const idx = slice.indexOf(w, charCount);
    if (idx < 0) break;
    charCount = idx + w.length;
    headingWords.push(w);
  }

  const heading = headingWords.join(' ');
  const content = slice.substring(charCount).replace(/\s+/g, ' ').trim().substring(0, 3000);
  return [heading, content];
}

// ===================================================================
// Extract sub-caps (elemen) from fase raw text
// ===================================================================
function extractSubCaps(rawText) {
  const subCaps = [];
  const numRegex = /(\d+(?:\.\d+)?)\./g;
  const positions = [];
  let mm;
  while ((mm = numRegex.exec(rawText)) !== null) {
    positions.push({ index: mm.index, num: mm[1], dotLen: mm[0].length });
  }
  if (positions.length === 0) return subCaps;

  for (let i = 0; i < positions.length; i++) {
    const { index, num, dotLen } = positions[i];
    const afterNum = index + dotLen;
    const nextIdx = i + 1 < positions.length ? positions[i + 1].index : rawText.length;
    const slice = rawText.substring(afterNum, nextIdx);

    const [heading, content] = splitHeadingContent(slice, num);
    const cleaned = content.replace(/\s+/g, ' ').trim();

    // Skip fase descriptions and other non-elemen
    if (cleaned.length > 3 && !/^Fase\s+[A-Z]/i.test(cleaned) && !/^Pada akhir Fase/i.test(cleaned)) {
      subCaps.push({ num, heading, content: cleaned.substring(0, 3000) });
    }
  }
  return subCaps;
}

function buildElemen(subCaps) {
  return subCaps.map(sc => ({
    nama_elemen: sc.heading || sc.num,
    capaian_pembelajaran: sc.content,
  }));
}

// ===================================================================
// MAIN
// ===================================================================
const RECORDS = [];

for (const [key, displayName, startLine, endLine, faseKelas, jenjangMap] of MAPEL_BOUNDS) {
  const sectionText = lines.slice(startLine - 1, endLine).join('\n');
  const faseBlocks = extractFaseBlocks(sectionText);

  for (const block of faseBlocks) {
    const { fase, raw } = block;
    const kelas = faseKelas[fase];
    if (!kelas) continue;
    const jenjangMatch = Object.entries(jenjangMap).find(([, fases]) => fases.includes(fase));
    if (!jenjangMatch) continue;
    const [jenjang] = jenjangMatch;

    const subCaps = extractSubCaps(raw);
    const elemen = buildElemen(subCaps);

    RECORDS.push({
      versi: '046/2025',
      versi_tanggal: '2025-07-16',
      sumber_regulasi: 'Kepka BSKAP 046/H/KR/2025',
      lampiran: 'II',
      jalur: 'kemendikdasmen',
      jenjang,
      tipe_pendidikan: 'reguler',
      mapel_kode: null,
      mapel_nama: displayName,
      fase,
      kelas_umum: kelas,
      usia_mental: null,
      elemen,
      status_madrasah: null,
      halaman_perkiraan: Math.round(startLine / 10),
      deprecated: false,
    });
  }
}

const seen = new Set();
const DEDUPED = RECORDS.filter(r => {
  const key = `${r.mapel_nama}|${r.jenjang}|${r.fase}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`Extracted ${DEDUPED.length} records`);
const byMapel = {};
for (const r of DEDUPED) {
  if (!byMapel[r.mapel_nama]) byMapel[r.mapel_nama] = [];
  if (!byMapel[r.mapel_nama].includes(r.fase)) byMapel[r.mapel_nama].push(r.fase);
}
for (const [mapel, fases] of Object.entries(byMapel)) {
  const sample = DEDUPED.find(r => r.mapel_nama === mapel);
  const elCount = sample ? sample.elemen.length : 0;
  console.log(`  ${mapel}: Fase ${fases.sort().join(', ')} [${elCount} elemen]`);
}

console.log('\n--- SPOT CHECKS ---');
const checks = [
  ['BAHASA INDONESIA', 'SD', 'A'],
  ['FISIKA', 'SMA', 'F'],
  ['BIOLOGI', 'SMA', 'F'],
  ['BAHASA INGGRIS', 'SMP', 'D'],
  ['SENI MUSIK', 'SD', 'A'],
  ['MATEMATIKA', 'SD', 'A'],
];
for (const [mapel, jen, fase] of checks) {
  const r = DEDUPED.find(r => r.mapel_nama === mapel && r.jenjang === jen && r.fase === fase);
  if (r) {
    console.log(`\n[${mapel} ${jen} Fase ${fase}] ${r.elemen.length} elemen`);
    r.elemen.slice(0, 2).forEach(e => {
      console.log(`  - ${e.nama_elemen}: ${e.capaian_pembelajaran.substring(0, 100)}...`);
    });
  } else {
    console.log(`\n[${mapel} ${jen} Fase ${fase}] NOT FOUND`);
  }
}

writeFileSync('d:/gurupro/extracted_cp_full.json', JSON.stringify(DEDUPED, null, 2));

const sqlStmts = DEDUPED.map(r => {
  const jsonb = JSON.stringify(r.elemen).replace(/'/g, "''");
  return `-- ${r.mapel_nama} | ${r.jenjang} Fase ${r.fase} [${r.elemen.length} elemen]
INSERT INTO capaian_pembelajaran (versi, versi_tanggal, sumber_regulasi, lampiran, jalur, jenjang, tipe_pendidikan, mapel_kode, mapel_nama, fase, kelas_umum, usia_mental, elemen, status_madrasah, halaman_perkiraan, deprecated, created_at, updated_at)
VALUES ('046/2025', '2025-07-16', 'Kepka BSKAP 046/H/KR/2025', 'II', 'kemendikdasmen', '${r.jenjang}', 'reguler', NULL, '${r.mapel_nama.replace(/'/g, "''")}', '${r.fase}', '${r.kelas_umum}', NULL, '${jsonb}', NULL, ${r.halaman_perkiraan}, false, NOW(), NOW())
ON CONFLICT (sumber_regulasi, jalur, jenjang, tipe_pendidikan, mapel_kode, fase)
DO UPDATE SET elemen = EXCLUDED.elemen, mapel_nama = EXCLUDED.mapel_nama, updated_at = NOW();`;
});

writeFileSync('d:/gurupro/migrations/17_seed_capaian_pembelajaran_fase1.sql',
`-- ==========================================
-- SEED: Capaian Pembelajaran Fase 1
-- Source: Kepka BSKAP 046/H/KR/2025 Lampiran II
-- Records: ${DEDUPED.length}
-- Generated: ${new Date().toISOString()}
-- ==========================================
BEGIN;
${sqlStmts.join('\n')}
COMMIT;`);

console.log('\nSaved to migrations/17_seed_capaian_pembelajaran_fase1.sql');
console.log('Saved to extracted_cp_full.json');
