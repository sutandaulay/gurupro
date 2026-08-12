/**
 * CP Extractor — Extracts structured Capaian Pembelajaran from PDF text
 * Output: JSON seed data for migrations
 *
 * Usage: node scripts/extract-cp.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const text = readFileSync('d:/gurupro/extracted_full.txt', 'utf8');
const lines = text.split('\n');

/**
 * Extract a section of text between two line numbers (inclusive)
 */
function extractSection(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n');
}

/**
 * Find the next CP section header starting from a given line
 */
function findNextCPSection(startLine) {
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('CAPAIAN PEMBELAJARAN ')) {
      return { line: i + 1, title: line };
    }
  }
  return null;
}

/**
 * Parse fase sections from a mapel's text
 * Matches patterns like "Fase A" or "Fase Fondasi"
 */
function parseFases(text) {
  const faseRegex = /(?:BAGIAN |Fase |Fase Fondasi(?: di Akhir)?(?: Satuan PAUD)?|C\. Capaian Pembelajaran(?: Fase Fondasi)?)[ \n]*([A-Z0-9 ]+?)(?:\n| - | – |:|$)/g;
  const fases = [];

  // Simple approach: split by "Fase" occurrences
  const faseMatches = [...text.matchAll(/(?:Fase|BAGIAN)[\s\n]+([A-Z0-9]+)/gi)];
  const uniqueFases = [...new Set(faseMatches.map(m => m[1].trim().replace(/\s+/g, ' ')))];

  for (const faseName of uniqueFases) {
    // Extract the CP text for this fase
    const fasePattern = new RegExp(`(?:Fase|BAGIAN)[\\s\\n]+${faseName}[\\s\\S]*?(?=(?:Fase|BAGIAN)[\\s\\n]+[A-Z0-9]|$$)`, 'gi');
    const match = text.match(fasePattern);
    const faseText = match ? match[0] : '';

    if (faseText.length > 50) {
      fases.push({
        nama_fase: faseName,
        text_raw: faseText.substring(0, 5000),
      });
    }
  }

  return fases;
}

/**
 * Parse elemen from fase text
 * Elemen are typically listed as Roman numerals I., II., III., etc.
 */
function parseElemenFromText(text) {
  const elemen = [];

  // Match patterns like "I. Elemen Name" or "Elemen I. Name"
  const elemenRegex = /(?:Elemen |)([IVXLC]+)\.\s*([^\n]+)/g;
  let match;
  let currentElemen = null;
  let currentElemenText = '';

  const lines2 = text.split('\n');
  for (const line of lines2) {
    const headerMatch = line.trim().match(/^([IVXLC]+)\.\s*(.+)/);
    if (headerMatch) {
      if (currentElemen) {
        elemen.push({
          nama_elemen: currentElemen.name,
          text_raw: currentElemenText.trim().substring(0, 3000),
        });
      }
      currentElemen = { name: headerMatch[2].trim() };
      currentElemenText = '';
    } else if (currentElemen) {
      currentElemenText += line + '\n';
    }
  }
  if (currentElemen) {
    elemen.push({
      nama_elemen: currentElemen.name,
      text_raw: currentElemenText.trim().substring(0, 3000),
    });
  }

  return elemen;
}

/**
 * Extract CP for a specific lampiran
 */
function extractLampiran(lampiranName, startLine, endLine) {
  const sectionText = extractSection(startLine, endLine);
  const results = [];

  let currentLine = 0;
  const sectionLines = sectionText.split('\n');

  for (let i = 0; i < sectionLines.length; i++) {
    const line = sectionLines[i].trim();
    if (line.startsWith('CAPAIAN PEMBELAJARAN ')) {
      const mapelName = line.replace('CAPAIAN PEMBELAJARAN ', '').replace(/\s+ DAN\s*$/, '').trim();
      const mapelStartLine = startLine + i;

      // Find end of this section
      let nextStart = i + 1;
      while (nextStart < sectionLines.length) {
        if (sectionLines[nextStart].trim().startsWith('CAPAIAN PEMBELAJARAN ')) {
          break;
        }
        nextStart++;
      }
      const mapelEndLine = startLine + nextStart - 1;
      const mapelText = sectionLines.slice(i, nextStart).join('\n');

      results.push({
        start_line: mapelStartLine,
        end_line: mapelEndLine,
        mapel: mapelName,
        fases: parseFases(mapelText),
      });
    }
  }

  return results;
}

// Lampiran boundaries (line numbers)
const BOUNDARIES = {
  'LAMPIRAN I':  { start: 126,  end: 282  },
  'LAMPIRAN II': { start: 282,  end: 5403 },
  'LAMPIRAN III':{ start: 5403, end: 19145 },
  'LAMPIRAN IV': { start: 19145, end: 20567 },
  'LAMPIRAN V':  { start: 20567, end: lines.length },
};

// Extract key mapel from Lampiran II (most impactful — umum + agama)
// Process in batches for control

const lamp2Text = extractSection(BOUNDARIES['LAMPIRAN II'].start, BOUNDARIES['LAMPIRAN II'].end);
const lamp2Lines = lamp2Text.split('\n');

const extracted = [];

let i = 0;
while (i < lamp2Lines.length) {
  const line = lamp2Lines[i].trim();

  // Find mapel headers
  const cpMatch = line.match(/^CAPAIAN PEMBELAJARAN\s+(.+)/);
  if (cpMatch) {
    const mapelRaw = cpMatch[1].trim();
    const mapelName = mapelRaw.replace(/\s+ DAN\s*$/, '').replace(/\s+(TINGKAT LANJUT|KERAJINAN|PENGOLAHAN|REKAYASA|BUDI DAYA)$/i, ' $1').trim();

    // Find the end of this mapel section
    let j = i + 1;
    while (j < lamp2Lines.length) {
      const nextLine = lamp2Lines[j].trim();
      if (nextLine.match(/^CAPAIAN PEMBELAJARAN\s+/) && !nextLine.includes(mapelRaw.substring(0, 20))) {
        break;
      }
      j++;
    }

    const mapelText = lamp2Lines.slice(i, j).join('\n');
    const fases = parseFases(mapelText);
    const globalLine = BOUNDARIES['LAMPIRAN II'].start + i;

    extracted.push({
      lampiran: 'II',
      global_start_line: globalLine,
      global_end_line: BOUNDARIES['LAMPIRAN II'].start + j,
      mapel_raw: mapelRaw,
      mapel_name: mapelName,
      fases,
      char_count: mapelText.length,
    });

    i = j;
  } else {
    i++;
  }
}

// Deduplicate by mapel name
const seen = new Set();
const deduped = extracted.filter(e => {
  if (seen.has(e.mapel_name)) return false;
  seen.add(e.mapel_name);
  return true;
});

console.log(`Extracted ${deduped.length} mapel from Lampiran II:`);
for (const e of deduped) {
  console.log(`  [${e.global_start_line}-${e.global_end_line}] ${e.mapel_name} (${e.fases.length} fases, ${e.char_count} chars)`);
}

// Save raw extraction for review
writeFileSync('d:/gurupro/extracted_lampiran2_mapel.json', JSON.stringify(deduped, null, 2));
console.log('\nSaved to extracted_lampiran2_mapel.json');

// Now generate the structured seed data for the highest-priority mapel
// Based on Fase 1 priority: Agama (override), Mapel Umum SD/MI/SMP/SMA

function normalizeMapelName(name) {
  return name
    .replace(/^PENDIDIKAN\s+/, '')
    .replace(/\s*DAN BUDI PEKERTI$/i, ' & Budi Pekerti')
    .replace(/\s*DAN\s*$/, '')
    .trim();
}

// Priority mapel for Fase 1 extraction
const PRIORITY_MAPEL = {
  'BAHASA INDONESIA': {
    jenjang: ['SD', 'SMP', 'SMA'],
    fases: { 'SD': ['A', 'B', 'C'], 'SMP': ['D'], 'SMA': ['E', 'F'] },
    kelas: { 'A': 'I-II', 'B': 'III', 'C': 'IV-VI', 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'MATEMATIKA': {
    jenjang: ['SD', 'SMP', 'SMA'],
    fases: { 'SD': ['A', 'B', 'C'], 'SMP': ['D'], 'SMA': ['E', 'F'] },
    kelas: { 'A': 'I-II', 'B': 'III', 'C': 'IV-VI', 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'BAHASA INGGRIS': {
    jenjang: ['SMP', 'SMA'],
    fases: { 'SMP': ['D'], 'SMA': ['E', 'F'] },
    kelas: { 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'ILMU PENGETAHUAN ALAM DAN SOSIAL': {
    jenjang: ['SD'],
    fases: { 'SD': ['A', 'B', 'C'] },
    kelas: { 'A': 'I-II', 'B': 'III', 'C': 'IV-VI' },
  },
  'ILMU PENGETAHUAN ALAM (IPA)': {
    jenjang: ['SMP'],
    fases: { 'SMP': ['D'] },
    kelas: { 'D': 'VII-IX' },
  },
  'FISIKA': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['E', 'F'] },
    kelas: { 'E': 'X-XI', 'F': 'XII' },
  },
  'KIMIA': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['E', 'F'] },
    kelas: { 'E': 'X-XI', 'F': 'XII' },
  },
  'BIOLOGI': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['E', 'F'] },
    kelas: { 'E': 'X-XI', 'F': 'XII' },
  },
  'INFORMATIKA': {
    jenjang: ['SMP', 'SMA', 'SMK'],
    fases: { 'SMP': ['D'], 'SMA': ['E', 'F'], 'SMK': ['E', 'F'] },
    kelas: { 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'ILMU PENGETAHUAN SOSIAL': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['E'] },
    kelas: { 'E': 'X-XI' },
  },
  'SEJARAH': {
    jenjang: ['SMP', 'SMA'],
    fases: { 'SMP': ['D'], 'SMA': ['E', 'F'] },
    kelas: { 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'GEOGRAFI': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['E'] },
    kelas: { 'E': 'X-XI' },
  },
  'EKONOMI': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['E'] },
    kelas: { 'E': 'X-XI' },
  },
  'SOSIOLOGI': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['E'] },
    kelas: { 'E': 'X-XI' },
  },
  'ANTROPOLOGI': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['E', 'F'] },
    kelas: { 'E': 'X-XI', 'F': 'XII' },
  },
  'PENDIDIKAN JASMANI, OLAHRAGA, DAN KESEHATAN': {
    jenjang: ['SD', 'SMP', 'SMA'],
    fases: { 'SD': ['A', 'B', 'C'], 'SMP': ['D'], 'SMA': ['E', 'F'] },
    kelas: { 'A': 'I-II', 'B': 'III', 'C': 'IV-VI', 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'SENI MUSIK': {
    jenjang: ['SD', 'SMP', 'SMA'],
    fases: { 'SD': ['A', 'B', 'C'], 'SMP': ['D'], 'SMA': ['E', 'F'] },
    kelas: { 'A': 'I-II', 'B': 'III', 'C': 'IV-VI', 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'SENI RUPA': {
    jenjang: ['SD', 'SMP', 'SMA'],
    fases: { 'SD': ['A', 'B', 'C'], 'SMP': ['D'], 'SMA': ['E', 'F'] },
    kelas: { 'A': 'I-II', 'B': 'III', 'C': 'IV-VI', 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'SENI TARI': {
    jenjang: ['SD', 'SMP', 'SMA'],
    fases: { 'SD': ['A', 'B', 'C'], 'SMP': ['D'], 'SMA': ['E', 'F'] },
    kelas: { 'A': 'I-II', 'B': 'III', 'C': 'IV-VI', 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'SENI TEATER': {
    jenjang: ['SD', 'SMP', 'SMA'],
    fases: { 'SD': ['A', 'B', 'C'], 'SMP': ['D'], 'SMA': ['E', 'F'] },
    kelas: { 'A': 'I-II', 'B': 'III', 'C': 'IV-VI', 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'KODING DAN KECERDASAN ARTIFISIAL': {
    jenjang: ['SD', 'SMP', 'SMA', 'SMK'],
    fases: { 'SD': ['C'], 'SMP': ['D'], 'SMA': ['E', 'F'], 'SMK': ['E', 'F'] },
    kelas: { 'C': 'IV-VI', 'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII' },
  },
  'BAHASA INDONESIA TINGKAT LANJUT': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['F'] },
    kelas: { 'F': 'XII' },
  },
  'MATEMATIKA TINGKAT LANJUT': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['F'] },
    kelas: { 'F': 'XII' },
  },
  'BAHASA INGGRIS TINGKAT LANJUT': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['F'] },
    kelas: { 'F': 'XII' },
  },
  'SEJARAH TINGKAT LANJUT': {
    jenjang: ['SMA'],
    fases: { 'SMA': ['F'] },
    kelas: { 'F': 'XII' },
  },
};

// Extract detailed text for priority mapel
const detailedCP = [];
for (const entry of deduped) {
  const matchKey = Object.keys(PRIORITY_MAPEL).find(k =>
    entry.mapel_name.toUpperCase().includes(k) ||
    k.includes(entry.mapel_name.toUpperCase())
  );

  if (matchKey) {
    const info = PRIORITY_MAPEL[matchKey];
    const cpRecord = {
      sumber_regulasi: 'Kepka BSKAP 046/H/KR/2025',
      lampiran: 'II',
      jalur: 'kemendikdasmen',
      jenjang_list: info.jenjang,
      mapel_kode: null,
      mapel_nama: normalizeMapelName(entry.mapel_name),
      fase_info: info.fases,
      kelas_info: info.kelas,
      text_raw: entry.fases.map(f => `## Fase ${f.nama_fase}\n${f.text_raw}`).join('\n\n'),
      global_start_line: entry.global_start_line,
    };
    detailedCP.push(cpRecord);
  }
}

writeFileSync('d:/gurupro/extracted_priority_cp.json', JSON.stringify(detailedCP, null, 2));
console.log(`\nExtracted ${detailedCP.length} priority mapel. Saved to extracted_priority_cp.json`);

// Also extract Lampiran I (PAUD)
console.log('\n--- Lampiran I (PAUD) ---');
const lamp1Text = extractSection(BOUNDARIES['LAMPIRAN I'].start, BOUNDARIES['LAMPIRAN I'].end);
writeFileSync('d:/gurupro/extracted_lampiran1_paud.txt', lamp1Text);
console.log(`Saved Lampiran I (${lamp1Text.length} chars) to extracted_lampiran1_paud.txt`);
