import { readFileSync } from 'fs';
import { resolve } from 'path';
import { query } from 'D:/gurupro/lib/db';

async function main() {
  const file = resolve('D:/gurupro/migrations/12_poin_ledger_and_ratio_audit.sql');
  const sql = readFileSync(file, 'utf8');
  // PISahkan statement berdasarkan ; di luar string/comment sederhana
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  console.log(`Menjalankan ${statements.length} statement...`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await query(stmt);
      console.log(`[${i + 1}/${statements.length}] OK (${stmt.slice(0, 60).replace(/\n/g, ' ')})`);
    } catch (e: any) {
      // Abaikan error "sudah ada" yang aman
      const msg = e.message || '';
      if (/sudah ada|already exists|duplicate|does not exist|tidak ada/i.test(msg)) {
        console.log(`[${i + 1}/${statements.length}] SKIP: ${msg.slice(0, 80)}`);
      } else {
        console.error(`[${i + 1}/${statements.length}] ERROR:`, msg);
        throw e;
      }
    }
  }
  console.log('MIGRATION SELESAI.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
