import { query } from 'D:/gurupro/lib/db';

async function main() {
  const out: any = {};
  try {
    const users = await query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='users'
         AND column_name IN ('quota_poin_total','token_limit','addon_poin','addon_token_balance','addon_poin_used','quota_poin_used')`
    );
    out.users_cols = users.rows.map((r: any) => r.column_name);
  } catch (e: any) { out.users_cols_err = e.message; }

  try {
    const txn = await query(`SELECT to_regclass('poin_transactions') AS t`);
    out.poin_transactions = txn.rows[0].t;
  } catch (e: any) { out.poin_txn_err = e.message; }

  try {
    const cnt = await query(`SELECT COUNT(*)::int AS c FROM users WHERE quota_poin_total IS NOT NULL AND quota_poin_total>0`);
    out.users_with_poin = cnt.rows[0].c;
  } catch (e: any) { out.users_with_poin_err = e.message; }

  try {
    const tok = await query(`SELECT COUNT(*)::int AS c FROM users WHERE token_limit IS NOT NULL AND token_limit>0`);
    out.users_with_token = tok.rows[0].c;
  } catch (e: any) { out.users_with_token_err = e.message; }

  try {
    const s = await query(`SELECT key FROM system_settings WHERE key IN ('ai_config','tokens_per_poin')`);
    out.settings = s.rows.map((r: any) => r.key);
  } catch (e: any) { out.settings_err = e.message; }

  try {
    const p = await query(`SELECT COUNT(*)::int AS c FROM pricing_plans WHERE poin IS NOT NULL`);
    out.pricing_with_poin = p.rows[0].c;
  } catch (e: any) { out.pricing_err = e.message; }

  console.log(JSON.stringify(out, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
