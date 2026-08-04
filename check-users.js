const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
c.connect().then(async () => {
  const r = await c.query('SELECT id, username, email, role, status_langganan, created_at FROM public.users');
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
}).catch(e => console.error(e.message));
