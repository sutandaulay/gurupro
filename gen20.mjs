import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('extracted_agama_override_clean.json', 'utf8'));

function escape(s) { return s.replace(/'/g, "''"); }

const kodeMap = { Islam: 'PAI', Hindu: 'AGAMA_HINDU', Buddha: 'AGAMA_BUDDHA', Khonghucu: 'AGAMA_KHONGHUCU' };
const jenjangMap = { 'A': 'SD', 'B': 'SD', 'C': 'SD', 'D': 'SMP', 'E': 'SMA', 'F': 'SMA' };

const vals = [];
for (const r of data) {
  const jenjang = jenjangMap[r.fase];
  const elemArray = r.elemen.map(e => ({ nama_elemen: e.nama_elemen, capaian_pembelajaran: e.capaian_pembelajaran }));
  const elemJSON = escape(JSON.stringify(elemArray));
  const mapelNama = 'Pendidikan Agama ' + r.mapel;
  const kode = kodeMap[r.mapel];
  vals.push(`('Kepka BKPDM 020/2026', '020/2026', '2026-01-01', 'II', 'kemendikdasmen', '${jenjang}', NULL, '${kode}', '${mapelNama}', '${r.fase}', '${r.kelas}', NULL, '${elemJSON}', NULL, NULL, NULL, false, NOW(), NOW())`);
}

const sql = `-- Seed: Agama Umum dari Kepka BKPDM 020/2026 (override)
-- Extracted via OCR + cleaned
-- Records: ${data.length} (Islam, Hindu, Buddha, Khonghucu)
-- Note: Agama Kristen & Katolik excluded — image PDF table, OCR quality insufficient

INSERT INTO capaian_pembelajaran (sumber_regulasi, versi, versi_tanggal, lampiran, jalur, jenjang, tipe_pendidikan, mapel_kode, mapel_nama, fase, kelas_umum, usia_mental, elemen, status_madrasah, halaman_perkiraan, kode_romawi, deprecated, created_at, updated_at)
VALUES
${vals.join(',\n')};`;

writeFileSync('migrations/20_seed_agama_override.sql', sql);
console.error(`Done: ${data.length} records`);
