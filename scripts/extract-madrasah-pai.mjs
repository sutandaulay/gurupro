/**
 * Madrasah PAI CP Extractor — from extracted_madrasah_pai.txt
 * Source: Kep Dirjen Pendis 9941/2025
 *
 * Sections found:
 * I.   RAUDLATUL ATHFAL (RA)                    lines 67-154
 * II.  AL-QUR'AN HADIS MI, MTs, MA/MAK         lines 155-457
 * III. AL-QUR'AN HADIS MAPK                     lines 458-1245
 * IV.  AKIDAH AKHLAK MI, MTs, MA/MAK            lines 1246-1409
 * V.   AKIDAH AKHLAK MAPK                        lines 1410-1534
 * VI.  FIKIH MI, MTs, MA/MAK                     lines 1688-1870
 * VII. FIKIH MAPK                                lines 1871-2079
 * VIII.SEJARAH KEBUDAYAAN ISLAM                  lines 2080-2251
 * IX.  BAHASA ARAB MI, MTs, MA/MAK               lines 2252-2497
 * 9.1. BAHASA ARAB MAPK                          lines 2498-2590
 */

import { readFileSync, writeFileSync } from 'fs';

const text = readFileSync('d:/gurupro/extracted_madrasah_pai.txt', 'utf8');
const lines = text.split(/\r?\n/);

const SECTIONS = [
  // [name, displayName, jalur, startLine(0-based), endLine(0-based), faseKelas, jenjangMap]
  // RA: Fase Fondasi only
  ['RA_NAHDATUL_ULAMA', 'RAUDLATUL ATHFAL (RA)', 'kemenag', 66, 154, {Fondasi:'RA'}, {RA:['Fondasi']}],
  // AL-QURAN HADIS MI/MTs/MA
  ['AQ_HADIS_MI', 'AL-QUR\'AN HADIS MI/MTs/MA/MAK', 'kneelmenag', 154, 457, {C:'IV-VI',D:'VII-IX',E:'X-XI'}, {MI:['C'],MTs:['D'],MA:['E']}],
  // AL-QURAN HADIS MAPK
  ['AQ_HADIS_MAPK', 'AL-QUR\'AN HADIS MAPK', 'kneelmenag', 457, 1245, {F:'XII'}, {MA:['F']}],
  // AKIDAH AKHLAK MI/MTs/MA
  ['AKIDAH_MI', 'AKIDAH AKHLAK MI/MTs/MA/MAK', 'kneelmenag', 1245, 1409, {C:'IV-VI',D:'VII-IX',E:'X-XI'}, {MI:['C'],MTs:['D'],MA:['E']}],
  // AKIDAH AKHLAK MAPK
  ['AKIDAH_MAPK', 'AKIDAH AKHLAK MAPK', 'kneelmenag', 1409, 1534, {F:'XII'}, {MA:['F']}],
  // FIKIH MI/MTs/MA
  ['FIKIH_MI', 'FIKIH MI/MTs/MA/MAK', 'kneelmenag', 1687, 1870, {C:'IV-VI',D:'VII-IX',E:'X-XI'}, {MI:['C'],MTs:['D'],MA:['E']}],
  // FIKIH MAPK
  ['FIKIH_MAPK', 'FIKIH MAPk', 'kneelmenag', 1870, 2079, {F:'XII'}, {MA:['F']}],
  // SEJARAH KEBUDAYAAN ISLAM
  ['SEJARAH_ISLAM', 'SEJARAH KEBUDAYAAN ISLAM', 'kneelmenag', 2079, 2251, {C:'IV-VI',D:'VII-IX',E:'X-XI',F:'XII'}, {MI:['C'],MTs:['D'],MA:['E','F']}],
  // BAHASA ARAB MI/MTs/MA
  ['BAHASA_ARAB_MI', 'BAHASA ARAB MI/MTs/MA/MAK', 'kneelmenag', 2251, 2497, {C:'IV-VI',D:'VII-IX',E:'X-XI'}, {MI:['C'],MTs:['D'],MA:['E']}],
  // BAHASA ARAB MAPK
  ['BAHASA_ARAB_MAPK', 'BAHASA ARAB MAPk', 'kneelmenag', 2497, 2590, {F:'XII'}, {MA:['F']}],
];

const FASE_TO_JENJANG = {
  Fondasi:'RA',
  A:'MI', B:'MI', C:'MI',
  D:'MTs', E:'MA', F:'MA',
};

function extractFaseBlocks(sectionText) {
  const blocks = [];

  // Pattern 1: "N. Fase X" with "Pada akhir Fase X"
  const numP = /(\d+)\.\s*[Ff]ase\s+([A-Za-z]+)\s*(?:\([^)]+\))?[\s\S]*?[Pp]ada\s+[aA]khir[\s]*[Ff]ase\s+\2[,\s][\s\S]*?(?=(?:\d+\.\s*[Ff]ase\s+)|$)/gi;
  let m;
  while ((m = numP.exec(sectionText)) !== null) {
    blocks.push({ faseNum: parseInt(m[1]), fase: m[2], raw: m[0] });
  }

  // Pattern 2: single fase "Pada akhir Fase Fondasi"
  if (blocks.length === 0) {
    const sp = /[Pp]ada\s+[aA]khir\s+[Ff]ase\s+([A-Za-z]+)[,\s][\s\S]*$/i;
    const sm = sp.exec(sectionText);
    if (sm) blocks.push({ faseNum: 1, fase: sm[1], raw: sm[0] });
  }

  return blocks;
}

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

    if (cleaned.length > 3 && !/^Pada akhir fase/i.test(cleaned)) {
      subCaps.push({ num, heading, content: cleaned.substring(0, 3000) });
    }
  }
  return subCaps;
}

function splitHeadingContent(slice, fallbackNum) {
  const first200 = slice.substring(0, 200).trim();
  if (!first200) return [fallbackNum, ''];
  const words = first200.split(/\s+/);

  const knownVerbs = new Set([
    'memahami','menganalisis','mengevaluasi','menerapkan','menyelesaikan',
    'memilih','menunjukkan','menggunakan','mempelajari','mendukung',
    'berpikir','merefleksikan','mengapresiasi','membangun',
    'membaca','menulis','mengidentifikasi','mendeskripsikan',
    'memiliki','menceritakan','mempresentasikan','menyusun',
    'menghargai','mendemonstrasikan',
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

    if (j === 0 && isKnownVerb) {
      headingWordCount = 1;
      break;
    }
    if (isKnownVerb) break;
    if (isCapitalized || /^[A-Z]{2,}$/.test(w)) {
      headingWordCount = j + 1;
    } else if (isConnector) {
      headingWordCount = j + 1;
    } else {
      headingWordCount = j + 1;
      break;
    }
  }
  if (headingWordCount === 0) headingWordCount = 1;

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

function buildElemen(subCaps) {
  return subCaps.map(sc => ({
    nama_elemen: sc.heading || sc.num,
    capaian_pembelajaran: sc.content,
  }));
}

const RECORDS = [];

for (const [key, displayName, jalur, startLine, endLine, faseKelas, jenjangMap] of SECTIONS) {
  const sectionText = lines.slice(startLine, endLine).join('\n');
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
      versi: '9941/2025',
      versi_tanggal: '2025-11-28',
      sumber_regulasi: 'Kep Dirjen Pendis 9941/2025',
      lampiran: 'I',
      jalur: 'kneelmenag',
      jenjang,
      tipe_pendidikan: 'madrasah',
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

// Deduplicate
const seen = new Set();
const DEDUPED = RECORDS.filter(r => {
  const key = `${r.mapel_nama}|${r.jenjang}|${r.fase}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`Extracted ${DEDUPED.length} Madrasah PAI records`);
for (const r of DEDUPED) {
  console.log(`  ${r.mapel_nama} | ${r.jenjang} Fase ${r.fase} [${r.elemen.length} elemen]`);
}

writeFileSync('d:/gurupro/extracted_cp_madrasah_pai.json', JSON.stringify(DEDUPED, null, 2));

const sqlStmts = DEDUPED.map(r => {
  const jsonb = JSON.stringify(r.elemen).replace(/'/g, "''");
  return `-- ${r.mapel_nama} | ${r.jenjang} Fase ${r.fase} [${r.elemen.length} elemen]
INSERT INTO capaian_pembelajaran (versi, versi_tanggal, sumber_regulasi, lampiran, jalur, jenjang, tipe_pendidikan, mapel_kode, mapel_nama, fase, kelas_umum, usia_mental, elemen, status_madrasah, halaman_perkiraan, deprecated, created_at, updated_at)
VALUES ('${r.versi}', '${r.versi_tanggal}', '${r.sumber_regulasi}', '${r.lampiran}', '${r.jalur}', '${r.jenjang}', '${r.tipe_pendidikan}', NULL, '${r.mapel_nama.replace(/'/g, "''")}', '${r.fase}', '${r.kelas_umum}', NULL, '${jsonb}', NULL, ${r.halaman_perkiraan}, false, NOW(), NOW())
ON CONFLICT (sumber_regulasi, jalur, jenjang, tipe_pendidikan, mapel_kode, fase)
DO UPDATE SET elemen = EXCLUDED.elemen, mapel_nama = EXCLUDED.mapel_nama, updated_at = NOW();`;
});

writeFileSync('d:/gurupro/migrations/18_seed_madrasah_pai.sql',
`-- ==========================================
-- SEED: Madrasah PAI CP (from Kep Dirjen Pendis 9941/2025)
-- Records: ${DEDUPED.length}
-- Generated: ${new Date().toISOString()}
-- ==========================================
BEGIN;
${sqlStmts.join('\n')}
COMMIT;`);

console.log('\nSaved to migrations/18_seed_madrasah_pai.sql');
console.log('Saved to extracted_cp_madrasah_pai.json');
