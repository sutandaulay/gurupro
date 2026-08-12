import fs from 'fs';

const text = fs.readFileSync('extracted_agama_override_ocr.txt', 'utf8');
const lines = text.split('\n');

const SECTIONS = [
  { name: 'Islam', start: 165, end: 450 },
  { name: 'Kristen', start: 450, end: 1000 },
  { name: 'Katolik', start: 1000, end: 1465 },
  { name: 'Hindu', start: 1465, end: 1748 },
  { name: 'Buddha', start: 1748, end: 2164 },
  { name: 'Khonghucu', start: 2164, end: 4532 },
];

const FASE_KELAS = {
  'A': 'I-II', 'B': 'III-IV', 'C': 'V-VI',
  'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII',
};

// Map sub-cap header patterns per mapel
const ELEMEN_PATTERNS = {
  Islam: ['Al-Qur\'an Hadis', 'Akidah', 'Akhlak', 'Fikih', 'Sejarah Peradaban Islam'],
  Kristen: null, // dynamic
  Katolik: null,
  Hindu: ['Acara', 'Susila', 'Sraddha dan Bhakti', 'Kitab Suci Weda', 'Sejarah Agama Hindu'],
  Buddha: ['Sila', 'Samadhi', 'Panna', 'Sejarah Buddha'],
  Khonghucu: ['Sejarah Suci', 'Kitab Suci', 'Keimanan', 'Tata Ibadah', 'Perilaku Junzi'],
};

function getSectionText(start, end) {
  return lines.slice(start, end).join('\n');
}

function findFaseBlocks(sectionText) {
  const blocks = [];
  // Pattern 1: "N. Fase X (kelas)"
  const faseRe1 = /(\d+)\.\s*Fase\s+([A-F])\s*\(/g;
  // Pattern 2: "N. Fase X" (on its own line, no paren)
  const faseRe2 = /(\d+)\.\s*Fase\s+([A-F])\s*(?=\n|$)/g;

  let match;
  while ((match = faseRe1.exec(sectionText)) !== null) {
    blocks.push({ num: match[1], fase: match[2], pos: match.index, type: 'inline' });
  }
  while ((match = faseRe2.exec(sectionText)) !== null) {
    // Skip if already captured by pattern 1 (don't add duplicates at same pos)
    if (!blocks.some(b => b.pos === match.index)) {
      blocks.push({ num: match[1], fase: match[2], pos: match.index, type: 'standalone' });
    }
  }
  return blocks;
}

function extractElemenName(sectionText, faseNum, elemNum, afterPos) {
  // Find "N.N. ElemName" after afterPos
  const re = new RegExp(`(?:^|\\n)(${faseNum}\\.${elemNum}\\.)\\s*([^\\n]+)`, 'm');
  const match = re.exec(sectionText.slice(afterPos));
  if (!match) return null;
  return { name: match[2].trim(), fullMatch: match[0].trim(), pos: afterPos + match.index };
}

function extractElemenContent(sectionText, faseNum, elemNum, elemName, afterPos, nextPos) {
  // Get text between "N.N. ElemName" header and next "N.N." or end
  const headerRe = new RegExp(`(?:^|\\n)(${faseNum}\\.${elemNum}\\.)\\s*${escapeRe(elemName)}([\\s\\S]*?)(?=(?:^|\\n)${faseNum}\\.\\d+\\.|$)`, 'm');
  const match = headerRe.exec(sectionText.slice(afterPos));
  if (!match) return '';
  let content = match[2].trim();
  // Clean: remove "Pada akhir Fase X" trailing line
  content = content.replace(/\n?Pada akhir Fase [A-F][^]*$/i, '').trim();
  return content;
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const results = [];

for (const section of SECTIONS) {
  const sectionText = getSectionText(section.start, section.end);
  const faseBlocks = findFaseBlocks(sectionText);
  console.error(`\n=== ${section.name} (${faseBlocks.length} fases) ===`);

  for (let i = 0; i < faseBlocks.length; i++) {
    const fb = faseBlocks[i];
    const nextFb = faseBlocks[i + 1];
    const searchStart = fb.pos;
    const searchEnd = nextFb ? nextFb.pos : sectionText.length;
    const searchSlice = sectionText.slice(searchStart, searchEnd);

    // Detect element names in this fase
    const elemNums = [];
    const elemNames = [];
    const elemRe = new RegExp(`(?:^|\\n)(${fb.num}\\.(\\d+)\\.)\\s*([^\\n]+)`, 'gm');
    let match;
    while ((match = elemRe.exec(searchSlice)) !== null) {
      const num = match[2];
      const name = match[3].trim();
      if (!elemNums.includes(num)) {
        elemNums.push(num);
        elemNames.push({ num, name });
      }
    }

    console.error(`  Fase ${fb.fase}: ${elemNames.length} elemen detected`);
    if (elemNames.length > 0) {
      console.error(`    -> ${elemNames.map(e => `${e.num}. ${e.name}`).join(', ')}`);
    }

    // Extract content for each element
    const elemenList = [];
    for (let j = 0; j < elemNames.length; j++) {
      const elem = elemNames[j];
      const nextElem = elemNames[j + 1];

      // Content spans from end of element header line to next element (or end of fase)
      const headerIdx = searchSlice.indexOf(`${fb.num}.${elem.num}. ${elem.name}`);
      if (headerIdx < 0) continue;
      const contentStart = headerIdx + `${fb.num}.${elem.num}. ${elem.name}`.length;
      const contentEnd = nextElem
        ? searchSlice.indexOf(`${fb.num}.${nextElem.num}.`, contentStart)
        : searchSlice.length;

      let content = searchSlice.slice(contentStart, contentEnd > 0 ? contentEnd : undefined).trim();
      content = content.replace(/^[\n\s]+/, '').replace(/[\n\s]+$/, '').trim();

      if (content) {
        elemenList.push({ nama_elemen: elem.name, capaian_pembelajaran: content });
      }
    }

    if (elemenList.length > 0) {
      results.push({
        mapel: section.name,
        fase: fb.fase,
        kelas: FASE_KELAS[fb.fase] || '',
        elemen: elemenList,
      });
    }
  }
}

console.log(JSON.stringify(results, null, 2));
