import { Pool } from 'pg';
const p = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db' });
(async () => {
  const c = await p.connect();
  const userId = 'a3626614-dc64-4fb8-b7a9-6e23038ae3d1';
  const r = await c.query(`SELECT id, "userId", "schoolId" FROM user_school_assignments WHERE "userId" = $1`, [userId]);
  console.log('Assignments for TEST_guru-3bulan:', r.rows.length);
  for (const row of r.rows) {
    console.log(`- ${row.id}: userId=${row.userId}, schoolId=${row.schoolId}`);
  }
  c.release();
  await p.end();
})();
