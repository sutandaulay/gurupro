const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
c.connect().then(async () => {
  const tables = ['footer_content', 'features', 'why_points', 'pricing_plans', 'categories', 'posts', 'addon_token_packages', 'institutions', 'institution_members', 'performance_share_links', 'document_access_grants', 'otp_verifications', 'invitations', 'leader_contacts'];
  for (const t of tables) {
    try {
      const r = await c.query('SELECT COUNT(*) as cnt FROM payload.' + t);
      console.log(t + ': ' + r.rows[0].cnt + ' rows');
    } catch(e) {
      console.log(t + ': ERROR - ' + e.message);
    }
  }
  await c.end();
}).catch(e => console.error(e.message));
