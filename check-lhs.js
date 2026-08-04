const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
c.connect().then(async () => {
  const r = await c.query('SELECT COUNT(*) as cnt FROM payload.landing_page_hero_stats');
  console.log('landing_page_hero_stats: ' + r.rows[0].cnt + ' rows');
  await c.end();
}).catch(e => console.error(e.message));
