import fs from 'fs';

const text = fs.readFileSync('extracted_agama_override_ocr.txt', 'utf8');
const lines = text.split('\n');

const KRISTEN = { start: 450, end: 1000 };
const KATOLIK = { start: 1000, end: 1465 };

const FASE_KELAS = {
  'A': 'I-II', 'B': 'III-IV', 'C': 'V-VI',
  'D': 'VII-IX', 'E': 'X-XI', 'F': 'XII',
};

// Kristen elements per fase group
const KRISTEN_ELEMEN = {
  abcd: ['Allah Pencipta', 'Allah Pemelihara', 'Allah Penyelamat', 'Allah Pembaru', 'Manusia dan Hakikat Manusia', 'Nilai-Nilai Kristiani', 'Gereja dan Masyarakat Majemuk', 'Alam dan Lingkungan Hidup'],
  ef: ['Allah Pencipta', 'Allah Pemelihara', 'Allah Penyelamat', 'Allah Berkarya', 'Manusia dan Hakikat Manusia', 'Nilai-Nilai Kristiani', 'Gereja dan Masyarakat Majemuk', 'Alam dan Lingkungan Hidup'],
};

const KATOLIK_ELEMEN = ['Pribadi Murid', 'Iman dan Ibadah', 'Gereja dan Masyarakat', 'Alam dan Lingkungan Hidup'];

// Parse Kristen fase boundaries
function parseKristen() {
  const sectionText = lines.slice(KRISTEN.start, KRISTEN.end).join('\n');
  const faseIdx = [];
  const faseRe = /(\d+)\.\s*Fase\s+([A-F])\s*\(/g;
  let match;
  while ((match = faseRe.exec(sectionText)) !== null) {
    faseIdx.push({ num: match[1], fase: match[2], pos: match.index });
  }

  const results = [];
  for (let i = 0; i < faseIdx.length; i++) {
    const fb = faseIdx[i];
    const nextFb = faseIdx[i + 1];
    const faseText = sectionText.slice(fb.pos, nextFb ? nextFb.pos : sectionText.length);

    // Find CP table start
    const cpTableIdx = faseText.indexOf('Capaian Pembelajaran setiap elemen');
    if (cpTableIdx < 0) continue;
    const tableText = faseText.slice(cpTableIdx);

    const elems = fb.fase <= 'D' ? KRISTEN_ELEMEN.abcd : KRISTEN_ELEMEN.ef;
    const elemenList = [];

    for (const elem of elems) {
      // Find element in table: "ElemName | CP text" or split across lines
      // Build search patterns
      const escaped = elem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped + '\\s*\\|\\s*([^\\n]+(?:\\n(?![A-Z][a-z]+\\s+\\w)|[^\\n]+)*)', 'i');
      const match2 = pattern.exec(tableText);
      if (match2) {
        let cp = match2[1].trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        // Clean page markers
        cp = cp.replace(/--- PAGE \d+ ---[\s\S]*?--- \d+ ---/g, ' ').replace(/\s+/g, ' ').trim();
        if (cp.length > 5) {
          elemenList.push({ nama_elemen: elem, capaian_pembelajaran: cp });
        }
      }
    }

    if (elemenList.length > 0) {
      results.push({ mapel: 'Kristen', fase: fb.fase, kelas: FASE_KELAS[fb.fase], elemen: elemenList });
    }
  }
  return results;
}

// Parse Katolik
function parseKatolik() {
  const sectionText = lines.slice(KATOLIK.start, KATOLIK.end).join('\n');
  const faseIdx = [];
  const faseRe = /(\d+)\.\s*Fase\s+([A-F])\s*\(/g;
  let match;
  while ((match = faseRe.exec(sectionText)) !== null) {
    faseIdx.push({ num: match[1], fase: match[2], pos: match.index });
  }

  const results = [];
  for (let i = 0; i < faseIdx.length; i++) {
    const fb = faseIdx[i];
    const nextFb = faseIdx[i + 1];
    const faseText = sectionText.slice(fb.pos, nextFb ? nextFb.pos : sectionText.length);

    // Find CP table
    const cpTableIdx = faseText.indexOf('Capaian Pembelajaran');
    if (cpTableIdx < 0) continue;
    const tableText = faseText.slice(cpTableIdx);

    const elems = KATOLIK_ELEMEN;
    const elemenList = [];

    for (const elem of elems) {
      const escaped = elem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped + '\\s*\\|\\s*([^\\n]+(?:\\n(?![A-Z][a-z]+\\s+\\w)|[^\\n]+)*)', 'i');
      const match2 = pattern.exec(tableText);
      if (match2) {
        let cp = match2[1].trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        cp = cp.replace(/--- PAGE \d+ ---[\s\S]*?--- \d+ ---/g, ' ').replace(/\s+/g, ' ').trim();
        if (cp.length > 5) {
          elemenList.push({ nama_elemen: elem, capaian_pembelajaran: cp });
        }
      }
    }

    if (elemenList.length > 0) {
      results.push({ mapel: 'Katolik', fase: fb.fase, kelas: FASE_KELAS[fb.fase], elemen: elemenList });
    }
  }
  return results;
}

const kristen = parseKristen();
const katolik = parseKatolik();
console.error('Kristen:', kristen.length, 'fases extracted');
console.error('Katolik:', katolik.length, 'fases extracted');

// Output JSON
const all = [...kristen, ...katolik];
console.log(JSON.stringify(all, null, 2));
