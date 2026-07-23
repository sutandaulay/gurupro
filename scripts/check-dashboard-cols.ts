import { Pool } from 'pg';
const p = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
(async () => {
  const c = await p.connect();
  const tables = ['payload.teacher_institution_assignments', 'attendance_logs'];
  for (const t of tables) {
    const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = split_part($1, '.', 1) AND table_name = split_part($1, '.', 2) ORDER BY ordinal_position`, [t]);
    console.log(`\n${t}:`);
    console.log(r.rows.map(x => x.column_name).join(', '));
  }
  c.release();
  await p.end();
})();
