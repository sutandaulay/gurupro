const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
c.connect().then(async () => {
  const tables = ['landing_page', 'chatbot_config', 'cms_users', 'cms_users_sessions', 'payload_kv', 'payload_locked_documents', 'payload_migrations', 'payload_preferences', 'hero_sections'];
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
