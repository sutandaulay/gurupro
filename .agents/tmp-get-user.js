const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/gurupro' });
p.query("SELECT id, role, email FROM users WHERE email = 'ptgenerasidigitalindonesiaemas@gmail.com'").then(r => { console.log(JSON.stringify(r.rows)); p.end(); }).catch(e => { console.error(e.message); p.end(); });
