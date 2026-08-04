const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
c.connect().then(async () => {
  const r = await c.query('SELECT id, title, status, created_at, user_id FROM public.admin_tasks LIMIT 10');
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
}).catch(e => console.error(e.message));
