import { query } from 'D:/gurupro/lib/db';
(async () => {
  const u = await query("SELECT id, token_limit, quota_poin_total, addon_token_balance, addon_poin FROM users LIMIT 12");
  console.log(JSON.stringify(u.rows, null, 1));
  const r = await query("SELECT key, value FROM system_settings WHERE key IN ('tokens_per_poin','ai_config')");
  console.log('SETTINGS:', JSON.stringify(r.rows));
  const a = await query("SELECT COUNT(*)::int AS c FROM poin_ratio_audit");
  console.log('ratio_audit rows:', JSON.stringify(a.rows));
  const cols = await query("SELECT column_name FROM information_schema.columns WHERE table_name='poin_transactions' AND column_name IN ('ratio_used_at_transaction','cached_tokens')");
  console.log('ledger cols:', JSON.stringify(cols.rows));
})().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
