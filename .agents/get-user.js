const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
p.query("SELECT id, role, email FROM users WHERE email = 'ptgenerasidigitalindonesiaemas@gmail.com'").then(r => { console.log(JSON.stringify(r.rows)); p.end(); }).catch(e => { console.error(e.message); p.end(); });
