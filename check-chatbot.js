const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
c.connect().then(async () => {
  const r = await c.query('SELECT * FROM payload.chatbot_config');
  console.log('payload.chatbot_config:', JSON.stringify(r.rows, null, 2));
  await c.end();
}).catch(e => console.error(e.message));
