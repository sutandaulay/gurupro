const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
c.connect().then(async () => {
  const tables = ['footer_content', 'footer_content_links', 'footer_content_social_links', 'landing_page', 'landing_page_hero_stats', 'chatbot_config', 'cms_users', 'cms_users_sessions', 'payload_kv', 'payload_locked_documents', 'payload_locked_documents_rels', 'payload_preferences', 'payload_preferences_rels', 'why_points', 'features', 'addon_token_packages', 'categories', 'posts', 'performance_share_links', 'document_access_grants', 'otp_verifications', 'invitations', 'leader_contacts'];
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
