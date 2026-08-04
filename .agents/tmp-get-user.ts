import { query } from '../lib/db';
async function main() {
  const r = await query("SELECT id, role, email FROM users WHERE email = 'ptgenerasidigitalindonesiaemas@gmail.com'");
  console.log(JSON.stringify(r.rows));
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
